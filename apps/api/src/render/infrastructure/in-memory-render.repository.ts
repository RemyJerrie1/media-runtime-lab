import { Injectable } from '@nestjs/common';
import type { RenderJob } from '@media-lab/contracts';
import type { RenderJobRepository } from '../domain/render-job';

@Injectable()
export class InMemoryRenderRepository implements RenderJobRepository {
  private readonly jobs = new Map<string,RenderJob>();
  private readonly keys = new Map<string,string>();
  findById(id:string){ return this.jobs.get(id); }
  findByIdempotencyKey(key:string){ const id=this.keys.get(key); return id?this.jobs.get(id):undefined; }
  save(job:RenderJob,key?:string){ this.jobs.set(job.id,structuredClone(job)); if(key)this.keys.set(key,job.id); }
}
