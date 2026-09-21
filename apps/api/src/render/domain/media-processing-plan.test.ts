import { describe, expect, it } from 'vitest';
import type { CreateRenderJob } from '@media-lab/contracts';
import { createMediaProcessingPlan, createRenditionProcessingPlan } from './media-processing-plan';

const command: CreateRenderJob = {
  sourceAssetId: '8eb8e256-8904-4b9f-8488-10b617e7068a',
  projectId: 'media-plan',
  template: 'landscape',
  trimStartSeconds: 12,
  durationSeconds: 18,
  encoding: {
    codec: 'libx264',
    preset: 'slow',
    rateControl: 'crf',
    crf: 20,
    bitrateKbps: 4000,
    gop: 60,
    fps: 30,
  },
  processing: {
    frameRateMode: 'cfr',
    audioSampleRate: 48000,
    audioSync: 'async-resample',
    subtitleMode: 'burn-in',
    watermarkMode: 'dynamic',
    adInsertion: 'ssai',
    fastStart: true,
    deliveryFormat: 'hls-cmaf',
    abrLadder: 'standard',
    qualityMetric: 'vmaf',
  },
  narration: 'Traceable media processing plan',
  idempotencyKey: 'media-plan-001',
};

describe('media processing plan', () => {
  it('preserves composition, trimming, frame rate and audio sync in HLS renditions', () => {
    const args = createRenditionProcessingPlan(command, {
      width: 640,
      height: 360,
      bitrateKbps: 650,
    }).ffmpegArgs;
    const filter = args[args.indexOf('-vf') + 1];
    expect(filter).toContain('scale=640:360');
    expect(filter).toContain('subtitles=subtitles.srt');
    expect(filter).toContain('drawtext=');
    for (const [flag, value] of [
      ['-ss', '12'],
      ['-t', '18'],
      ['-r', '30'],
      ['-fps_mode', 'cfr'],
      ['-af', 'aresample=async=1:first_pts=0'],
      ['-ar', '48000'],
      ['-b:v', '650k'],
    ]) {
      expect(args[args.indexOf(flag!) + 1]).toBe(value);
    }
  });
  it('maps governed edit, encode, sync, watermark, ad and playback choices to arguments', () => {
    const plan = createMediaProcessingPlan(command);
    expect(plan.ffprobeArgs).toContain('-show_streams');
    expect(plan.ffmpegArgs).toEqual(
      expect.arrayContaining([
        '-ss',
        '12',
        '-t',
        '18',
        '-crf',
        '20',
        '-g',
        '60',
        '-fps_mode',
        'cfr',
        '-af',
        'aresample=async=1:first_pts=0',
        '-movflags',
        '+faststart',
        '-metadata',
        'ad_insertion=ssai',
      ]),
    );
  });
  it('uses target bitrate instead of CRF when selected', () => {
    const plan = createMediaProcessingPlan({
      ...command,
      encoding: { ...command.encoding, rateControl: 'bitrate', bitrateKbps: 6500 },
    });
    expect(plan.ffmpegArgs).toEqual(expect.arrayContaining(['-b:v', '6500k']));
    expect(plan.ffmpegArgs).not.toContain('-crf');
  });
});
