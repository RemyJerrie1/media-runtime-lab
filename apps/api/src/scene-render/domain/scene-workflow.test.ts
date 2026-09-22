import { describe, it, expect } from 'vitest';
import { newSceneJob, advanceScene } from './scene-workflow';
import { sceneCommand, testReceipt } from '../infrastructure/scene-fixture';
describe('scene domain', () => {
  it('only publishes a verified matching receipt after all frames and encoding', () => {
    const job = newSceneJob(sceneCommand());
    expect(() => advanceScene(job, { status: 'ready', frames: 120 })).toThrow();
    job.status = 'rendering';
    expect(() => advanceScene(job, { status: 'encoding', frames: 119 })).toThrow();
    const encoding = advanceScene(job, { status: 'encoding', frames: 120 });
    expect(() =>
      advanceScene(encoding, {
        status: 'ready',
        frames: 120,
        receipt: testReceipt('b'.repeat(64)),
      }),
    ).toThrow('SCENE_RECEIPT_MISMATCH');
    const ready = advanceScene(encoding, {
      status: 'ready',
      frames: 120,
      receipt: testReceipt(job.sceneFingerprint),
    });
    expect(ready.status).toBe('ready');
    expect(() => advanceScene(ready, { status: 'failed', frames: 120 })).toThrow();
  });
});
