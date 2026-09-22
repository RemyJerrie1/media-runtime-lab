import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Headers,
  Inject,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  ParseUUIDPipe,
  Res,
  Query,
} from '@nestjs/common';
import { createSceneRenderSchema, retrySceneRenderSchema } from '@media-lab/contracts';
import type { Response } from 'express';
import { SCENE_STORE, type SceneStore } from '../domain/scene-workflow';
import { TenantPolicy } from '../../shared/tenant-policy';
import { sceneArtifactRoot } from '../infrastructure/chromium-scene.processor';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

@Controller()
export class SceneController {
  constructor(
    @Inject(SCENE_STORE) private store: SceneStore,
    @Inject(TenantPolicy) private policy: TenantPolicy,
  ) {}
  private async run<T>(operation: () => Promise<T>) {
    try {
      const result = await operation();
      if (result === undefined) throw new NotFoundException('SCENE_JOB_NOT_FOUND');
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'IDEMPOTENCY_CONFLICT')
        throw new ConflictException({
          code: 'IDEMPOTENCY_CONFLICT',
          message: '此 key 已綁定另一份場景。',
        });
      if (
        error instanceof Error &&
        ['SCENE_DATABASE_REQUIRED', 'SCENE_QUEUE_FULL'].includes(error.message)
      )
        throw new ServiceUnavailableException({ code: error.message, message: error.message });
      throw error;
    }
  }
  @Post('v1/scene-render-jobs') create(
    @Body() body: unknown,
    @Headers('x-tenant-id') tenant?: string,
    @Headers('x-api-key') key?: string,
  ) {
    const owner = this.policy.authenticate(tenant, key);
    this.policy.rateLimit(owner);
    const parsed = createSceneRenderSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_SCENE_COMMAND',
        message: parsed.error.issues[0]?.message,
      });
    return this.run(() => this.store.create(owner, parsed.data));
  }
  @Get('v1/scene-render-jobs/:id') get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-tenant-id') tenant?: string,
    @Headers('x-api-key') key?: string,
  ) {
    const owner = this.policy.authenticate(tenant, key);
    return this.run(() => this.store.get(owner, id));
  }
  @Post('v1/scene-render-jobs/:id/retry') retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Headers('x-tenant-id') tenant?: string,
    @Headers('x-api-key') key?: string,
  ) {
    const owner = this.policy.authenticate(tenant, key);
    this.policy.rateLimit(owner);
    const parsed = retrySceneRenderSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_RETRY');
    return this.run(() => this.store.retry(owner, id, parsed.data.expectedAttempt));
  }
  @Post('v1/scene-render-jobs/:id/cancel') cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('x-tenant-id') tenant?: string,
    @Headers('x-api-key') key?: string,
  ) {
    const owner = this.policy.authenticate(tenant, key);
    return this.run(() => this.store.cancel(owner, id));
  }
  @Get('scene-artifacts/:file') async artifact(
    @Param('file') file: string,
    @Res() response: Response,
    @Query('download') download?: string,
  ) {
    if (!/^[a-f0-9-]{36}\.mp4$/.test(file)) throw new NotFoundException();
    const path = resolve(sceneArtifactRoot(), file);
    if (!(await stat(path).catch(() => undefined))) throw new NotFoundException();
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (download === '1')
      response.setHeader('Content-Disposition', 'attachment; filename="hamster.mp4"');
    // Only this validated UUID filename may be served from the managed .runtime directory.
    response.sendFile(path, { dotfiles: 'allow' });
  }
}
