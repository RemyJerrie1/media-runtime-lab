import { Injectable } from '@nestjs/common';
import type { RenderJob } from '@media-lab/contracts';
import ffprobe from '@ffprobe-installer/ffprobe';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ArtifactReceipt } from '../domain/workflow-store';
import { MediaFilesService } from './media-files.service';

@Injectable()
export class FfmpegMediaProcessor {
  private vmafAvailable: boolean | undefined;
  constructor(private readonly files: MediaFilesService) {}

  async render(job: RenderJob): Promise<ArtifactReceipt> {
    const binary = process.env.FFMPEG_BINARY || ffmpegPath;
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
    const artifactChecksum = await this.files.checksum(output);
    if (job.processing.deliveryFormat !== 'hls-cmaf') {
      return {
        artifactUrl: `/artifacts/${job.id}.mp4`,
        artifactChecksum,
        manifestUrl: null,
        renditions: [],
      };
    }
    const directory = await this.files.streamDirectory(job.id);
    const ladder = [
      { id: '360p', width: 640, height: 360, bitrateKbps: 650 },
      { id: '540p', width: 960, height: 540, bitrateKbps: 1400 },
      { id: '720p', width: 1280, height: 720, bitrateKbps: 2500 },
      { id: '1080p', width: 1920, height: 1080, bitrateKbps: 4500 },
    ] as const;
    const renditions = [];
    for (const rendition of ladder) {
      const playlist = resolve(directory, `${rendition.id}.m3u8`);
      const encoded = resolve(directory, `${rendition.id}.mp4`);
      const scale = `scale=${rendition.width}:${rendition.height}:force_original_aspect_ratio=decrease,pad=${rendition.width}:${rendition.height}:(ow-iw)/2:(oh-ih)/2`;
      await this.execute(
        binary,
        [
          '-y',
          '-ss',
          String(job.trimStartSeconds),
          '-i',
          input,
          '-t',
          String(job.durationSeconds),
          '-vf',
          scale,
          '-c:v',
          'libx264',
          '-preset',
          job.encoding.preset,
          '-b:v',
          `${rendition.bitrateKbps}k`,
          '-maxrate',
          `${Math.round(rendition.bitrateKbps * 1.07)}k`,
          '-bufsize',
          `${rendition.bitrateKbps * 2}k`,
          '-g',
          String(job.encoding.gop),
          '-keyint_min',
          String(job.encoding.gop),
          '-sc_threshold',
          '0',
          '-c:a',
          'aac',
          '-ar',
          String(job.processing.audioSampleRate),
          '-movflags',
          '+faststart',
          encoded,
        ],
        'FFMPEG_RENDITION_FAILED',
      );
      await this.execute(
        binary,
        [
          '-y',
          '-i',
          encoded,
          '-codec',
          'copy',
          '-hls_time',
          '2',
          '-hls_playlist_type',
          'vod',
          '-hls_segment_type',
          'fmp4',
          '-hls_fmp4_init_filename',
          resolve(directory, `${rendition.id}-init.mp4`),
          '-hls_segment_filename',
          resolve(directory, `${rendition.id}-%03d.m4s`),
          playlist,
        ],
        'FFMPEG_CMAF_FAILED',
      );
      const vmaf =
        job.processing.qualityMetric === 'vmaf'
          ? await this.measureVmaf(binary, input, encoded, rendition.width, rendition.height)
          : null;
      renditions.push({
        ...rendition,
        playlistUrl: `/streams/${job.id}/${rendition.id}.m3u8`,
        checksum: await this.files.checksum(encoded),
        vmaf,
        qualityMetricStatus:
          job.processing.qualityMetric === 'none'
            ? ('not-requested' as const)
            : vmaf === null
              ? ('unavailable' as const)
              : ('measured' as const),
      });
    }
    const master = [
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      '#EXT-X-INDEPENDENT-SEGMENTS',
      ...renditions.flatMap((rendition) => [
        `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bitrateKbps * 1000},RESOLUTION=${rendition.width}x${rendition.height},CODECS="avc1.64001f,mp4a.40.2"`,
        `${rendition.id}.m3u8`,
      ]),
      '',
    ].join('\n');
    const masterPath = resolve(directory, 'master.m3u8');
    await writeFile(masterPath, master, 'utf8');
    return {
      artifactUrl: `/artifacts/${job.id}.mp4`,
      artifactChecksum,
      manifestUrl: `/streams/${job.id}/master.m3u8`,
      renditions,
    };
  }

  private async measureVmaf(
    binary: string,
    source: string,
    rendition: string,
    width: number,
    height: number,
  ) {
    if (this.vmafAvailable === undefined) {
      const filters = await this.execute(
        binary,
        ['-hide_banner', '-filters'],
        'FFMPEG_FILTERS_FAILED',
      );
      this.vmafAvailable = /\blibvmaf\b/.test(filters);
    }
    if (!this.vmafAvailable) return null;
    const report = `${rendition}.vmaf.json`;
    await this.execute(
      binary,
      [
        '-i',
        rendition,
        '-i',
        source,
        '-lavfi',
        `[1:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[reference];[0:v][reference]libvmaf=log_fmt=json:log_path=${report.replaceAll('\\', '/')}`,
        '-f',
        'null',
        '-',
      ],
      'FFMPEG_VMAF_FAILED',
    );
    const result = JSON.parse(await readFile(report, 'utf8')) as {
      pooled_metrics?: { vmaf?: { mean?: number } };
    };
    const score = result.pooled_metrics?.vmaf?.mean;
    return typeof score === 'number' ? Number(score.toFixed(1)) : null;
  }

  private async probe(path: string, configuredArgs: string[]) {
    const args = configuredArgs.map((value) => (value === 'input.mp4' ? path : value));
    const output = await this.execute(
      process.env.FFPROBE_BINARY || ffprobe.path,
      args,
      'FFPROBE_FAILED',
    );
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
