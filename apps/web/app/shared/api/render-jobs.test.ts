import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RenderJob, OperationsSnapshot } from '@media-lab/contracts';
import {
  createRenderJob,
  getRenderJob,
  getDemoMedia,
  uploadMedia,
  getOperations,
  parseRenderJobEvent,
  playbackPath,
} from './render-jobs';

const job: RenderJob = {
  id: 'job-1',
  tenantId: 'tenant',
  projectId: 'project',
  sourceAssetId: '00000000-0000-4000-8000-000000000001',
  status: 'ready',
  progress: 100,
  stage: 'ready',
  sequence: 5,
  attempt: 1,
  traceId: 'trace',
  requestId: 'request',
  estimatedCostUsd: 0.01,
  tokens: 10,
  template: 'landscape',
  trimStartSeconds: 0,
  durationSeconds: 1,
  encoding: {
    codec: 'libx264',
    preset: 'fast',
    rateControl: 'crf',
    crf: 23,
    bitrateKbps: 1000,
    gop: 24,
    fps: 24,
  },
  processing: {
    frameRateMode: 'cfr',
    audioSampleRate: 48000,
    audioSync: 'async-resample',
    subtitleMode: 'none',
    watermarkMode: 'none',
    adInsertion: 'none',
    fastStart: true,
    deliveryFormat: 'mp4',
    abrLadder: 'none',
    qualityMetric: 'none',
  },
  ffprobeArgs: [],
  ffmpegArgs: [],
  artifactUrl: '/artifacts/output.mp4',
  artifactChecksum: 'sha256:test',
  manifestUrl: null,
  renditions: [],
  updatedAt: '2026-09-21T00:00:00Z',
};
const asset = {
  id: job.sourceAssetId,
  fileName: 'video.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 100,
  url: `/media/${job.sourceAssetId}`,
};
const operations: OperationsSnapshot = {
  service: 'media-runtime-api',
  windowStartedAt: job.updatedAt,
  commands: 1,
  duplicatesPrevented: 0,
  completed: 1,
  failed: 0,
  active: 0,
  replayedEvents: 0,
  latestEvidence: null,
  targets: {
    renderSuccessRate: 0.99,
    recoverySeconds: 2,
    duplicateExecutionRate: 0,
    costAttributionCoverage: 1,
    traceCompleteness: 1,
  },
};
const endpoints = [
  {
    name: 'upload',
    run: () => uploadMedia(new File(['video'], 'video.mp4', { type: 'video/mp4' })),
    value: asset,
  },
  { name: 'demo', run: getDemoMedia, value: asset },
  { name: 'create', run: () => createRenderJob(job, 'operation-123'), value: job },
  { name: 'get', run: () => getRenderJob(job.id), value: job },
  { name: 'operations', run: getOperations, value: operations },
];
afterEach(() => vi.unstubAllGlobals());
function response(value: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(value), { status })),
  );
}

describe('API response contracts', () => {
  for (const endpoint of endpoints) {
    it(`${endpoint.name} accepts a valid response`, async () => {
      response(endpoint.value);
      expect(await endpoint.run()).toEqual(endpoint.value);
    });
    it(`${endpoint.name} rejects malformed success data`, async () => {
      response({ unexpected: true });
      await expect(endpoint.run()).rejects.toThrow();
    });
    it(`${endpoint.name} rejects invalid JSON`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{')));
      await expect(endpoint.run()).rejects.toThrow();
    });
    it(`${endpoint.name} preserves HTTP error handling`, async () => {
      response(endpoint.value, 503);
      await expect(endpoint.run()).rejects.toThrow('503');
    });
  }
  it('rejects invalid nested render data and out-of-range progress', async () => {
    for (const invalid of [
      { ...job, progress: 101 },
      { ...job, encoding: { ...job.encoding, fps: '24' } },
      { ...job, renditions: [{ id: '720p' }] },
    ]) {
      response(invalid);
      await expect(getRenderJob(job.id)).rejects.toThrow();
      expect(() => parseRenderJobEvent(JSON.stringify(invalid))).toThrow();
    }
  });
  it('validates SSE payloads and refuses truncated jobs', () => {
    expect(parseRenderJobEvent(JSON.stringify(job))).toEqual(job);
    for (const value of [
      '{',
      'null',
      '[]',
      JSON.stringify({ id: 'legacy', traceId: 'trace', status: 'ready' }),
    ])
      expect(() => parseRenderJobEvent(value)).toThrow();
  });
  it('only supplies the established legacy defaults before validating', async () => {
    const { requestId, manifestUrl, renditions, ...legacy } = job;
    const expected = { ...job, requestId: job.traceId };
    response(legacy);
    expect(await getRenderJob(job.id)).toEqual(expected);
    expect(parseRenderJobEvent(JSON.stringify(legacy))).toEqual(expected);
    expect(() => parseRenderJobEvent(JSON.stringify({ ...legacy, requestId: 42 }))).toThrow();
    expect(() => parseRenderJobEvent(JSON.stringify({ ...legacy, renditions: null }))).toThrow();
  });
  it('rejects invalid asset metadata and nested operations values', async () => {
    response({ ...asset, sizeBytes: -1 });
    await expect(getDemoMedia()).rejects.toThrow();
    response({ ...operations, targets: { ...operations.targets, recoverySeconds: 'fast' } });
    await expect(getOperations()).rejects.toThrow();
  });
  it('uses committed delivery identity for quality previews', () => {
    const receipt = {
      ...job,
      renditions: [
        {
          id: '720p',
          width: 1280,
          height: 720,
          bitrateKbps: 2500,
          playlistUrl: '/streams/committed-output/720p.m3u8',
          checksum: 'sha256:test',
          vmaf: null,
          qualityMetricStatus: 'not-requested' as const,
        },
      ],
    };
    expect(playbackPath(receipt, '720p')).toBe('/streams/committed-output/720p.mp4');
    expect(playbackPath(receipt, 'missing')).toBe(job.artifactUrl);
    expect(playbackPath(job, '720p')).toBe(job.artifactUrl);
  });
});
