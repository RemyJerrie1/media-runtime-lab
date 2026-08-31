import { describe, expect, it } from 'vitest';
import { RenderJobAggregate } from './render-job';
const base = {
  id: 'job-1',
  tenantId: 'tenant-1',
  projectId: 'project-1',
  status: 'accepted' as const,
  progress: 4,
  stage: 'accepted',
  sequence: 1,
  attempt: 0,
  traceId: 'trace-1',
  estimatedCostUsd: 0.1,
  tokens: 10,
  template: 'landscape' as const,
  trimStartSeconds: 0,
  durationSeconds: 18,
  encoding: {
    codec: 'libx264' as const,
    preset: 'medium' as const,
    rateControl: 'crf' as const,
    crf: 23,
    bitrateKbps: 4000,
    gop: 60,
    fps: 30,
  },
  processing: {
    frameRateMode: 'cfr' as const,
    audioSampleRate: 48000 as const,
    audioSync: 'async-resample' as const,
    subtitleMode: 'webvtt' as const,
    watermarkMode: 'visible' as const,
    adInsertion: 'none' as const,
    fastStart: true,
  },
  ffprobeArgs: ['-show_streams'],
  ffmpegArgs: ['-crf', '23'],
  artifactUrl: null,
  artifactChecksum: null,
  updatedAt: new Date(0).toISOString(),
};
describe('render state machine', () => {
  it('accepts the declared progression and increments sequence', () =>
    expect(new RenderJobAggregate(base).advance('composing', 25, 'compose')).toMatchObject({
      status: 'composing',
      sequence: 2,
    }));
  it('rejects skipped stages', () =>
    expect(() => new RenderJobAggregate(base).advance('ready', 100, 'ready')).toThrow(
      'INVALID_TRANSITION',
    ));
  it('registers artifact and checksum in the ready transition', () => {
    let job = new RenderJobAggregate(base).advance('composing', 25, 'compose');
    job = new RenderJobAggregate(job).advance('encoding', 55, 'encode');
    job = new RenderJobAggregate(job).advance('packaging', 85, 'package');
    job = new RenderJobAggregate(job).advance('ready', 100, 'ready');
    expect(job).toMatchObject({ artifactUrl: '/artifacts/job-1.mp4' });
    expect(job.artifactChecksum).toMatch(/^sha256:/);
  });
});
