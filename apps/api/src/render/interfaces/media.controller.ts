import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { MediaFilesService } from '../infrastructure/media-files.service';
import { TenantPolicy } from '../application/tenant-policy';

@Controller()
export class MediaController {
  constructor(
    @Inject(MediaFilesService) private readonly files: MediaFilesService,
    @Inject(TenantPolicy) private readonly policy: TenantPolicy,
  ) {}

  @Post('v1/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 200 * 1024 * 1024, files: 1 } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-api-key') apiKey: string | undefined,
  ) {
    this.policy.authenticate(tenantId, apiKey);
    if (!file) throw new BadRequestException('MEDIA_FILE_REQUIRED');
    return this.files.saveUpload(file);
  }

  @Post('v1/media/demo')
  demo(
    @Headers('x-tenant-id') tenantId: string | undefined,
    @Headers('x-api-key') apiKey: string | undefined,
  ) {
    this.policy.authenticate(tenantId, apiKey);
    return this.files.provisionDemo();
  }

  @Get('media/:assetId')
  async source(
    @Param('assetId') assetId: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const source = await this.files.source(assetId);
    this.streamMedia(source, range, response);
  }

  @Get('artifacts/:filename')
  async artifact(
    @Param('filename') filename: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const jobId = filename.replace(/\.mp4$/i, '');
    const artifact = await this.files.artifact(jobId);
    this.streamMedia({ ...artifact, mimeType: 'video/mp4' }, range, response);
  }

  @Get('streams/:jobId/:filename')
  async stream(
    @Param('jobId') jobId: string,
    @Param('filename') filename: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const asset = await this.files.streamAsset(jobId, filename);
    if (asset.mimeType === 'application/vnd.apple.mpegurl') {
      response.setHeader('Cache-Control', 'no-store');
    }
    this.streamMedia(asset, range, response);
  }

  private streamMedia(
    media: { path: string; size: number; mimeType: string; stream: () => NodeJS.ReadableStream },
    range: string | undefined,
    response: Response,
  ) {
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', media.mimeType);
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), media.size - 1) : media.size - 1;
        if (start >= media.size || end < start) {
          response.status(416).setHeader('Content-Range', `bytes */${media.size}`);
          response.end();
          return;
        }
        response.status(206);
        response.setHeader('Content-Range', `bytes ${start}-${end}/${media.size}`);
        response.setHeader('Content-Length', end - start + 1);
        const stream = createRangeStream(media.path, start, end);
        stream.pipe(response);
        return;
      }
      response.status(416).setHeader('Content-Range', `bytes */${media.size}`);
      response.end();
      return;
    }
    response.setHeader('Content-Length', media.size);
    media.stream().pipe(response);
  }
}
function createRangeStream(path: string, start: number, end: number) {
  return createReadStream(path, { start, end });
}
