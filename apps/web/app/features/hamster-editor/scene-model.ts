import {
  hamsterSceneSchema,
  hamsterSceneDocumentSchema,
  HAMSTER_SCENE_MAX_BYTES,
  type HamsterScene,
} from '@media-lab/contracts';

export const SCENE_STORAGE_KEY = 'media-runtime-hamster-scene-v1';
export function defaultScene(): HamsterScene {
  return {
    version: 2,
    subject: 'hamster',
    background: '#e8ddd0',
    transform: { x: 0, z: 0, heading: 0, scale: 1 },
    animation: { durationSeconds: 5, end: { x: 0, z: 0, heading: 0 } },
  };
}
export function parseScene(text: string): HamsterScene {
  if (new TextEncoder().encode(text).length > HAMSTER_SCENE_MAX_BYTES)
    throw new Error('場景檔案不能超過 16 KB。');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('無法讀取 JSON，請選擇有效的場景檔案。');
  }
  const result = hamsterSceneDocumentSchema.safeParse(value);
  if (!result.success)
    throw new Error('場景版本或設定不支援，請匯入第 1 或第 2 版倉鼠場景並檢查數值範圍。');
  return result.data;
}
export function serializeScene(scene: HamsterScene): string {
  return JSON.stringify(hamsterSceneSchema.parse(scene), null, 2);
}
