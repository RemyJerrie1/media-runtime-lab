import { describe, expect, it } from 'vitest';
import { InMemoryWorkflowStore } from '../infrastructure/in-memory-render.repository';
import { OperationsTelemetry } from './operations-telemetry';
import { RenderOrchestrator } from './render-orchestrator';
const command = {
  projectId: 'portfolio',
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
  },
  narration: 'Deterministic media execution',
  idempotencyKey: 'same-command',
};
function setup() {
  const store = new InMemoryWorkflowStore();
  const orchestrator = new RenderOrchestrator(store, new OperationsTelemetry());
  return { store, orchestrator };
}
describe('render orchestration', () => {
  it('returns one identity under concurrent duplicate commands', async () => {
    const { orchestrator } = setup();
    const [first, repeated] = await Promise.all([
      orchestrator.create('tenant-1', command, 'trace-1', 50000),
      orchestrator.create('tenant-1', command, 'trace-2', 50000),
    ]);
    expect(repeated.id).toBe(first.id);
  });
  it('completes through one leased attempt and persists the FFmpeg plan', async () => {
    const { store, orchestrator } = setup();
    const job = await orchestrator.create(
      'tenant-1',
      { ...command, idempotencyKey: 'complete-command' },
      'trace-1',
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
    const job = await orchestrator.create('tenant-a', command, 'trace-1', 50000);
    expect(await orchestrator.get('tenant-b', job.id)).toBeUndefined();
    await expect(
      orchestrator.create(
        'tenant-a',
        { ...command, idempotencyKey: 'quota-command' },
        'trace-2',
        1,
      ),
    ).rejects.toThrow('TENANT_QUOTA_EXCEEDED');
  });
});
