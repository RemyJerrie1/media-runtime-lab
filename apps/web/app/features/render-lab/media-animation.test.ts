import { describe, expect, it } from 'vitest';
import { playheadX, waveformY } from './media-animation';

describe('media preview animation', () => {
  it('moves the waveform when phase advances', () => {
    expect(waveformY(120, 0)).not.toBe(waveformY(120, 1));
  });

  it('loops the playhead without leaving the media-safe area', () => {
    expect(playheadX(0)).toBe(38);
    expect(playheadX(3199)).toBeGreaterThan(549);
    expect(playheadX(3200)).toBe(38);
  });
});
