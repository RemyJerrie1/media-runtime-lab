import {
  BadRequestException,
  Body,
  Inject,
  Controller,
  Get,
  Headers,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { createRenderJobSchema } from '@media-lab/contracts';
import { map, type Observable } from 'rxjs';
import { RenderOrchestrator } from '../application/render-orchestrator';
import { TenantPolicy } from '../application/tenant-policy';

@Controller('v1')
export class RenderController {
  constructor(
    @Inject(RenderOrchestrator) private readonly renders: RenderOrchestrator,
    @Inject(TenantPolicy) private readonly policy: TenantPolicy,
  ) {}
  private tenant(tenantId: string | undefined, apiKey: string | undefined) {
    return this.policy.authenticate(tenantId, apiKey);
  }
  @Post('render-jobs') async create(
    @Body() body: unknown,
    @Headers('x-tenant-id') tenantHeader: string | undefined,
    @Headers('x-api-key') apiKey: string | undefined,
    @Headers('x-trace-id') traceHeader: string | undefined,
    @Headers('x-request-id') requestHeader: string | undefined,
    @Headers('traceparent') traceParent: string | undefined,
  ) {
    const tenantId = this.tenant(tenantHeader, apiKey);
    this.policy.rateLimit(tenantId);
    const w3cTraceId = traceParent?.match(/^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i)?.[1];
    const traceId = w3cTraceId ?? traceHeader ?? crypto.randomUUID();
    const requestId = requestHeader ?? crypto.randomUUID();
    const parsed = createRenderJobSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_COMMAND',
        message: parsed.error.issues[0]?.message,
        traceId,
      });
    try {
      return await this.renders.create(
        tenantId,
        parsed.data,
        traceId,
        requestId,
        this.policy.quotaTokens,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'TENANT_QUOTA_EXCEEDED')
        throw new BadRequestException({
          code: 'TENANT_QUOTA_EXCEEDED',
          message: 'Daily attributed token quota would be exceeded',
          traceId,
        });
      throw error;
    }
  }
  @Get('render-jobs/:id') async get(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantHeader: string | undefined,
    @Headers('x-api-key') apiKey: string | undefined,
  ) {
    const tenantId = this.tenant(tenantHeader, apiKey);
    const job = await this.renders.get(tenantId, id);
    if (!job)
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: 'Render job does not exist',
        traceId: crypto.randomUUID(),
      });
    return job;
  }
  @Sse('render-jobs/:id/events') async events(
    @Param('id') id: string,
    @Query('tenantId') tenantQuery: string | undefined,
    @Query('accessToken') accessToken: string | undefined,
    @Query('after') after: string | undefined,
    @Headers('last-event-id') lastEventId: string | undefined,
  ): Promise<Observable<MessageEvent>> {
    const tenantId = this.tenant(tenantQuery, accessToken);
    const current = await this.renders.get(tenantId, id);
    if (!current) throw new NotFoundException();
    const cursor = Number(lastEventId ?? after ?? 0) || 0;
    return this.renders.events(tenantId, id, cursor).pipe(
      map((event) => ({
        id: String(event.sequence),
        type: event.type,
        data: event.data,
        retry: 1000,
      })),
    );
  }
  @Get('operations') operations(
    @Headers('x-tenant-id') tenantHeader: string | undefined,
    @Headers('x-api-key') apiKey: string | undefined,
  ) {
    const tenantId = this.tenant(tenantHeader, apiKey);
    return this.renders.operations(tenantId);
  }
}
