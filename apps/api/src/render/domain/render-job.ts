import type { RenderJob, RenderStatus } from '@media-lab/contracts';
import type { ArtifactReceipt } from './workflow-store';

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
  advance(
    status: RenderStatus,
    progress: number,
    stage: string,
    artifact?: ArtifactReceipt,
  ): RenderJob {
    if (!transitions[this.state.status]!.includes(status))
      throw new Error(`INVALID_TRANSITION:${this.state.status}->${status}`);
    const ready = status === 'ready';
    if (ready && !artifact) throw new Error('READY_REQUIRES_ARTIFACT');
    this.state = {
      ...this.state,
      status,
      progress,
      stage,
      sequence: this.state.sequence + 1,
      updatedAt: new Date().toISOString(),
      artifactUrl: ready ? artifact!.url : this.state.artifactUrl,
      artifactChecksum: ready ? artifact!.checksum : this.state.artifactChecksum,
    };
    return this.snapshot();
  }
}
