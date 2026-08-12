import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { RenderOrchestrator } from './render-orchestrator';

@Injectable()
export class RenderWorker implements OnModuleInit,OnApplicationShutdown {
  private timer?:NodeJS.Timeout;private running=false;private readonly workerId=`worker-${crypto.randomUUID()}`;
  constructor(@Inject(RenderOrchestrator) private readonly renders:RenderOrchestrator){}
  onModuleInit(){if(process.env.NODE_ENV==='test'||process.env.DISABLE_RENDER_WORKER==='true')return;this.timer=setInterval(()=>void this.tick(),150);}
  onApplicationShutdown(){if(this.timer)clearInterval(this.timer);}
  private async tick(){if(this.running)return;this.running=true;try{await this.renders.processNext(this.workerId);}finally{this.running=false;}}
}