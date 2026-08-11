import type { RenderJob, RenderStatus } from '@media-lab/contracts';

const transitions: Record<RenderStatus, RenderStatus[]> = {
  accepted:['composing','failed'], composing:['encoding','failed'], encoding:['packaging','failed'],
  packaging:['ready','failed'], ready:[], failed:[],
};

export class RenderJobAggregate {
  constructor(private state: RenderJob) {}
  snapshot(): RenderJob { return structuredClone(this.state); }
  advance(status: RenderStatus, progress: number, stage: string): RenderJob {
    if (!transitions[this.state.status]!.includes(status)) throw new Error(`INVALID_TRANSITION:${this.state.status}->${status}`);
    this.state = {...this.state,status,progress,stage,updatedAt:new Date().toISOString(),artifactUrl:status==='ready'?`/artifacts/${this.state.id}.mp4`:this.state.artifactUrl};
    return this.snapshot();
  }
}

export interface RenderJobRepository {
  findById(id:string): RenderJob | undefined;
  findByIdempotencyKey(key:string): RenderJob | undefined;
  save(job:RenderJob,key?:string): void;
}
