import { Inject, Injectable } from '@nestjs/common';
import type { CreateRenderJob, RenderEvent, RenderJob, RenderStatus } from '@media-lab/contracts';
import { Observable } from 'rxjs';
import { WORKFLOW_STORE, type WorkflowStore } from '../domain/workflow-store';
import { OperationsTelemetry } from './operations-telemetry';

const STEPS:Record<Exclude<RenderStatus,'ready'|'failed'>,{status:RenderStatus;progress:number;stage:(job:RenderJob)=>string;delay:number}>={accepted:{status:'composing',progress:26,stage:job=>`Trim ${job.trimStartSeconds}s → ${job.trimStartSeconds+job.durationSeconds}s + deterministic composition`,delay:180},composing:{status:'encoding',progress:58,stage:job=>`FFmpeg ${job.encoding.fps}fps · CRF ${job.encoding.crf} · GOP ${job.encoding.gop}`,delay:240},encoding:{status:'packaging',progress:84,stage:()=> 'Artifact checksum + encoding receipt',delay:220},packaging:{status:'ready',progress:100,stage:()=> 'Delivery-ready artifact',delay:180}};

@Injectable()
export class RenderOrchestrator {
  constructor(@Inject(WORKFLOW_STORE) private readonly store:WorkflowStore,@Inject(OperationsTelemetry) private readonly telemetry:OperationsTelemetry){}
  async create(tenantId:string,command:CreateRenderJob,traceId:string,quotaTokens:number){const result=await this.store.create({tenantId,command,traceId,quotaTokens});this.telemetry.command(result.job,result.created);return result.job;}
  get(tenantId:string,id:string){return this.store.findById(tenantId,id);}
  async processNext(workerId:string,withDelay=true){const work=await this.store.claimNext(workerId,5000);if(!work)return false;try{let current=await this.store.findById(work.tenantId,work.jobId);if(!current||current.status==='ready'||current.status==='failed')return false;while(current.status!=='ready'&&current.status!=='failed'){const step=STEPS[current.status];if(withDelay)await new Promise(resolve=>setTimeout(resolve,step.delay));const next=await this.store.advance(work,step.status,step.progress,step.stage(current));if(!next)throw new Error('WORK_LEASE_LOST');this.telemetry.transition(next);current=next;}return true;}catch(error){await this.store.release(work,error instanceof Error?error.message:'worker failure');return false;}}
  events(tenantId:string,id:string,afterSequence=0):Observable<RenderEvent>{return new Observable(subscriber=>{let cursor=afterSequence;let cancelled=false;let timer:NodeJS.Timeout|undefined;const poll=async()=>{if(cancelled)return;try{const events=await this.store.listEvents(tenantId,id,cursor);for(const event of events){cursor=Math.max(cursor,event.sequence);subscriber.next(event);if(event.data.status==='ready'||event.data.status==='failed'){subscriber.complete();return;}}const current=await this.store.findById(tenantId,id);if(!current){subscriber.error(new Error('JOB_NOT_FOUND'));return;}this.telemetry.replay(events.length,current);timer=setTimeout(poll,250);}catch(error){subscriber.error(error);}};void poll();return()=>{cancelled=true;if(timer)clearTimeout(timer);};});}
  async operations(tenantId:string){return this.telemetry.snapshot(await this.store.activeCount(tenantId));}
}
