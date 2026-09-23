import { describe, it, expect } from 'vitest';
import {
  createSceneRenderSchema,
  hamsterSceneDocumentSchema,
  sceneRenderJobSchema,
} from './index.js';
describe('versioned scene export contracts', () => {
  const scene = hamsterSceneDocumentSchema.parse({
    version: 1,
    subject: 'hamster',
    background: '#abcdef',
    transform: { x: 0, z: 0, heading: 0, scale: 1 },
  });
  const command = {
    version: 1,
    kind: 'hamster-scene',
    scene,
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
  };
  it('accepts only explicit scene input and bounded settings', () => {
    expect(createSceneRenderSchema.parse(command).scene.version).toBe(4);
    for (const change of [
      { version: 2 },
      { kind: 'media-render' },
      { sourceAssetId: command.idempotencyKey },
      { scene: { ...scene, version: 1 } },
      { idempotencyKey: 'date-123' },
    ])
      expect(createSceneRenderSchema.safeParse({ ...command, ...change }).success).toBe(false);
  });
  it('rejects a fake ready response without its matching receipt', () => {
    const job = {
      version: 1,
      kind: 'hamster-scene',
      id: command.idempotencyKey,
      scene,
      sceneFingerprint: 'a'.repeat(64),
      rendererVersion: 'hamster-2',
      status: 'ready',
      completedFrames: 120,
      sequence: 1,
      attempt: 1,
      error: null,
      receipt: null,
      updatedAt: new Date().toISOString(),
    };
    expect(sceneRenderJobSchema.safeParse(job).success).toBe(false);
    expect(
      sceneRenderJobSchema.safeParse({ ...job, status: 'rendering', completedFrames: 20 }).success,
    ).toBe(true);
  });
});
