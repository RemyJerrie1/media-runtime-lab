import type { HamsterScene } from '@media-lab/contracts';
import { parseScene, serializeScene, SCENE_STORAGE_KEY } from './scene-model';

export function loadScene(storage: Pick<Storage, 'getItem'>): HamsterScene | null {
  const value = storage.getItem(SCENE_STORAGE_KEY);
  return value === null ? null : parseScene(value);
}

export function saveScene(storage: Pick<Storage, 'setItem'>, scene: HamsterScene): void {
  storage.setItem(SCENE_STORAGE_KEY, serializeScene(scene));
}
