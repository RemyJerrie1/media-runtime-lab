import { describe, expect, it } from 'vitest';
import { hamsterSceneDocumentSchema, hamsterSceneSchema } from './index.js';

const legacy = {
  version: 1,
  subject: 'hamster',
  background: '#ABCDEF',
  transform: { x: 1, z: -1, heading: 120, scale: 0.8 },
};
describe('versioned hamster documents', () => {
  it('upgrades v1 to a stationary v2 without losing transform or color', () => {
    const upgraded = hamsterSceneDocumentSchema.parse(legacy);
    expect(upgraded).toEqual({
      ...legacy,
      version: 2,
      background: '#abcdef',
      animation: { durationSeconds: 5, end: { x: 1, z: -1, heading: 120 } },
    });
    expect(hamsterSceneSchema.parse(upgraded)).toEqual(upgraded);
  });
  it('rejects incomplete v2, unknown versions and invalid animation data', () => {
    const valid = hamsterSceneDocumentSchema.parse(legacy);
    for (const value of [
      { ...legacy, version: 2 },
      { ...valid, version: 3 },
      { ...valid, animation: { ...valid.animation, durationSeconds: 6 } },
      { ...valid, animation: { ...valid.animation, end: { x: Infinity, z: 0, heading: 0 } } },
      { ...valid, animation: { ...valid.animation, end: { x: 0, z: -2, heading: 0 } } },
      { ...valid, animation: { ...valid.animation, end: { x: 0, z: 0, heading: 181 } } },
      { ...valid, animation: { ...valid.animation, extra: true } },
    ])
      expect(hamsterSceneDocumentSchema.safeParse(value).success).toBe(false);
  });
});
