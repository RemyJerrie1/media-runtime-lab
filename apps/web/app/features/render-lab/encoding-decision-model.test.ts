import { describe, expect, it } from 'vitest';
import { estimateEncodingDecision, renditionCandidates } from './encoding-decision-model';

describe('encoding decision model', () => {
  it('shows higher delivery risk and storage when bitrate increases', () => {
    const base = {
      rateControl: 'bitrate' as const,
      crf: 23,
      fps: 30,
      gop: 60,
      preset: 'medium' as const,
    };
    const efficient = estimateEncodingDecision({ ...base, bitrateKbps: 4500 });
    const heavy = estimateEncodingDecision({ ...base, bitrateKbps: 10000 });
    expect(heavy.storageGbHour).toBeGreaterThan(efficient.storageGbHour);
    expect(heavy.playbackRisk).toBe('高');
    expect(heavy.estimatedVmaf).toBeGreaterThan(efficient.estimatedVmaf);
  });

  it('marks the diminishing-return rendition for removal', () => {
    expect(renditionCandidates.at(-1)?.decision).toBe('淘汰');
    expect(renditionCandidates.at(-1)?.vmaf).toBeLessThan(97);
  });
});
