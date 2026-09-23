import { hamsterSceneSchema, type HamsterScene } from '@media-lab/contracts';
import { createHamsterStage } from './stage-renderer.js';
import { drawCaption, loadCaptionFont, CAPTION_FRAME } from './caption-renderer.js';
import { evaluateScene } from './evaluate-scene.js';

let stage: ReturnType<typeof createHamsterStage> | undefined;
let scene: HamsterScene;
let releaseFont: (() => void) | undefined;
const webgl = document.createElement('canvas');
const overlay = document.createElement('canvas');
overlay.width = CAPTION_FRAME.width;
overlay.height = CAPTION_FRAME.height;
const output = document.createElement('canvas');
output.width = 640;
output.height = 360;
document.body.append(output);
const runtime = {
  async init(value: unknown, rendererVersion?: string) {
    scene = hamsterSceneSchema.parse(value);
    try {
      releaseFont = await loadCaptionFont();
    } catch {
      throw new Error('SCENE_FONT_UNAVAILABLE');
    }
    try {
      stage = createHamsterStage(webgl, { width: 640, height: 360 }, rendererVersion);
      await stage.ready;
    } catch {
      throw new Error('SCENE_WEBGL_UNAVAILABLE');
    }
  },
  frame(index: number) {
    if (!stage || !Number.isInteger(index) || index < 0 || index >= 120)
      throw new Error('INVALID_SCENE_FRAME');
    stage.render(scene, index / 24);
    drawCaption(overlay, evaluateScene(scene, index / 24).caption);
    const context = output.getContext('2d')!;
    context.drawImage(webgl, 0, 0, 640, 360);
    context.drawImage(overlay, 0, 0, 640, 360);
    return output.toDataURL('image/png').split(',')[1]!;
  },
  dispose() {
    stage?.dispose();
    releaseFont?.();
  },
};
(window as unknown as { sceneCapture: typeof runtime }).sceneCapture = runtime;
