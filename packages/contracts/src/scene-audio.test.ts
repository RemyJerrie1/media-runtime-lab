import { it, expect } from 'vitest';
import {
  audioAtTime,
  hamsterAudioSchema,
  hamsterSceneDocumentSchema,
  hamsterSceneSchema,
  sceneRendererVersion,
  audibleSceneAudio,
} from './index.js';
const asset = {
  id: '11111111-1111-4111-8111-111111111111',
  url: '/scene-audio/11111111-1111-4111-8111-111111111111.wav',
  checksum: `sha256:${'a'.repeat(64)}`,
  durationSeconds: 3,
  sizeBytes: 5000,
};
const audio = { asset, start: 1, trimStart: 0.5, volume: 0.5, muted: false };
it('uses one timeline for trim, delay, exhaustion, mute and gain-zero', () => {
  expect(audioAtTime(audio, 0)).toEqual({ active: false, sourceTime: 0.5 });
  expect(audioAtTime(audio, 1)).toEqual({ active: true, sourceTime: 0.5 });
  expect(audioAtTime(audio, 2.5)).toEqual({ active: true, sourceTime: 2 });
  expect(audioAtTime(audio, 3.5).active).toBe(false);
  expect(audioAtTime({ ...audio, muted: true }, 2).active).toBe(false);
  expect(audioAtTime({ ...audio, volume: 0 }, 2).active).toBe(false);
  expect(audioAtTime({ ...audio, start: 4 }, 5).active).toBe(false);
});
it('rejects unsafe references, impossible trims and nonfinite/unbounded audio settings', () => {
  for (const patch of [
    { trimStart: 3 },
    { trimStart: -1 },
    { start: 5 },
    { volume: 1.01 },
    { volume: NaN },
    { asset: { ...asset, url: '/media/other' } },
    { asset: { ...asset, durationSeconds: 61 } },
    { asset: { ...asset, checksum: 'fake' } },
  ])
    expect(hamsterAudioSchema.safeParse({ ...audio, ...patch }).success).toBe(false);
});
it('migrates legacy documents without changing old export commands or renderer identity', () => {
  const migrated = hamsterSceneDocumentSchema.parse({
    version: 1,
    subject: 'hamster',
    background: '#abcdef',
    transform: { x: 0, z: 0, heading: 0, scale: 1 },
  });
  expect(migrated.audio).toBeNull();
  expect(migrated.version).toBe(4);
  const { audio: unused, ...rest } = migrated;
  const legacy = hamsterSceneSchema.parse({ ...rest, version: 3 });
  expect(sceneRendererVersion(legacy)).toBe('hamster-1');
  expect(sceneRendererVersion(migrated)).toBe('hamster-3');
  expect(audibleSceneAudio({ ...migrated, audio })).toEqual(audio);
  expect(audibleSceneAudio({ ...migrated, audio: { ...audio, muted: true } })).toBeNull();
});
