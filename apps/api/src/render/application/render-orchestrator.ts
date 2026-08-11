import { Injectable } from '@nestjs/common';
import type { CreateRenderJob, RenderJob, RenderStatus } from '@media-lab/contracts';
import { Subject } from 'rxjs';
import { RenderJobAggregate } from '../domain/render-job';
import { InMemoryRenderRepository } from '../infrastructure/in-memory-render.repository';

@Injectable()
export class RenderOrchestrator {
  private readonly streams = new Map<string,Subject<RenderJob>>();
  constructor(private readonly repo:InMemoryRenderRepository){}
  create(command:CreateRenderJob):RenderJob{
    const existing=this.repo.findByIdempotencyKey(command.idempotencyKey); if(existing)return existing;
    const job:RenderJob={id:crypto.randomUUID(),projectId:command.projectId,status:'accepted',progress:4,stage:'Contract accepted',estimatedCostUsd:Number((command.durationSeconds*0.0018).toFixed(3)),tokens:Math.ceil(command.narration.length*1.4),artifactUrl:null,updatedAt:new Date().toISOString()};
    this.repo.save(job,command.idempotencyKey); this.streams.set(job.id,new Subject()); void this.run(job.id); return job;
  }
  get(id:string){ return this.repo.findById(id); }
  events(id:string){ return this.streams.get(id)?.asObservable(); }
  private async run(id:string){
    const steps:Array<[RenderStatus,number,string,number]>=[['composing',26,'Deterministic scene composition',450],['encoding',58,'FFmpeg encode + subtitle burn-in',650],['packaging',84,'Artifact checksum + metadata',550],['ready',100,'Delivery-ready artifact',450]];
    for(const [status,progress,stage,delay] of steps){ await new Promise(r=>setTimeout(r,delay)); const current=this.repo.findById(id); if(!current)return; const next=new RenderJobAggregate(current).advance(status,progress,stage); this.repo.save(next); this.streams.get(id)?.next(next); }
    this.streams.get(id)?.complete();
  }
}
