import { describe, it, expect } from 'vitest';
import { defaultScene, parseScene, serializeScene } from './scene-model';
import { evaluateScene } from './evaluate-scene';
import { captionLayout, CAPTION_FRAME } from './caption-renderer';

describe('caption frame contract', () => {
  it('uses half-open time intervals and survives reverse seeks and round trips', () => {
    const scene = defaultScene();
    scene.caption.enabled = true;
    for (const [time, visible] of [
      [0.99, false],
      [1, true],
      [3.99, true],
      [4, false],
      [1, true],
      [0, false],
    ] as const)
      expect(evaluateScene(parseScene(serializeScene(scene)), time).caption !== null).toBe(visible);
    scene.caption.enabled = false;
    expect(evaluateScene(scene, 2).caption).toBeNull();
  });
  it('fits two full lines at maximum size inside the reference frame safe area', () => {
    const caption = { ...defaultScene().caption, fontSize: 52, text: '倉'.repeat(40) };
    const layout = captionLayout(caption);
    expect(layout.lines).toHaveLength(2);
    expect(layout.x).toBeGreaterThanOrEqual(64);
    expect(layout.x + layout.width).toBeLessThanOrEqual(CAPTION_FRAME.width - 64);
    expect(layout.y + layout.height).toBe(CAPTION_FRAME.height - 40);
    expect(layout.y).toBeGreaterThan(0);
  });
});
