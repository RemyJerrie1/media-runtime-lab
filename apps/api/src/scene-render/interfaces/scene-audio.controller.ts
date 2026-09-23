import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SCENE_AUDIO_MAX_BYTES } from '@media-lab/contracts';
import { FileSceneAudioAssets } from '../infrastructure/scene-audio-assets';
import { TenantPolicy } from '../../shared/tenant-policy';

@Controller()
export class SceneAudioController {
  constructor(
    @Inject(FileSceneAudioAssets) private assets: FileSceneAudioAssets,
    @Inject(TenantPolicy) private policy: TenantPolicy,
  ) {}
  @Post('v1/scene-audio')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: SCENE_AUDIO_MAX_BYTES, files: 1 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-tenant-id') tenant?: string,
    @Headers('x-api-key') key?: string,
  ) {
    const owner = this.policy.authenticate(tenant, key);
    this.policy.rateLimit(owner);
    if (!file) throw new BadRequestException('SCENE_AUDIO_REQUIRED');
    try {
      return await this.assets.save(file.buffer, owner);
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_SCENE_AUDIO',
        message: error instanceof Error ? error.message : 'SCENE_AUDIO_FORMAT',
      });
    }
  }
  @Get('v1/scene-audio/:id')
  async metadata(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenant?: string,
    @Headers('x-api-key') key?: string,
  ) {
    const owner = this.policy.authenticate(tenant, key);
    try {
      return await this.assets.get(id, owner);
    } catch {
      throw new NotFoundException('SCENE_AUDIO_MISSING');
    }
  }
  @Get('scene-audio/:file')
  async source(@Param('file') file: string, @Res() response: Response) {
    if (!file.endsWith('.wav')) throw new NotFoundException();
    try {
      const asset = await this.assets.get(file.slice(0, -4));
      const path = await this.assets.resolve(asset);
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      response.sendFile(path, { dotfiles: 'allow' });
    } catch {
      throw new NotFoundException('SCENE_AUDIO_MISSING');
    }
  }
}
