import type { RenderJob, RenderStatus } from '@media-lab/contracts';

const transitions: Record<RenderStatus, RenderStatus[]> = {
  accepted: ['composing', 'failed'],
  composing: ['encoding', 'failed'],
  encoding: ['packaging', 'failed'],
  packaging: ['ready', 'failed'],
  ready: [],
  failed: [],
};

export class RenderJobAggregate {
  constructor(private state: RenderJob) {}
  snapshot(): RenderJob {
    return structuredClone(this.state);
  }
  advance(status: RenderStatus, progress: number, stage: string): RenderJob {
    if (!transitions[this.state.status]!.includes(status))
      throw new Error(`INVALID_TRANSITION:${this.state.status}->${status}`);
    const ready = status === 'ready';
    this.state = {
      ...this.state,
      status,
      progress,
      stage,
      sequence: this.state.sequence + 1,
      updatedAt: new Date().toISOString(),
      artifactUrl: ready ? `/artifacts/${this.state.id}.mp4` : this.state.artifactUrl,
      artifactChecksum: ready
        ? `sha256:${this.state.id.replaceAll('-', '').padEnd(64, '0').slice(0, 64)}`
        : this.state.artifactChecksum,
    };
    return this.snapshot();
  }
}
