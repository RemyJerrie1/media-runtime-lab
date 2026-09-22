import {
  defaultHamsterCaption,
  createSceneRenderSchema,
  type SceneReceipt,
} from '@media-lab/contracts';
export function sceneCommand() {
  return createSceneRenderSchema.parse({
    version: 1,
    kind: 'hamster-scene',
    idempotencyKey: crypto.randomUUID(),
    scene: {
      version: 3,
      subject: 'hamster',
      background: '#e8ddd0',
      transform: { x: -1.2, z: 0, heading: 90, scale: 1 },
      animation: { durationSeconds: 5, end: { x: 0.6, z: 0, heading: 0 } },
      caption: { ...defaultHamsterCaption(), enabled: true },
    },
  });
}
export function testReceipt(fingerprint: string): SceneReceipt {
  return {
    version: 1,
    rendererVersion: 'hamster-1',
    sceneFingerprint: fingerprint,
    artifactUrl: `/scene-artifacts/${crypto.randomUUID()}.mp4`,
    width: 640,
    height: 360,
    fps: 24,
    frameCount: 120,
    durationSeconds: 5,
    audioStreams: 0,
    sizeBytes: 1000,
    checksum: `sha256:${'a'.repeat(64)}`,
  };
}
