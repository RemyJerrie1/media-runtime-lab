import type { CreateWorkflow } from '../domain/workflow-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { RenderOrchestrator } from '../application/render-orchestrator';
import { OperationsTelemetry } from '../application/operations-telemetry';
import { PostgresWorkflowStore } from './postgres-workflow.store';
const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
suite('PostgreSQL workflow integration', () => {
  const stores: PostgresWorkflowStore[] = [];
  let admin: Pool;
  let schema: string;
  let isolatedUrl: string;
  beforeEach(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    schema = `workflow_test_${crypto.randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    isolatedUrl = url.toString();
  });
  const createStore = () => {
    const store = new PostgresWorkflowStore(isolatedUrl);
    stores.push(store);
    return store;
  };
  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.onApplicationShutdown()));
    if (admin) {
      if (/^workflow_test_[a-f0-9]{32}$/.test(schema))
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  });
  it('survives repository restart, deduplicates concurrent instances, and reclaims expired work', async () => {
    const firstStore = createStore();
    const secondStore = createStore();
    await firstStore.initialize();
    await secondStore.initialize();
    const key = `integration-${crypto.randomUUID()}`;
    const input = {
      tenantId: 'integration-tenant',
      traceId: 'trace-integration',
      requestId: 'request-integration',
      quotaTokens: 50000,
      command: {
        projectId: 'integration',
        sourceAssetId: '8eb8e256-8904-4b9f-8488-10b617e7068a',
        template: 'landscape' as const,
        trimStartSeconds: 0,
        durationSeconds: 18,
        encoding: {
          codec: 'libx264' as const,
          preset: 'medium' as const,
          rateControl: 'crf' as const,
          crf: 23,
          bitrateKbps: 4000,
          gop: 60,
          fps: 30,
        },
        processing: {
          frameRateMode: 'cfr' as const,
          audioSampleRate: 48000 as const,
          audioSync: 'async-resample' as const,
          subtitleMode: 'webvtt' as const,
          watermarkMode: 'visible' as const,
          adInsertion: 'none' as const,
          fastStart: true,
          deliveryFormat: 'mp4' as const,
          abrLadder: 'none' as const,
          qualityMetric: 'none' as const,
        },
        narration: 'persistent workflow',
        idempotencyKey: key,
      },
    };
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        (index % 2 === 0 ? firstStore : secondStore).create({
          ...input,
          traceId: `trace-${index}`,
        }),
      ),
    );
    expect(new Set(results.map((result) => result.job.id)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    const first = results[0]!;
    expect(await secondStore.findById(input.tenantId, first.job.id)).toMatchObject({
      id: first.job.id,
      status: 'accepted',
    });
    const abandoned = await firstStore.claimNext('crashed-worker', 5);
    expect(abandoned?.jobId).toBe(first.job.id);
    await new Promise((resolve) => setTimeout(resolve, 15));
    const reclaimed = await secondStore.claimNext('recovery-worker', 5000);
    expect(reclaimed?.jobId).toBe(first.job.id);
    expect(reclaimed!.attempt).toBe(2);

    await expect(
      firstStore.advance(abandoned!, 'composing', 26, 'stale worker must be fenced'),
    ).resolves.toBeUndefined();
    await secondStore.advance(reclaimed!, 'composing', 26, 'composition resumed');
    await secondStore.advance(reclaimed!, 'encoding', 58, 'encoding resumed');
    await secondStore.advance(reclaimed!, 'packaging', 84, 'receipt persisted');
    await secondStore.advance(reclaimed!, 'ready', 100, 'workflow recovered', {
      artifactUrl: '/artifacts/receipt.mp4',
      artifactChecksum: 'sha256:test',
      manifestUrl: null,
      renditions: [],
    });

    const restartedStore = createStore();
    await restartedStore.initialize();
    expect(await restartedStore.findById(input.tenantId, first.job.id)).toMatchObject({
      status: 'ready',
      attempt: 2,
      sequence: 5,
    });
    const replayed = await restartedStore.listEvents(input.tenantId, first.job.id, 2);
    expect(replayed.map((event) => event.sequence)).toEqual([3, 4, 5]);
    expect(replayed.at(-1)?.data.status).toBe('ready');
  });
  async function seed() {
    const store = createStore();
    await store.initialize();
    const input: CreateWorkflow = {
      tenantId: 'lease-test',
      traceId: 'trace',
      requestId: 'request',
      quotaTokens: 50000,
      command: {
        projectId: 'lease-test',
        sourceAssetId: crypto.randomUUID(),
        template: 'landscape',
        trimStartSeconds: 0,
        durationSeconds: 1,
        encoding: {
          codec: 'libx264',
          preset: 'ultrafast',
          rateControl: 'crf',
          crf: 23,
          bitrateKbps: 600,
          gop: 24,
          fps: 24,
        },
        processing: {
          frameRateMode: 'cfr',
          audioSampleRate: 48000,
          audioSync: 'async-resample',
          subtitleMode: 'none',
          watermarkMode: 'none',
          adInsertion: 'none',
          fastStart: true,
          deliveryFormat: 'mp4',
          abrLadder: 'none',
          qualityMetric: 'none',
        },
        narration: 'lease integration test',
        idempotencyKey: crypto.randomUUID(),
      },
    };
    const { job } = await store.create(input);
    return { store, job, input };
  }
  it('keeps tenant isolation and deduplication with 100x persisted jobs', async () => {
    const { store, job, input } = await seed();
    const samples = [];
    for (const count of [10, 1000]) {
      const before = await store.activeCount(input.tenantId);
      for (let i = before; i < count; i++) {
        await store.create({
          ...input,
          quotaTokens: 1_000_000,
          command: { ...input.command, idempotencyKey: `scale-job-${i}` },
        });
      }
      const start = performance.now();
      expect(await store.activeCount(input.tenantId)).toBe(count);
      expect(await store.findById('another-tenant', job.id)).toBeUndefined();
      expect(await store.create(input)).toMatchObject({ created: false, job: { id: job.id } });
      const latencyMs = performance.now() - start;
      samples.push({ count, latencyMs, heapBytes: process.memoryUsage().heapUsed });
      // Three indexed operations must finish well below the pool's 5-second statement deadline.
      expect(latencyMs).toBeLessThan(1000);
    }
    const counts = await admin.query(
      `SELECT (SELECT count(*) FROM ${schema}.render_jobs) AS jobs, (SELECT count(*) FROM ${schema}.render_events) AS events, (SELECT count(*) FROM ${schema}.render_outbox) AS work`,
    );
    expect(counts.rows[0]).toEqual({ jobs: '1000', events: '1000', work: '1000' });
    console.info('workflow-scale-evidence', JSON.stringify(samples));
  }, 30_000);
  it('persists fingerprints across restart and rejects unverifiable legacy replays', async () => {
    const { job, input } = await seed();
    const restarted = createStore();
    await restarted.initialize();
    expect(await restarted.create(input)).toMatchObject({ created: false, job: { id: job.id } });
    await expect(
      restarted.create({
        ...input,
        command: { ...input.command, narration: 'different same key' },
      }),
    ).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await admin.query(`UPDATE ${schema}.render_jobs SET request_fingerprint=NULL WHERE id=$1`, [
      job.id,
    ]);
    await restarted.initialize();
    await expect(restarted.create(input)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect((await restarted.findById(input.tenantId, job.id))?.id).toBe(job.id);
    expect(await restarted.listEvents(input.tenantId, job.id, 0)).toHaveLength(1);
  });
  it('serializes conflicting concurrent requests across instances with one winner', async () => {
    const { input } = await seed();
    const one = createStore();
    const two = createStore();
    const command = { ...input.command, idempotencyKey: crypto.randomUUID() };
    const results = await Promise.allSettled([
      one.create({ ...input, command }),
      two.create({ ...input, command: { ...command, durationSeconds: 2 } }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason.message).toBe('IDEMPOTENCY_CONFLICT');
    const rows = await admin.query(
      `SELECT id FROM ${schema}.render_jobs WHERE idempotency_key=$1`,
      [command.idempotencyKey],
    );
    expect(rows.rowCount).toBe(1);
    expect(await one.listEvents(input.tenantId, rows.rows[0].id, 0)).toHaveLength(1);
  });
  it('renews ownership and fences expired leases and reused worker IDs', async () => {
    const { store } = await seed();
    const old = (await store.claimNext('same-worker', 5000))!;
    expect(await store.renew(old, 10000)).toBe(true);
    expect(await createStore().claimNext('other-worker', 5000)).toBeUndefined();
    await admin.query(`UPDATE ${schema}.render_outbox SET lease_until=now()-interval '1 second'`);
    expect(await store.renew(old, 5000)).toBe(false);
    expect(await store.advance(old, 'composing', 26, 'expired')).toBeUndefined();
    const fresh = (await store.claimNext('same-worker', 5000))!;
    expect(fresh.attempt).toBe(2);
    expect(await store.renew(old, 5000)).toBe(false);
    await store.release(old, 'stale error');
    expect(await store.advance(old, 'composing', 26, 'stale')).toBeUndefined();
    expect(await store.advance(fresh, 'composing', 26, 'valid')).toMatchObject({ attempt: 2 });
  });
  it('persists a failed terminal event after retry exhaustion', async () => {
    const { store, job } = await seed();
    const orchestrator = new RenderOrchestrator(store, new OperationsTelemetry(), {
      render: async () => {
        throw new Error('FFMPEG_FAILED');
      },
    });
    for (let attempt = 1; attempt <= 10; attempt++) {
      await orchestrator.processNext('worker', false);
      if (attempt < 10) {
        expect(await store.claimNext('too-early', 5000)).toBeUndefined();
        await admin.query(`UPDATE ${schema}.render_outbox SET available_at=now()`);
      }
    }
    expect(await store.findById(job.tenantId, job.id)).toMatchObject({
      status: 'failed',
      attempt: 10,
    });
    expect((await store.listEvents(job.tenantId, job.id, 0)).at(-1)?.data.status).toBe('failed');
    expect(await store.activeCount(job.tenantId)).toBe(0);
    expect(await store.claimNext('worker', 5000)).toBeUndefined();
  });
  it('finalizes a crash on the tenth attempt instead of leaving active work forever', async () => {
    const { store, job } = await seed();
    await admin.query(
      `UPDATE ${schema}.render_outbox SET state='leased',attempt=10,lease_until=now()-interval '1 second'`,
    );
    let rendered = false;
    const orchestrator = new RenderOrchestrator(store, new OperationsTelemetry(), {
      render: async () => {
        rendered = true;
        throw new Error('must not render');
      },
    });
    await orchestrator.processNext('recovery-worker', false);
    expect(rendered).toBe(false);
    expect(await store.findById(job.tenantId, job.id)).toMatchObject({
      status: 'failed',
      attempt: 11,
    });
  });
});
