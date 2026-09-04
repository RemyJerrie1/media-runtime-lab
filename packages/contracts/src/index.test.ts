import { describe, expect, it } from 'vitest';
import { createRenderJobSchema, mediaAssetSchema, renderJobSchema } from './index.js';
const encoding = {
  codec: 'libx264' as const,
  preset: 'medium' as const,
  rateControl: 'crf' as const,
  crf: 23,
  bitrateKbps: 4000,
  gop: 60,
  fps: 30,
};
const processing = {
  frameRateMode: 'cfr' as const,
  audioSampleRate: 48000 as const,
  audioSync: 'async-resample' as const,
  subtitleMode: 'webvtt' as const,
  watermarkMode: 'visible' as const,
  adInsertion: 'none' as const,
  fastStart: true,
  deliveryFormat: 'hls-cmaf' as const,
  abrLadder: 'standard' as const,
  qualityMetric: 'vmaf' as const,
};
describe('public contracts', () => {
  it('describes a playable uploaded media asset', () => {
    const id = crypto.randomUUID();
    expect(
      mediaAssetSchema.safeParse({
        id,
        fileName: 'demo.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 1024,
        url: `/media/${id}`,
      }).success,
    ).toBe(true);
  });
  it('rejects unbounded media commands', () =>
    expect(
      createRenderJobSchema.safeParse({
        projectId: 'x',
        sourceAssetId: crypto.randomUUID(),
        template: 'portrait',
        trimStartSeconds: -1,
        durationSeconds: 999,
        encoding: { ...encoding, crf: 99 },
        narration: '',
        idempotencyKey: 'x',
      }).success,
    ).toBe(false));
  it('keeps edit, encoding, trace, artifact and usage evidence on every receipt', () =>
    expect(
      renderJobSchema.safeParse({
        id: 'j1',
        tenantId: 'tenant-1',
        projectId: 'p1',
        sourceAssetId: crypto.randomUUID(),
        status: 'ready',
        progress: 100,
        stage: 'ready',
        sequence: 5,
        attempt: 1,
        traceId: 'trace-1',
        requestId: 'request-1',
        estimatedCostUsd: 0.04,
        tokens: 120,
        template: 'landscape',
        trimStartSeconds: 2,
        durationSeconds: 18,
        encoding,
        processing,
        ffprobeArgs: ['-show_streams'],
        ffmpegArgs: ['-crf', '23'],
        artifactUrl: '/a.mp4',
        artifactChecksum: 'sha256:abc',
        manifestUrl: '/streams/j1/master.m3u8',
        renditions: [
          {
            id: '720p',
            width: 1280,
            height: 720,
            bitrateKbps: 2500,
            playlistUrl: '/streams/j1/720p.m3u8',
            checksum: 'sha256:def',
            vmaf: 94.2,
            qualityMetricStatus: 'measured',
          },
        ],
        updatedAt: new Date().toISOString(),
      }).success,
    ).toBe(true));
});
