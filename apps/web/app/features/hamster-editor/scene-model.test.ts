import { describe, expect, it } from 'vitest';
import { defaultScene, parseScene, serializeScene } from './scene-model';
import { evaluateScene } from './evaluate-scene';
import { loadScene, saveScene } from './scene-storage';

describe('hamster scene persistence', () => {
  it('round trips every editable setting through the shared contract and storage', () => {
    const scene = {
      ...defaultScene(),
      background: '#ABCDEF',
      transform: { x: -1.2, z: 1.2, heading: -180, scale: 1.25 },
    };
    let stored: string | null = null;
    saveScene(
      {
        setItem: (_key, value) => {
          stored = value;
        },
      },
      scene,
    );
    expect(loadScene({ getItem: () => stored })).toEqual({ ...scene, background: '#abcdef' });
  });
  it.each([
    '{',
    JSON.stringify({ ...defaultScene(), version: 99 }),
    JSON.stringify({ ...defaultScene(), background: 'url(evil)' }),
    JSON.stringify({ ...defaultScene(), extra: true }),
    ...['x', 'z', 'heading', 'scale'].map((key) =>
      JSON.stringify({ ...defaultScene(), transform: { ...defaultScene().transform, [key]: 999 } }),
    ),
    JSON.stringify({ ...defaultScene(), transform: { ...defaultScene().transform, scale: 0 } }),
    ' '.repeat(16 * 1024 + 1),
  ])('rejects malformed, unsupported or unbounded scene %#', (text) => {
    expect(() => parseScene(text)).toThrow();
  });
  it('does not overwrite unreadable storage or silently swallow write failure', () => {
    let stored = 'broken';
    expect(() => loadScene({ getItem: () => stored })).toThrow();
    expect(stored).toBe('broken');
    expect(() =>
      saveScene(
        {
          setItem: () => {
            throw new Error('quota');
          },
        },
        defaultScene(),
      ),
    ).toThrow('quota');
    expect(stored).toBe('broken');
  });
  it('keeps the feet at the platform height for all supported sizes', () => {
    for (const scale of [0.65, 1, 1.25]) {
      const scene = defaultScene();
      scene.transform.scale = scale;
      scene.transform.heading = 180;
      const pose = evaluateScene(parseScene(serializeScene(scene)), 0).root;
      expect(pose.y).toBe(0.06);
      expect(pose.scale).toBe(scale);
      expect(pose.rotationY).toBe(Math.PI);
    }
  });
});
