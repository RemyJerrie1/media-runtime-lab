import { describe, expect, it } from 'vitest';
import {
  hamsterSceneDocumentSchema,
  hamsterSceneSchema,
  defaultHamsterCaption,
  hamsterCaptionSchema,
  hamsterCaptionLines,
} from './index.js';

const legacy = {
  version: 1,
  subject: 'hamster',
  background: '#ABCDEF',
  transform: { x: 1, z: -1, heading: 120, scale: 0.8 },
};
describe('versioned hamster documents', () => {
  it('upgrades v1 to a stationary v3 without losing transform or color', () => {
    const upgraded = hamsterSceneDocumentSchema.parse(legacy);
    expect(upgraded).toEqual({
      ...legacy,
      version: 3,
      caption: defaultHamsterCaption(),
      background: '#abcdef',
      animation: { durationSeconds: 5, end: { x: 1, z: -1, heading: 120 } },
    });
    expect(hamsterSceneSchema.parse(upgraded)).toEqual(upgraded);
  });
  it('rejects incomplete v2, unknown versions and invalid animation data', () => {
    const valid = hamsterSceneDocumentSchema.parse(legacy);
    for (const value of [
      { ...legacy, version: 2 },
      { ...valid, version: 99 },
      { ...valid, animation: { ...valid.animation, durationSeconds: 6 } },
      { ...valid, animation: { ...valid.animation, end: { x: Infinity, z: 0, heading: 0 } } },
      { ...valid, animation: { ...valid.animation, end: { x: 0, z: -2, heading: 0 } } },
      { ...valid, animation: { ...valid.animation, end: { x: 0, z: 0, heading: 181 } } },
      { ...valid, animation: { ...valid.animation, extra: true } },
    ])
      expect(hamsterSceneDocumentSchema.safeParse(value).success).toBe(false);
  });
});

it('migrates v2 animation unchanged with captions disabled', () => {
  const v2 = {
    ...legacy,
    version: 2,
    animation: { durationSeconds: 5, end: { x: 0.5, z: 0, heading: -80 } },
  };
  const upgraded = hamsterSceneDocumentSchema.parse(v2);
  expect(upgraded.animation).toEqual(v2.animation);
  expect(upgraded.caption).toEqual(defaultHamsterCaption());
});
it('validates caption time, supported text, line count and style bounds', () => {
  const valid = defaultHamsterCaption();
  for (const change of [
    { start: 4, end: 4 },
    { start: -1 },
    { end: 6 },
    { start: NaN },
    { text: '' },
    { text: '  ' },
    { text: '字'.repeat(41) },
    { text: '一\n二\n三' },
    { text: '字'.repeat(21) + '\n第二行' },
    { text: '🐹' },
    { fontSize: 53 },
    { color: 'red' },
    { extra: true },
  ])
    expect(hamsterCaptionSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  expect(hamsterCaptionLines('字'.repeat(40))).toEqual(['字'.repeat(20), '字'.repeat(20)]);
  expect(
    hamsterCaptionSchema.parse({ ...valid, text: '繁體中文，出發！\nHello 123', start: 0, end: 5 })
      .text,
  ).toContain('繁體中文');
});
