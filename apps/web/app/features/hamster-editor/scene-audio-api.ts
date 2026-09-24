import { requestJson, UPLOAD_TIMEOUT_MS } from '../../shared/api/request-json';
import {
  SCENE_AUDIO_MAX_BYTES,
  sceneAudioAssetSchema,
  type SceneAudioAsset,
} from '@media-lab/contracts';
import { sceneVideoUrl } from './scene-export-api';
const headers = { 'x-tenant-id': 'portfolio', 'x-api-key': 'local-demo-key' };
export async function uploadSceneAudio(file: File, signal: AbortSignal) {
  if (file.size > SCENE_AUDIO_MAX_BYTES) throw new Error('音檔不能超過 10 MB。');
  if (!/\.(mp3|wav)$/i.test(file.name)) throw new Error('請選擇 MP3 或 WAV 音檔。');
  const body = new FormData();
  body.append('file', file);
  const response = await requestJson(
    sceneVideoUrl('/v1/scene-audio'),
    {
      method: 'POST',
      headers,
      body,
      signal,
    },
    UPLOAD_TIMEOUT_MS,
  );
  if (!response.ok)
    throw new Error('音檔無法使用：請選擇 60 秒內、10 MB 以下的有效 MP3／WAV，並確認 API 已啟動。');
  return sceneAudioAssetSchema.parse(response.data);
}
export async function checkSceneAudio(asset: SceneAudioAsset, signal: AbortSignal) {
  const response = await requestJson(sceneVideoUrl(`/v1/scene-audio/${asset.id}`), {
    headers,
    signal,
    cache: 'no-store',
  });
  if (!response.ok)
    throw new Error(
      '音訊素材無法取得。請啟動原 API，或重新上傳音檔；也可靜音／移除後輸出無聲影片。',
    );
  const actual = sceneAudioAssetSchema.parse(response.data);
  if (JSON.stringify(actual) !== JSON.stringify(asset))
    throw new Error('音訊素材已變更，請重新上傳。');
}
