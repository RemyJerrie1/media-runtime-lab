import { BadRequestException, Body, Controller, Get, MessageEvent, NotFoundException, Param, Post, Sse } from '@nestjs/common';
import { createRenderJobSchema } from '@media-lab/contracts';
import { concat, map, Observable, of } from 'rxjs';
import { RenderOrchestrator } from '../application/render-orchestrator';

@Controller('v1/render-jobs')
export class RenderController {
  constructor(private readonly renders:RenderOrchestrator){}
  @Post() create(@Body() body:unknown){ const parsed=createRenderJobSchema.safeParse(body); if(!parsed.success)throw new BadRequestException({code:'INVALID_COMMAND',message:parsed.error.issues[0]?.message,traceId:crypto.randomUUID()}); return this.renders.create(parsed.data); }
  @Get(':id') get(@Param('id') id:string){ const job=this.renders.get(id); if(!job)throw new NotFoundException({code:'JOB_NOT_FOUND',message:'Render job does not exist',traceId:crypto.randomUUID()}); return job; }
  @Sse(':id/events') events(@Param('id') id:string):Observable<MessageEvent>{ const current=this.renders.get(id); const stream=this.renders.events(id); if(!current||!stream)throw new NotFoundException(); return concat(of(current),stream).pipe(map(data=>({type:'render.progress',data,retry:2000}))); }
}
