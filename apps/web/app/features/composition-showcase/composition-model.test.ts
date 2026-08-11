import { describe, expect, it } from 'vitest';
import { activeSpriteFrame, activeSubtitle, loopProgress } from './composition-model';

describe('deterministic composition model', () => {
  it('normalizes an authoritative loop clock', () => {
    expect(loopProgress(5_400)).toBe(.5);
    expect(loopProgress(10_800)).toBe(0);
  });

  it('selects subtitle cues from media time', () => {
    expect(activeSubtitle(1_000).text).toContain('AI');
    expect(activeSubtitle(4_000).text).toContain('時間軸');
    expect(activeSubtitle(8_000).text).toContain('算圖');
  });

  it('advances sprite frames without exceeding the sheet', () => {
    expect(activeSpriteFrame(0)).toBe(0);
    expect(activeSpriteFrame(1_120)).toBe(0);
    expect(activeSpriteFrame(980)).toBe(7);
  });
});
