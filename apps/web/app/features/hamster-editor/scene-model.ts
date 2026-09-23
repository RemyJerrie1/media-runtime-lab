import {
  hamsterSceneSchema,
  hamsterSceneDocumentSchema,
  HAMSTER_SCENE_MAX_BYTES,
  defaultHamsterCaption,
  type HamsterScene,
} from '@media-lab/contracts';

export const SCENE_STORAGE_KEY = 'media-runtime-hamster-scene-v1';
export function defaultScene(): HamsterScene {
  return {
    version: 4,
    audio: null,
    subject: 'hamster',
    background: '#e8ddd0',
    transform: { x: 0, z: 0, heading: 0, scale: 1 },
    animation: { durationSeconds: 5, end: { x: 0, z: 0, heading: 0 } },
    caption: defaultHamsterCaption(),
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
    throw new Error(
      `場景版本或設定不支援，請匯入第 1～4 版倉鼠場景。${result.error.issues[0]?.message ?? ''}`,
    );
  return result.data;
}
export function serializeScene(scene: HamsterScene): string {
  return JSON.stringify(hamsterSceneSchema.parse(scene), null, 2);
}
