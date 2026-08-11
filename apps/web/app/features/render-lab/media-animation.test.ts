import { describe, expect, it } from 'vitest';
import { frameNumber, playheadX, timelineSecond } from './media-animation';

describe('media preview animation', () => {
  it('maps runtime progress onto the authoritative 18-second timeline', () => {
    expect(timelineSecond(0)).toBe(0);
    expect(timelineSecond(1600)).toBe(9);
    expect(timelineSecond(3200)).toBe(0);
  });

  it('loops the playhead without leaving the media-safe area', () => {
    expect(playheadX(0)).toBe(38);
    expect(playheadX(3199)).toBeGreaterThan(549);
    expect(playheadX(3200)).toBe(38);
  });

  it('keeps frame identity inside the 30fps composition boundary', () => {
    expect(frameNumber(0)).toBe(0);
    expect(frameNumber(3199)).toBeLessThan(540);
  });
});
