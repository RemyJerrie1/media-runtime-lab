import { Inject, Injectable } from '@nestjs/common';
import type { RenderJob } from '@media-lab/contracts';
import ffprobe from '@ffprobe-installer/ffprobe';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { ArtifactReceipt } from '../domain/workflow-store';
import { MediaFilesService } from './media-files.service';
import { createRenditionProcessingPlan } from '../domain/media-processing-plan';
import type { MediaProcessor } from '../domain/media-processor';

@Injectable()
export class FfmpegMediaProcessor implements MediaProcessor {
  private vmafAvailable: boolean | undefined;
  constructor(
    @Inject(MediaFilesService)
    private readonly files: Pick<
      MediaFilesService,
      'initialize' | 'sourcePath' | 'artifactPath' | 'streamDirectory' | 'checksum'
    >,
  ) {}

  async render(job: RenderJob, signal?: AbortSignal): Promise<ArtifactReceipt> {
    signal?.throwIfAborted();
    // Immutable attempt-specific paths prevent a stale worker from overwriting a winner.
    const outputId = crypto.randomUUID();
    const binary = process.env.FFMPEG_BINARY || ffmpegPath;
    if (!binary) throw new Error('FFMPEG_BINARY_UNAVAILABLE');
    await this.files.initialize();
    const input = await this.files.sourcePath(job.sourceAssetId);
    const output = this.files.artifactPath(outputId);
    await this.probe(input, job.ffprobeArgs, signal);
    const args = [
      '-y',
      ...job.ffmpegArgs.map((value) =>
        value === 'input.mp4' ? input : value === 'output.mp4' ? output : value,
      ),
    ];
    await this.execute(binary, args, 'FFMPEG_FAILED', undefined, signal);
    const outputProbe = await this.probe(output, job.ffprobeArgs, signal);
    await this.verifyPlayback(binary, output, signal);
    const artifactChecksum = await this.files.checksum(output);
    if (job.processing.deliveryFormat !== 'hls-cmaf') {
      return {
        artifactUrl: `/artifacts/${outputId}.mp4`,
        artifactChecksum,
        manifestUrl: null,
        renditions: [],
        evidence: this.buildEvidence(job, outputProbe, 0, 0),
      };
    }
    const directory = await this.files.streamDirectory(outputId);
    const ladder =
      job.processing.abrLadder === 'standard'
        ? [
            { id: '360p', width: 640, height: 360, bitrateKbps: 650 },
            { id: '540p', width: 960, height: 540, bitrateKbps: 1400 },
            { id: '720p', width: 1280, height: 720, bitrateKbps: 2500 },
            { id: '1080p', width: 1920, height: 1080, bitrateKbps: 4500 },
          ]
        : [
            {
              id: 'source',
              width: outputProbe.width,
              height: outputProbe.height,
              bitrateKbps: Math.max(1, outputProbe.bitrateKbps),
            },
          ];
    // Renditions are independent. Running them concurrently keeps the guided demo
    // responsive while preserving the same real FFmpeg, CMAF and VMAF evidence.
    const siblings = new AbortController();
    const renditionSignal = signal ? AbortSignal.any([signal, siblings.signal]) : siblings.signal;
    const results = await Promise.allSettled(
      ladder.map(async (rendition) => {
        try {
          const playlist = resolve(directory, `${rendition.id}.m3u8`);
          const encoded = resolve(directory, `${rendition.id}.mp4`);
          const plan = createRenditionProcessingPlan(job, rendition);
          await this.execute(
            binary,
            [
              '-y',
              ...plan.ffmpegArgs.map((value) =>
                value === 'input.mp4' ? input : value === 'output.mp4' ? encoded : value,
              ),
            ],
            'FFMPEG_RENDITION_FAILED',
            undefined,
            renditionSignal,
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
              `${rendition.id}-init.mp4`,
              '-hls_segment_filename',
              resolve(directory, `${rendition.id}-%03d.m4s`),
              playlist,
            ],
            'FFMPEG_CMAF_FAILED',
            directory,
            renditionSignal,
          );
          await this.verifyPlayback(binary, playlist, renditionSignal);
          const vmaf =
            job.processing.qualityMetric === 'vmaf'
              ? await this.measureVmaf(
                  binary,
                  input,
                  encoded,
                  rendition.width,
                  rendition.height,
                  job.trimStartSeconds,
                  job.durationSeconds,
                  job.encoding.fps,
                  renditionSignal,
                )
              : null;
          return {
            ...rendition,
            playlistUrl: `/streams/${outputId}/${rendition.id}.m3u8`,
            checksum: await this.files.checksum(encoded),
            vmaf,
            qualityMetricStatus:
              job.processing.qualityMetric === 'none'
                ? ('not-requested' as const)
                : vmaf === null
                  ? ('unavailable' as const)
                  : ('measured' as const),
          };
        } catch (error) {
          siblings.abort(error);
          throw error;
        }
      }),
    );
    const renditions = results.map((result) => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
    signal?.throwIfAborted();
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
    const packagedFiles = await readdir(directory);
    return {
      artifactUrl: `/artifacts/${outputId}.mp4`,
      artifactChecksum,
      manifestUrl: `/streams/${outputId}/master.m3u8`,
      renditions,
      evidence: this.buildEvidence(
        job,
        outputProbe,
        packagedFiles.filter((name) => name.endsWith('.m3u8')).length,
        packagedFiles.filter((name) => name.endsWith('.m4s')).length,
      ),
    };
  }

  private buildEvidence(
    job: RenderJob,
    probe: Awaited<ReturnType<FfmpegMediaProcessor['probe']>>,
    playlistCount: number,
    segmentCount: number,
  ) {
    return {
      probe,
      keyframeIntervalSeconds: Number((job.encoding.gop / job.encoding.fps).toFixed(2)),
      audioVideoDriftSeconds: probe.audioVideoDriftSeconds,
      playbackVerified: true,
      watermarkApplied: job.processing.watermarkMode,
      playlistCount,
      segmentCount,
    };
  }

  private async measureVmaf(
    binary: string,
    source: string,
    rendition: string,
    width: number,
    height: number,
    trimStartSeconds: number,
    durationSeconds: number,
    fps: number,
    signal?: AbortSignal,
  ) {
    if (this.vmafAvailable === undefined) {
      const filters = await this.execute(
        binary,
        ['-hide_banner', '-filters'],
        'FFMPEG_FILTERS_FAILED',
        undefined,
        signal,
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
        `[1:v]trim=start=${trimStartSeconds}:duration=${durationSeconds},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,fps=${fps},format=yuv420p[reference];[0:v]setpts=PTS-STARTPTS,fps=${fps},format=yuv420p[distorted];[distorted][reference]libvmaf=shortest=1:log_fmt=json:log_path=${basename(report)}`,
        '-f',
        'null',
        '-',
      ],
      'FFMPEG_VMAF_FAILED',
      dirname(report),
      signal,
    );
    const result = JSON.parse(await readFile(report, 'utf8')) as {
      pooled_metrics?: { vmaf?: { mean?: number } };
    };
    const score = result.pooled_metrics?.vmaf?.mean;
    return typeof score === 'number' ? Number(score.toFixed(1)) : null;
  }

  private async probe(path: string, configuredArgs: string[], signal?: AbortSignal) {
    const args = configuredArgs.map((value) => (value === 'input.mp4' ? path : value));
    const output = await this.execute(
      process.env.FFPROBE_BINARY || ffprobe.path,
      args,
      'FFPROBE_FAILED',
      undefined,
      signal,
    );
    const metadata = JSON.parse(output) as {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        avg_frame_rate?: string;
        duration?: string;
      }>;
      format?: { duration?: string; bit_rate?: string };
    };
    if (!metadata.streams?.length || !metadata.format) throw new Error('FFPROBE_INVALID_MEDIA');
    const video = metadata.streams.find((stream) => stream.codec_type === 'video');
    const audio = metadata.streams.find((stream) => stream.codec_type === 'audio');
    if (!video?.codec_name || !video.width || !video.height)
      throw new Error('FFPROBE_VIDEO_MISSING');
    const [numerator = '0', denominator = '1'] = (video.avg_frame_rate ?? '0/1').split('/');
    const formatDuration = Number(metadata.format.duration ?? 0);
    const videoDuration = Number(video.duration ?? formatDuration);
    const audioDuration = Number(audio?.duration ?? formatDuration);
    return {
      codec: video.codec_name,
      width: video.width,
      height: video.height,
      fps: Number((Number(numerator) / Math.max(Number(denominator), 1)).toFixed(2)),
      durationSeconds: Number(Number(metadata.format.duration ?? 0).toFixed(2)),
      bitrateKbps: Math.round(Number(metadata.format.bit_rate ?? 0) / 1000),
      streamCount: metadata.streams.length,
      audioVideoDriftSeconds: Number(Math.abs(videoDuration - audioDuration).toFixed(3)),
    };
  }

  private verifyPlayback(binary: string, path: string, signal?: AbortSignal) {
    return this.execute(
      binary,
      ['-v', 'error', '-xerror', '-i', path, '-f', 'null', '-'],
      'PLAYBACK_DECODE_FAILED',
      undefined,
      signal,
    );
  }

  private execute(
    binary: string,
    args: string[],
    failureCode: string,
    cwd?: string,
    signal?: AbortSignal,
  ) {
    return new Promise<string>((resolvePromise, reject) => {
      signal?.throwIfAborted();
      const child = spawn(binary, args, { windowsHide: true, cwd });
      const abort = () => {
        child.kill('SIGKILL');
      };
      signal?.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 10 * 60 * 1000);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout = `${stdout}${chunk.toString()}`;
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString()}`.slice(-12000);
      });
      child.once('error', reject);
      child.once('close', (code: number | null) => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        signal?.aborted
          ? reject(signal.reason)
          : code === 0
            ? resolvePromise(stdout)
            : reject(new Error(`${failureCode}:${code}:${stderr.slice(-1200)}`));
      });
    });
  }
}
