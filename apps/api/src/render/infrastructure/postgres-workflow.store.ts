import { Injectable } from '@nestjs/common';
import type { RenderEvent, RenderJob, RenderStatus } from '@media-lab/contracts';
import { Pool, type PoolClient } from 'pg';
import { RenderJobAggregate } from '../domain/render-job';
import { createMediaProcessingPlan } from '../domain/media-processing-plan';
import type {
  ArtifactReceipt,
  ClaimedWork,
  CreateWorkflow,
  WorkflowStore,
} from '../domain/workflow-store';

/**
 * Schema for the durable render workflow.
 *
 * Four tables, each carrying one guarantee the API layer must not have to re-implement:
 *
 *   render_jobs    UNIQUE(tenant_id, idempotency_key) is what makes "one command, one job"
 *                  true across concurrent API instances. The check lives in the database on
 *                  purpose — an in-process cache cannot coordinate two containers.
 *   render_events  UNIQUE(job_id, sequence) is what makes SSE replay safe. A reconnect
 *                  resumes after Last-Event-ID and can neither skip nor duplicate a step.
 *   render_outbox  One row per job, with a lease. A worker that dies notifies nobody: the
 *                  lease expires and another worker claims the row (attempt + 1). Indexed
 *                  on (state, available_at, lease_until) because that is exactly the
 *                  claim query's predicate.
 *   artifacts      Written in the same transaction that flips the job to `ready`, so the
 *                  artifact and the state advertising it can never disagree.
 *
 * The migration runs on boot and is idempotent, so a cold start against an existing
 * database is a no-op rather than a failure.
 */
const MIGRATION = `
CREATE TABLE IF NOT EXISTS render_jobs (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL,
  tokens integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS render_jobs_tenant_status_idx ON render_jobs(tenant_id, status);

CREATE TABLE IF NOT EXISTS render_events (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES render_jobs(id),
  tenant_id text NOT NULL,
  sequence integer NOT NULL,
  event_type text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, sequence)
);

CREATE TABLE IF NOT EXISTS render_outbox (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES render_jobs(id),
  tenant_id text NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempt integer NOT NULL DEFAULT 0,
  worker_id text,
  lease_until timestamptz,
  last_error text,
  available_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS render_outbox_claim_idx
  ON render_outbox(state, available_at, lease_until);

CREATE TABLE IF NOT EXISTS artifacts (
  job_id uuid PRIMARY KEY REFERENCES render_jobs(id),
  tenant_id text NOT NULL,
  url text NOT NULL,
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

@Injectable()
export class PostgresWorkflowStore implements WorkflowStore {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, statement_timeout: 5000 });
  }
  async initialize() {
    await this.pool.query(MIGRATION);
  }
  async onApplicationShutdown() {
    await this.pool.end();
  }
  private async transaction<T>(operation: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await operation(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async create({ tenantId, traceId, requestId, command, quotaTokens }: CreateWorkflow) {
    return this.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenantId]);
      const existing = await client.query<{ snapshot: RenderJob }>(
        'SELECT snapshot FROM render_jobs WHERE tenant_id=$1 AND idempotency_key=$2',
        [tenantId, command.idempotencyKey],
      );
      if (existing.rowCount) return { job: existing.rows[0]!.snapshot, created: false };
      const used = await client.query<{ used: string }>(
        "SELECT COALESCE(SUM(tokens),0)::text AS used FROM render_jobs WHERE tenant_id=$1 AND created_at>=date_trunc('day',now())",
        [tenantId],
      );
      const tokens = Math.ceil(command.narration.length * 1.4);
      if (Number(used.rows[0]?.used ?? 0) + tokens > quotaTokens)
        throw new Error('TENANT_QUOTA_EXCEEDED');
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const plan = createMediaProcessingPlan(command);
      const job: RenderJob = {
        id,
        tenantId,
        projectId: command.projectId,
        sourceAssetId: command.sourceAssetId,
        status: 'accepted',
        progress: 4,
        stage: 'Probe + processing contract accepted',
        sequence: 1,
        attempt: 0,
        traceId,
        requestId,
        estimatedCostUsd: Number((command.durationSeconds * 0.0018).toFixed(3)),
        tokens,
        template: command.template,
        trimStartSeconds: command.trimStartSeconds,
        durationSeconds: command.durationSeconds,
        encoding: command.encoding,
        processing: command.processing,
        ...plan,
        artifactUrl: null,
        artifactChecksum: null,
        manifestUrl: null,
        renditions: [],
        updatedAt: now,
      };
      const inserted = await client.query<{ snapshot: RenderJob }>(
        'INSERT INTO render_jobs(id,tenant_id,idempotency_key,status,tokens,snapshot) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING RETURNING snapshot',
        [id, tenantId, command.idempotencyKey, job.status, tokens, job],
      );
      if (!inserted.rowCount) {
        const existing = await client.query<{ snapshot: RenderJob }>(
          'SELECT snapshot FROM render_jobs WHERE tenant_id=$1 AND idempotency_key=$2',
          [tenantId, command.idempotencyKey],
        );
        return { job: existing.rows[0]!.snapshot, created: false };
      }
      const event: RenderEvent = {
        id: crypto.randomUUID(),
        jobId: id,
        tenantId,
        sequence: 1,
        type: 'render.progress',
        data: job,
        createdAt: now,
      };
      await client.query(
        'INSERT INTO render_events(id,job_id,tenant_id,sequence,event_type,data) VALUES($1,$2,$3,$4,$5,$6)',
        [event.id, id, tenantId, 1, event.type, event],
      );
      await client.query('INSERT INTO render_outbox(id,job_id,tenant_id) VALUES($1,$2,$3)', [
        crypto.randomUUID(),
        id,
        tenantId,
      ]);
      return { job, created: true };
    });
  }
  async findById(tenantId: string, id: string) {
    const result = await this.pool.query<{ snapshot: RenderJob }>(
      'SELECT snapshot FROM render_jobs WHERE tenant_id=$1 AND id=$2',
      [tenantId, id],
    );
    return result.rows[0]?.snapshot;
  }
  async listEvents(tenantId: string, id: string, afterSequence: number) {
    const result = await this.pool.query<{ data: RenderEvent }>(
      'SELECT data FROM render_events WHERE tenant_id=$1 AND job_id=$2 AND sequence>$3 ORDER BY sequence LIMIT 100',
      [tenantId, id, afterSequence],
    );
    return result.rows.map((row) => row.data);
  }
  async claimNext(workerId: string, leaseMs: number) {
    const result = await this.pool.query<{
      id: string;
      job_id: string;
      tenant_id: string;
      attempt: number;
    }>(
      `WITH candidate AS (SELECT id FROM render_outbox WHERE attempt < 10 AND ((state='pending' AND available_at<=now()) OR (state='leased' AND lease_until<now())) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE render_outbox o SET state='leased',worker_id=$1,lease_until=now()+($2::text||' milliseconds')::interval,attempt=o.attempt+1,updated_at=now() FROM candidate WHERE o.id=candidate.id RETURNING o.id,o.job_id,o.tenant_id,o.attempt`,
      [workerId, leaseMs],
    );
    const row = result.rows[0];
    return row
      ? { id: row.id, jobId: row.job_id, tenantId: row.tenant_id, workerId, attempt: row.attempt }
      : undefined;
  }
  async advance(
    work: ClaimedWork,
    status: RenderStatus,
    progress: number,
    stage: string,
    artifact?: ArtifactReceipt,
  ) {
    return this.transaction(async (client) => {
      const locked = await client.query<{ snapshot: RenderJob }>(
        "SELECT j.snapshot FROM render_jobs j JOIN render_outbox o ON o.job_id=j.id WHERE j.id=$1 AND j.tenant_id=$2 AND o.id=$3 AND o.worker_id=$4 AND o.state='leased' FOR UPDATE",
        [work.jobId, work.tenantId, work.id, work.workerId],
      );
      if (!locked.rowCount) return;
      const next = new RenderJobAggregate(locked.rows[0]!.snapshot).advance(
        status,
        progress,
        stage,
        artifact,
      );
      next.attempt = work.attempt;
      await client.query(
        'UPDATE render_jobs SET status=$1,snapshot=$2,updated_at=now() WHERE id=$3',
        [status, next, work.jobId],
      );
      const event: RenderEvent = {
        id: crypto.randomUUID(),
        jobId: next.id,
        tenantId: next.tenantId,
        sequence: next.sequence,
        type: 'render.progress',
        data: next,
        createdAt: next.updatedAt,
      };
      await client.query(
        'INSERT INTO render_events(id,job_id,tenant_id,sequence,event_type,data) VALUES($1,$2,$3,$4,$5,$6)',
        [event.id, next.id, next.tenantId, event.sequence, event.type, event],
      );
      if (status === 'ready')
        await client.query(
          'INSERT INTO artifacts(job_id,tenant_id,url,checksum) VALUES($1,$2,$3,$4) ON CONFLICT(job_id) DO NOTHING',
          [next.id, next.tenantId, next.artifactUrl, next.artifactChecksum],
        );
      await client.query(
        "UPDATE render_outbox SET state=$1,worker_id=CASE WHEN $1='complete' THEN NULL ELSE worker_id END,lease_until=CASE WHEN $1='complete' THEN NULL ELSE now()+interval '5 seconds' END,updated_at=now() WHERE id=$2",
        [status === 'ready' || status === 'failed' ? 'complete' : 'leased', work.id],
      );
      return next;
    });
  }
  async release(work: ClaimedWork, error?: string) {
    await this.pool.query(
      "UPDATE render_outbox SET state='pending',worker_id=NULL,lease_until=NULL,last_error=$1,available_at=now()+interval '1 second',updated_at=now() WHERE id=$2 AND worker_id=$3",
      [error ?? null, work.id, work.workerId],
    );
  }
  async activeCount(tenantId: string) {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM render_jobs WHERE tenant_id=$1 AND status NOT IN ('ready','failed')",
      [tenantId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
