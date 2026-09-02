import { Injectable } from '@nestjs/common';
import type { RenderJob } from '@media-lab/contracts';
import ffprobe from '@ffprobe-installer/ffprobe';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import type { ArtifactReceipt } from '../domain/workflow-store';
import { MediaFilesService } from './media-files.service';

@Injectable()
export class FfmpegMediaProcessor {
  constructor(private readonly files: MediaFilesService) {}

  async render(job: RenderJob): Promise<ArtifactReceipt> {
    const binary = ffmpegPath;
    if (!binary) throw new Error('FFMPEG_BINARY_UNAVAILABLE');
    await this.files.initialize();
    const input = await this.files.sourcePath(job.sourceAssetId);
    const output = this.files.artifactPath(job.id);
    await this.probe(input, job.ffprobeArgs);
    const args = [
      '-y',
      ...job.ffmpegArgs.map((value) =>
        value === 'input.mp4' ? input : value === 'output.mp4' ? output : value,
      ),
    ];
    await this.execute(binary, args, 'FFMPEG_FAILED');
    await this.probe(output, job.ffprobeArgs);
    return { url: `/artifacts/${job.id}.mp4`, checksum: await this.files.checksum(output) };
  }

  private async probe(path: string, configuredArgs: string[]) {
    const args = configuredArgs.map((value) => (value === 'input.mp4' ? path : value));
    const output = await this.execute(ffprobe.path, args, 'FFPROBE_FAILED');
    const metadata = JSON.parse(output) as { streams?: unknown[]; format?: unknown };
    if (!metadata.streams?.length || !metadata.format) throw new Error('FFPROBE_INVALID_MEDIA');
  }

  private execute(binary: string, args: string[], failureCode: string) {
    return new Promise<string>((resolvePromise, reject) => {
      const child = spawn(binary, args, { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout = `${stdout}${chunk.toString()}`;
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString()}`.slice(-12000);
      });
      child.once('error', reject);
      child.once('close', (code: number | null) =>
        code === 0
          ? resolvePromise(stdout)
          : reject(new Error(`${failureCode}:${code}:${stderr.slice(-1200)}`)),
      );
    });
  }
}
