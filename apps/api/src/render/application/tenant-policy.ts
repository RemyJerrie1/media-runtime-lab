import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class TenantPolicy {
  private readonly windows=new Map<string,{started:number;count:number}>();
  readonly quotaTokens=Number(process.env.TENANT_DAILY_TOKEN_QUOTA??'50000');
  authenticate(tenantId:string|undefined,apiKey:string|undefined){
    const tenant=tenantId?.trim(); if(!tenant)throw new UnauthorizedException('x-tenant-id is required');
    const expected=process.env.MEDIA_RUNTIME_API_KEY??'local-demo-key'; if(apiKey!==expected)throw new ForbiddenException('invalid tenant credential'); return tenant;
  }
  rateLimit(tenantId:string){const now=Date.now();const limit=Number(process.env.TENANT_RATE_LIMIT_PER_MINUTE??'30');let window=this.windows.get(tenantId);if(!window||now-window.started>=60000){window={started:now,count:0};this.windows.set(tenantId,window);}window.count+=1;if(window.count>limit)throw new HttpException('tenant rate limit exceeded',HttpStatus.TOO_MANY_REQUESTS);}
}