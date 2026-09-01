export type EncodingDecisionInput = {
  rateControl: 'crf' | 'bitrate';
  crf: number;
  bitrateKbps: number;
  fps: number;
  gop: number;
  preset: 'fast' | 'medium' | 'slow';
};

export type PlaybackRisk = '低' | '中' | '高';

export type RenditionCandidate = {
  id: string;
  resolution: string;
  bitrateKbps: number;
  vmaf: number;
  encodeCost: number;
  storageGbHour: number;
  playbackRisk: PlaybackRisk;
  decision: '保留' | '觀察' | '淘汰';
};

export const renditionCandidates: readonly RenditionCandidate[] = [
  {
    id: '720p',
    resolution: '1280 × 720',
    bitrateKbps: 2500,
    vmaf: 90.2,
    encodeCost: 0.6,
    storageGbHour: 1.13,
    playbackRisk: '低',
    decision: '保留',
  },
  {
    id: '1080p-efficient',
    resolution: '1920 × 1080',
    bitrateKbps: 4500,
    vmaf: 94.1,
    encodeCost: 1,
    storageGbHour: 2.03,
    playbackRisk: '低',
    decision: '保留',
  },
  {
    id: '1080p-heavy',
    resolution: '1920 × 1080',
    bitrateKbps: 8000,
    vmaf: 95.5,
    encodeCost: 1.3,
    storageGbHour: 3.6,
    playbackRisk: '中',
    decision: '觀察',
  },
  {
    id: '2160p-heavy',
    resolution: '3840 × 2160',
    bitrateKbps: 16000,
    vmaf: 96.2,
    encodeCost: 3.8,
    storageGbHour: 7.2,
    playbackRisk: '高',
    decision: '淘汰',
  },
] as const;

export const abrLadder = [
  { resolution: '640 × 360', bitrateKbps: 650 },
  { resolution: '960 × 540', bitrateKbps: 1400 },
  { resolution: '1280 × 720', bitrateKbps: 2500 },
  { resolution: '1920 × 1080', bitrateKbps: 4500 },
] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export function estimateEncodingDecision(input: EncodingDecisionInput) {
  const targetKbps =
    input.rateControl === 'bitrate'
      ? input.bitrateKbps
      : Math.round(4500 * Math.pow(2, (23 - input.crf) / 6));
  const estimatedVmaf = clamp(86 + 5 * Math.log2(Math.max(targetKbps, 600) / 1800), 78, 98);
  const presetMultiplier = input.preset === 'fast' ? 0.7 : input.preset === 'slow' ? 1.65 : 1;
  const encodeCost = presetMultiplier * (input.fps / 30);
  const storageGbHour = targetKbps * 0.00045;
  const playbackRisk: PlaybackRisk = targetKbps <= 4500 ? '低' : targetKbps <= 7000 ? '中' : '高';
  const keyframeSeconds = input.gop / input.fps;

  return {
    targetKbps,
    estimatedVmaf: Number(estimatedVmaf.toFixed(1)),
    encodeCost: Number(encodeCost.toFixed(2)),
    storageGbHour: Number(storageGbHour.toFixed(2)),
    playbackRisk,
    keyframeSeconds: Number(keyframeSeconds.toFixed(1)),
  };
}
