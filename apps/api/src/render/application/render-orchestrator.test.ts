import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryRenderRepository } from '../infrastructure/in-memory-render.repository';
import { RenderOrchestrator } from './render-orchestrator';

const command = {
  projectId: 'portfolio',
  template: 'landscape' as const,
  durationSeconds: 18,
  narration: 'Deterministic media execution',
  idempotencyKey: 'same-command',
};

describe('render orchestration', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the original job identity for a repeated idempotency key', () => {
    vi.useFakeTimers();
    const orchestrator = new RenderOrchestrator(new InMemoryRenderRepository());

    const first = orchestrator.create(command);
    const repeated = orchestrator.create(command);

    expect(repeated.id).toBe(first.id);
    expect(repeated.status).toBe('accepted');
  });

  it('publishes a delivery-ready artifact after legal state transitions', async () => {
    vi.useFakeTimers();
    const orchestrator = new RenderOrchestrator(new InMemoryRenderRepository());
    const job = orchestrator.create({ ...command, idempotencyKey: 'complete-command' });

    await vi.runAllTimersAsync();

    expect(orchestrator.get(job.id)).toMatchObject({
      status: 'ready',
      progress: 100,
      artifactUrl: `/artifacts/${job.id}.mp4`,
    });
  });
});
