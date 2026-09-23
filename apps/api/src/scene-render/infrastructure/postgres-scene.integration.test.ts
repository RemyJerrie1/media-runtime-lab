import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PostgresSceneStore } from './postgres-scene.store';
import { SceneWorker } from '../application/scene-worker';
import { sceneCommand, testReceipt } from './scene-fixture';
import { createSceneRenderSchema } from '@media-lab/contracts';
import { sceneFingerprint } from '../domain/scene-workflow';
const suite = process.env.DATABASE_URL ? describe : describe.skip;
suite('durable scene rendering', () => {
  let admin: Pool;
  let store: PostgresSceneStore;
  let other: PostgresSceneStore;
  let schema: string;
  beforeEach(async () => {
    admin = new Pool({ connectionString: process.env.DATABASE_URL! });
    schema = `scene_test_${crypto.randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    store = new PostgresSceneStore(url.toString());
    other = new PostgresSceneStore(url.toString());
    await store.initialize();
    await other.initialize();
  });
  afterEach(async () => {
    await store?.onApplicationShutdown();
    await other?.onApplicationShutdown();
    if (/^scene_test_[a-f0-9]{32}$/.test(schema))
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const expire = (id: string) =>
    admin.query(
      `UPDATE ${schema}.scene_render_jobs SET lease_until=now()-interval '1 second' WHERE id=$1`,
      [id],
    );
  it('deduplicates concurrent commands, rejects changed scenes and isolates tenants', async () => {
    const command = sceneCommand();
    const jobs = await Promise.all(
      Array.from({ length: 12 }, (_, i) => (i % 2 ? store : other).create('a', command)),
    );
    expect(new Set(jobs.map((job) => job.id)).size).toBe(1);
    command.scene.transform.x = 0.5;
    await expect(store.create('a', command)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(await store.get('b', jobs[0]!.id)).toBeUndefined();
    expect((await other.get('a', jobs[0]!.id))!.scene.transform.x).toBe(-1.2);
  });
  it('retries an existing hamster-2 operation after the renderer upgrade without a conflict', async () => {
    const base = sceneCommand();
    const command = createSceneRenderSchema.parse({
      ...base,
      scene: { ...base.scene, version: 4, audio: null },
    });
    const job = await store.create('a', command);
    const previous = {
      ...job,
      rendererVersion: 'hamster-2',
      sceneFingerprint: sceneFingerprint(command, 'hamster-2'),
    };
    await admin.query(
      `UPDATE ${schema}.scene_render_jobs SET snapshot=$1, fingerprint=$2 WHERE id=$3`,
      [previous, previous.sceneFingerprint, job.id],
    );
    expect(await other.create('a', command)).toEqual(previous);
    const changed = createSceneRenderSchema.parse({
      ...command,
      scene: { ...command.scene, background: '#000000' },
    });
    await expect(other.create('a', changed)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    const fresh = await store.create('a', { ...command, idempotencyKey: crypto.randomUUID() });
    expect(fresh.rendererVersion).toBe('hamster-3');
  });
  it('persists audio identity and settings in the immutable idempotent snapshot', async () => {
    const base = sceneCommand();
    const id = crypto.randomUUID();
    const command = createSceneRenderSchema.parse({
      ...base,
      scene: {
        ...base.scene,
        version: 4,
        audio: {
          asset: {
            id,
            url: `/scene-audio/${id}.wav`,
            checksum: `sha256:${'a'.repeat(64)}`,
            sizeBytes: 5000,
            durationSeconds: 3,
          },
          trimStart: 0.5,
          start: 1,
          volume: 0.5,
          muted: false,
        },
      },
    });
    const job = await store.create('a', command);
    expect((await other.create('a', command)).id).toBe(job.id);
    if (command.scene.version !== 4 || !command.scene.audio) throw new Error('fixture');
    for (const patch of [
      { volume: 0.3 },
      { start: 2 },
      { trimStart: 1 },
      { muted: true },
      { asset: { ...command.scene.audio.asset, checksum: `sha256:${'b'.repeat(64)}` } },
    ]) {
      const changed = createSceneRenderSchema.parse({
        ...command,
        scene: { ...command.scene, audio: { ...command.scene.audio, ...patch } },
      });
      await expect(other.create('a', changed)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    }
    expect((await other.get('a', job.id))?.scene).toEqual(command.scene);
    const lease = (await store.claim('audio-worker', 10000))!;
    await store.update(lease, { status: 'encoding', frames: 120 });
    const receipt = { ...testReceipt(job.sceneFingerprint), rendererVersion: 'hamster-3' as const };
    await expect(store.update(lease, { status: 'ready', frames: 120, receipt })).rejects.toThrow(
      'SCENE_RECEIPT_MISMATCH',
    );
    expect(
      await store.update(lease, {
        status: 'ready',
        frames: 120,
        receipt: { ...receipt, audioStreams: 1 },
      }),
    ).toBe(true);
    expect((await other.get('a', job.id))?.receipt?.audioStreams).toBe(1);
  });
  it('fences expired workers, serializes slots and keeps a ready receipt immutable', async () => {
    const job = await store.create('a', sceneCommand());
    const stale = (await store.claim('old', 10000))!;
    expect(await other.claim('new', 10000)).toBeUndefined();
    await expire(job.id);
    const next = (await other.claim('new', 10000))!;
    expect(next.job.attempt).toBe(2);
    expect(await store.renew(stale, 10000)).toBe(false);
    expect(await store.update(stale, { status: 'failed', frames: 0 })).toBe(false);
    await other.update(next, { status: 'encoding', frames: 120 });
    const receipt = testReceipt(job.sceneFingerprint);
    expect(await other.update(next, { status: 'ready', frames: 120, receipt })).toBe(true);
    expect(
      await store.update(stale, {
        status: 'ready',
        frames: 120,
        receipt: testReceipt(job.sceneFingerprint),
      }),
    ).toBe(false);
    await store.retry('a', job.id, 2);
    await store.cancel('a', job.id);
    expect((await store.get('a', job.id))!.receipt).toEqual(receipt);
  });
  it('worker failures stay failed, explicit retry is idempotent and snapshot stays fixed', async () => {
    const job = await store.create('a', sceneCommand());
    const worker = new SceneWorker(store, {
      render: async () => {
        throw new Error('SCENE_FONT_UNAVAILABLE');
      },
      discard: async () => {},
    });
    expect(await worker.processNext()).toBe(false);
    const failed = (await store.get('a', job.id))!;
    expect(failed.status).toBe('failed');
    expect(failed.receipt).toBeNull();
    expect(failed.error).toContain('FONT');
    await Promise.all([store.retry('a', job.id, 1), other.retry('a', job.id, 1)]);
    const next = (await store.claim('retry', 10000))!;
    await store.retry('a', job.id, 1);
    expect((await store.get('a', job.id))!.status).toBe('rendering');
    expect(next.job.attempt).toBe(2);
    expect(next.job.scene).toEqual(job.scene);
    await store.cancel('a', job.id);
    expect(await store.update(next, { status: 'encoding', frames: 120 })).toBe(false);
    expect((await store.get('a', job.id))!.status).toBe('cancelled');
  });
  it('recovers a crash on the final attempt to a terminal failure', async () => {
    const job = await store.create('a', sceneCommand());
    for (let n = 0; n < 3; n++) {
      await store.claim(`crash-${n}`, 10000);
      await expire(job.id);
    }
    let rendered = false;
    const worker = new SceneWorker(store, {
      render: async () => {
        rendered = true;
        return testReceipt(job.sceneFingerprint);
      },
      discard: async () => {},
    });
    await worker.processNext();
    expect(rendered).toBe(false);
    expect((await store.get('a', job.id))!.error).toBe('SCENE_ATTEMPTS_EXHAUSTED');
  });
  it('discarded stale receipts cannot remove the winning artifact', async () => {
    const job = await store.create('a', sceneCommand());
    const staleReceipt = testReceipt(job.sceneFingerprint);
    const winner = testReceipt(job.sceneFingerprint);
    const discarded: string[] = [];
    const worker = new SceneWorker(store, {
      render: async () => {
        await expire(job.id);
        const next = (await other.claim('winner', 10000))!;
        await other.update(next, { status: 'encoding', frames: 120 });
        await other.update(next, { status: 'ready', frames: 120, receipt: winner });
        return staleReceipt;
      },
      discard: async (receipt) => {
        discarded.push(receipt.artifactUrl);
      },
    });
    await worker.processNext();
    expect(discarded).toEqual([staleReceipt.artifactUrl]);
    expect((await store.get('a', job.id))!.receipt).toEqual(winner);
  });
  it('lost commit acknowledgement preserves the published artifact', async () => {
    const job = await store.create('a', sceneCommand());
    const receipt = testReceipt(job.sceneFingerprint);
    const update = store.update.bind(store);
    store.update = async (work, value) => {
      const committed = await update(work, value);
      if (value.status === 'ready' && committed) throw new Error('connection lost after commit');
      return committed;
    };
    let discarded = false;
    const worker = new SceneWorker(store, {
      render: async (_job, _signal, progress) => {
        await progress(120, true);
        return receipt;
      },
      discard: async () => {
        discarded = true;
      },
    });
    await worker.processNext();
    expect((await store.get('a', job.id))!.receipt).toEqual(receipt);
    expect(discarded).toBe(false);
  });
  it('bounds pending operations and rejects quota-bypassing retries', async () => {
    const failed = await store.create('a', sceneCommand());
    const work = (await store.claim('failure', 10000))!;
    await store.update(work, { status: 'failed', frames: 0, error: 'failure' });
    for (let i = 0; i < 3; i++) await store.create('a', sceneCommand());
    await expect(store.create('a', sceneCommand())).rejects.toThrow('SCENE_QUEUE_FULL');
    await expect(store.retry('a', failed.id, 1)).rejects.toThrow('SCENE_QUEUE_FULL');
  });
});
