import { Pool, type PoolClient } from 'pg';
import {
  createSceneRenderSchema,
  sceneRenderJobSchema,
  type CreateSceneRender,
  type SceneRenderJob,
} from '@media-lab/contracts';
import {
  advanceScene,
  newSceneJob,
  sceneFingerprint,
  type SceneStore,
  type SceneLease,
  type SceneUpdate,
} from '../domain/scene-workflow';

export class PostgresSceneStore implements SceneStore {
  private pool: Pool | undefined;
  constructor(connectionString?: string) {
    if (connectionString)
      this.pool = new Pool({ connectionString, max: 4, statement_timeout: 5000 });
  }
  private db() {
    if (!this.pool) throw new Error('SCENE_DATABASE_REQUIRED');
    return this.pool;
  }
  async initialize() {
    if (!this.pool) return;
    await this.pool.query(`CREATE TABLE IF NOT EXISTS scene_render_jobs (
      id uuid PRIMARY KEY, tenant text NOT NULL, idempotency_key text NOT NULL,
      fingerprint text NOT NULL, snapshot jsonb NOT NULL, owner text, lease_until timestamptz,
      retry_limit integer NOT NULL DEFAULT 3, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(tenant, idempotency_key));`);
  }
  async onApplicationShutdown() {
    await this.pool?.end();
  }
  private async tx<T>(run: (client: PoolClient) => Promise<T>) {
    const client = await this.db().connect();
    try {
      await client.query('BEGIN');
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async create(tenant: string, input: CreateSceneRender) {
    const command = createSceneRenderSchema.parse(input);
    return this.tx(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['scene-create:' + tenant]);
      const old = await client.query(
        'SELECT snapshot,fingerprint FROM scene_render_jobs WHERE tenant=$1 AND idempotency_key=$2',
        [tenant, command.idempotencyKey],
      );
      if (old.rowCount) {
        if (
          old.rows[0].fingerprint !==
          sceneFingerprint(
            command,
            sceneRenderJobSchema.parse(old.rows[0].snapshot).rendererVersion,
          )
        )
          throw new Error('IDEMPOTENCY_CONFLICT');
        return sceneRenderJobSchema.parse(old.rows[0].snapshot);
      }
      const active = await client.query(
        "SELECT count(*) FROM scene_render_jobs WHERE tenant=$1 AND snapshot->>'status' IN ('accepted','rendering','encoding')",
        [tenant],
      );
      if (Number(active.rows[0].count) >= 3) throw new Error('SCENE_QUEUE_FULL');
      const job = newSceneJob(command);
      await client.query(
        'INSERT INTO scene_render_jobs(id,tenant,idempotency_key,fingerprint,snapshot) VALUES($1,$2,$3,$4,$5)',
        [job.id, tenant, command.idempotencyKey, job.sceneFingerprint, job],
      );
      return job;
    });
  }
  async get(tenant: string, id: string) {
    const result = await this.db().query(
      'SELECT snapshot FROM scene_render_jobs WHERE tenant=$1 AND id=$2',
      [tenant, id],
    );
    return result.rows[0] ? sceneRenderJobSchema.parse(result.rows[0].snapshot) : undefined;
  }
  async claim(owner: string, leaseMs: number) {
    if (!this.pool) return;
    return this.tx(async (client) => {
      // A single durable rendering slot, shared across API/worker processes.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('scene-render-slot'))");
      const busy = await client.query(
        'SELECT id FROM scene_render_jobs WHERE owner IS NOT NULL AND lease_until>clock_timestamp() LIMIT 1',
      );
      if (busy.rowCount) return;
      const candidate = await client.query(
        "SELECT * FROM scene_render_jobs WHERE snapshot->>'status' IN ('accepted','rendering','encoding') AND (owner IS NULL OR lease_until<clock_timestamp()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      );
      const row = candidate.rows[0];
      if (!row) return;
      const current = sceneRenderJobSchema.parse(row.snapshot);
      const job: SceneRenderJob = {
        ...current,
        status: 'rendering',
        completedFrames: 0,
        attempt: current.attempt + 1,
        sequence: current.sequence + 1,
        error: null,
        receipt: null,
        updatedAt: new Date().toISOString(),
      };
      await client.query(
        "UPDATE scene_render_jobs SET snapshot=$1,owner=$2,lease_until=clock_timestamp()+($3::text||' milliseconds')::interval WHERE id=$4",
        [job, owner, leaseMs, job.id],
      );
      return { job, owner, tenant: row.tenant as string, retryLimit: row.retry_limit as number };
    });
  }
  async renew(work: SceneLease, leaseMs: number) {
    const result = await this.db().query(
      "UPDATE scene_render_jobs SET lease_until=clock_timestamp()+($1::text||' milliseconds')::interval WHERE id=$2 AND tenant=$3 AND owner=$4 AND (snapshot->>'attempt')::int=$5 AND lease_until>clock_timestamp() AND snapshot->>'status' IN ('rendering','encoding')",
      [leaseMs, work.job.id, work.tenant, work.owner, work.job.attempt],
    );
    return result.rowCount === 1;
  }
  async update(work: SceneLease, update: SceneUpdate) {
    return this.tx(async (client) => {
      const result = await client.query(
        "SELECT snapshot FROM scene_render_jobs WHERE id=$1 AND tenant=$2 AND owner=$3 AND (snapshot->>'attempt')::int=$4 AND lease_until>clock_timestamp() AND snapshot->>'status' IN ('rendering','encoding') FOR UPDATE",
        [work.job.id, work.tenant, work.owner, work.job.attempt],
      );
      if (!result.rowCount) return false;
      const job = advanceScene(sceneRenderJobSchema.parse(result.rows[0].snapshot), update);
      const terminal = ['ready', 'failed'].includes(job.status);
      await client.query(
        'UPDATE scene_render_jobs SET snapshot=$1,owner=CASE WHEN $2 THEN NULL ELSE owner END,lease_until=CASE WHEN $2 THEN NULL ELSE lease_until END WHERE id=$3',
        [job, terminal, job.id],
      );
      return true;
    });
  }
  private async action(tenant: string, id: string, expectedAttempt?: number) {
    return this.tx(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['scene-create:' + tenant]);
      const result = await client.query(
        'SELECT snapshot FROM scene_render_jobs WHERE tenant=$1 AND id=$2 FOR UPDATE',
        [tenant, id],
      );
      if (!result.rowCount) return;
      const job = sceneRenderJobSchema.parse(result.rows[0].snapshot);
      if (expectedAttempt !== undefined) {
        if (job.status !== 'failed' || job.attempt !== expectedAttempt) return job;
        const active = await client.query(
          "SELECT count(*) FROM scene_render_jobs WHERE tenant=$1 AND snapshot->>'status' IN ('accepted','rendering','encoding')",
          [tenant],
        );
        if (Number(active.rows[0].count) >= 3) throw new Error('SCENE_QUEUE_FULL');
        job.status = 'accepted';
        job.completedFrames = 0;
        job.error = null;
      } else {
        if (['ready', 'failed', 'cancelled'].includes(job.status)) return job;
        job.status = 'cancelled';
        job.error = 'SCENE_CANCELLED';
      }
      job.sequence++;
      job.updatedAt = new Date().toISOString();
      await client.query(
        'UPDATE scene_render_jobs SET snapshot=$1,owner=NULL,lease_until=NULL,retry_limit=$2 WHERE id=$3',
        [job, job.attempt + 3, id],
      );
      return job;
    });
  }
  retry(tenant: string, id: string, expectedAttempt: number) {
    return this.action(tenant, id, expectedAttempt);
  }
  cancel(tenant: string, id: string) {
    return this.action(tenant, id);
  }
}
