import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactReceipt } from '../domain/workflow-store';
import type { MediaProcessor } from '../domain/media-processor';
import { InMemoryWorkflowStore } from '../infrastructure/in-memory-render.repository';
import { OperationsTelemetry } from './operations-telemetry';
import { RenderOrchestrator } from './render-orchestrator';
const command = {
  projectId: 'portfolio',
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
  narration: 'Deterministic media execution',
  idempotencyKey: 'same-command',
};
function setup() {
  const store = new InMemoryWorkflowStore();
  const processor: MediaProcessor = {
    render: async (job: { id: string }) => ({
      artifactUrl: `/artifacts/${job.id}.mp4`,
      artifactChecksum: `sha256:${'a'.repeat(64)}`,
      manifestUrl: null,
      renditions: [],
    }),
  };
  const orchestrator = new RenderOrchestrator(store, new OperationsTelemetry(), processor as never);
  return { store, orchestrator, processor };
}
describe('render orchestration', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('renews a long render so a second worker cannot claim it', async () => {
    vi.useFakeTimers();
    const { store, orchestrator, processor } = setup();
    let finish!: (receipt: ArtifactReceipt) => void;
    vi.spyOn(processor, 'render').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const job = await orchestrator.create('tenant-1', command, 'trace', 'request', 50000);
    const processing = orchestrator.processNext('worker-1', false);
    await vi.advanceTimersByTimeAsync(12000);
    expect(await store.claimNext('worker-2', 5000)).toBeUndefined();
    finish({
      artifactUrl: '/artifacts/receipt.mp4',
      artifactChecksum: 'sha256:a',
      manifestUrl: null,
      renditions: [],
    });
    expect(await processing).toBe(true);
    expect(await orchestrator.get('tenant-1', job.id)).toMatchObject({
      status: 'ready',
      attempt: 1,
    });
  });
  it('aborts rendering when renewal fails and does not publish a stale receipt', async () => {
    vi.useFakeTimers();
    const { store, orchestrator, processor } = setup();
    let aborted = false;
    vi.spyOn(processor, 'render').mockImplementation(
      (...args: unknown[]) =>
        new Promise((_resolve, reject) => {
          const signal = args[1] as AbortSignal;
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    );
    vi.spyOn(store, 'renew').mockResolvedValue(false);
    const job = await orchestrator.create('tenant-1', command, 'trace', 'request', 50000);
    const processing = orchestrator.processNext('worker-1', false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await processing).toBe(false);
    expect(aborted).toBe(true);
    expect((await orchestrator.get('tenant-1', job.id))?.artifactUrl).toBeNull();
  });
  it('terminates repeated failures and persists a terminal event after ten attempts', async () => {
    vi.useFakeTimers();
    const { store, orchestrator, processor } = setup();
    vi.spyOn(processor, 'render').mockRejectedValue(new Error('FFMPEG_FAILED'));
    const job = await orchestrator.create('tenant-1', command, 'trace', 'request', 50000);
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect(await orchestrator.processNext('worker-1', false)).toBe(false);
      await vi.advanceTimersByTimeAsync(60000);
    }
    expect(processor.render).toHaveBeenCalledTimes(10);
    expect(await orchestrator.get('tenant-1', job.id)).toMatchObject({
      status: 'failed',
      attempt: 10,
    });
    expect((await store.listEvents('tenant-1', job.id, 0)).at(-1)?.data.status).toBe('failed');
    expect(await store.activeCount('tenant-1')).toBe(0);
    expect(await store.claimNext('worker-2', 5000)).toBeUndefined();
  });
  it('finalizes a crash on the last allowed attempt without rendering again', async () => {
    vi.useFakeTimers();
    const { store, orchestrator, processor } = setup();
    const render = vi.spyOn(processor, 'render');
    const job = await orchestrator.create('tenant-1', command, 'trace', 'request', 50000);
    for (let attempt = 1; attempt <= 10; attempt++) {
      expect((await store.claimNext('crashed-worker', 5))?.attempt).toBe(attempt);
      await vi.advanceTimersByTimeAsync(10);
    }
    await orchestrator.processNext('recovery-worker', false);
    expect(render).not.toHaveBeenCalled();
    expect(await orchestrator.get('tenant-1', job.id)).toMatchObject({ status: 'failed' });
  });
  it('fences an expired lease and an old attempt even when worker IDs are reused', async () => {
    vi.useFakeTimers();
    const { store, orchestrator } = setup();
    await orchestrator.create('tenant-1', command, 'trace', 'request', 50000);
    const old = (await store.claimNext('worker', 5))!;
    await vi.advanceTimersByTimeAsync(10);
    expect(await store.renew(old, 5000)).toBe(false);
    expect(await store.advance(old, 'composing', 26, 'expired')).toBeUndefined();
    const fresh = (await store.claimNext('worker', 5000))!;
    expect(await store.renew(old, 5000)).toBe(false);
    await store.release(old);
    expect(await store.advance(old, 'composing', 26, 'stale')).toBeUndefined();
    expect(await store.advance(fresh, 'composing', 26, 'owned')).toMatchObject({ attempt: 2 });
  });
  it('returns one identity under concurrent duplicate commands', async () => {
    const { orchestrator } = setup();
    const [first, repeated] = await Promise.all([
      orchestrator.create('tenant-1', command, 'trace-1', 'request-1', 50000),
      orchestrator.create('tenant-1', command, 'trace-2', 'request-2', 50000),
    ]);
    expect(repeated.id).toBe(first.id);
  });
  it('completes through one leased attempt and persists the FFmpeg plan', async () => {
    const { store, orchestrator } = setup();
    const job = await orchestrator.create(
      'tenant-1',
      { ...command, idempotencyKey: 'complete-command' },
      'trace-1',
      'request-1',
      50000,
    );
    expect(job.ffmpegArgs).toContain('-crf');
    expect(await orchestrator.processNext('worker-1', false)).toBe(true);
    expect(await orchestrator.get('tenant-1', job.id)).toMatchObject({
      status: 'ready',
      progress: 100,
      attempt: 1,
      artifactUrl: `/artifacts/${job.id}.mp4`,
      sequence: 5,
    });
    const events = await store.listEvents('tenant-1', job.id, 2);
    expect(events.map((event) => event.sequence)).toEqual([3, 4, 5]);
  });
  it('enforces tenant isolation and attributed token quota', async () => {
    const { orchestrator } = setup();
    const job = await orchestrator.create('tenant-a', command, 'trace-1', 'request-1', 50000);
    expect(await orchestrator.get('tenant-b', job.id)).toBeUndefined();
    await expect(
      orchestrator.create(
        'tenant-a',
        { ...command, idempotencyKey: 'quota-command' },
        'trace-2',
        'request-2',
        1,
      ),
    ).rejects.toThrow('TENANT_QUOTA_EXCEEDED');
  });
});

describe('idempotency intent integrity', () => {
  const input = {
    tenantId: 'tenant',
    traceId: 'trace',
    requestId: 'request',
    quotaTokens: 50000,
    command,
  };
  it.each([
    { durationSeconds: 19 },
    { narration: 'Different narration content!' },
    { projectId: 'different-project' },
    { sourceAssetId: '00000000-0000-4000-8000-000000000001' },
    { encoding: { ...command.encoding, crf: 30 } },
    { processing: { ...command.processing, watermarkMode: 'none' as const } },
  ])('rejects changed intent without another event or job: %j', async (change) => {
    const store = new InMemoryWorkflowStore();
    const first = await store.create(input);
    await expect(store.create({ ...input, command: { ...command, ...change } })).rejects.toThrow(
      'IDEMPOTENCY_CONFLICT',
    );
    expect(await store.activeCount(input.tenantId)).toBe(1);
    expect(await store.listEvents(input.tenantId, first.job.id, 0)).toHaveLength(1);
  });
  it('accepts reordered fields and changed trace context, isolates tenants and fresh keys', async () => {
    const store = new InMemoryWorkflowStore();
    const first = await store.create(input);
    const reversed = Object.fromEntries(Object.entries(command.encoding).reverse());
    const reordered = { ...command, encoding: reversed as typeof command.encoding };
    expect(
      await store.create({ ...input, command: reordered, traceId: 'another-trace' }),
    ).toMatchObject({ created: false, job: { id: first.job.id } });
    expect((await store.create({ ...input, tenantId: 'another-tenant' })).created).toBe(true);
    expect(
      (await store.create({ ...input, command: { ...command, idempotencyKey: 'new-operation' } }))
        .created,
    ).toBe(true);
  });
});
