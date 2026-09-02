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
    private readonly files: MediaFilesService,
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

  @Get('artifacts/:filename')
  async artifact(
    @Param('filename') filename: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const jobId = filename.replace(/\.mp4$/i, '');
    const artifact = await this.files.artifact(jobId);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', 'video/mp4');
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), artifact.size - 1) : artifact.size - 1;
        if (start >= artifact.size || end < start) {
          response.status(416).setHeader('Content-Range', `bytes */${artifact.size}`);
          response.end();
          return;
        }
        response.status(206);
        response.setHeader('Content-Range', `bytes ${start}-${end}/${artifact.size}`);
        response.setHeader('Content-Length', end - start + 1);
        const stream = createRangeStream(artifact.path, start, end);
        stream.pipe(response);
        return;
      }
      response.status(416).setHeader('Content-Range', `bytes */${artifact.size}`);
      response.end();
      return;
    }
    response.setHeader('Content-Length', artifact.size);
    artifact.stream().pipe(response);
  }
}
function createRangeStream(path: string, start: number, end: number) {
  return createReadStream(path, { start, end });
}
