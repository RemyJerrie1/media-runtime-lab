import { sceneRenderJobSchema, type CreateSceneRender } from '@media-lab/contracts';
import { MEDIA_RUNTIME } from '../../config/media';
const headers = {
  'content-type': 'application/json',
  'x-tenant-id': 'portfolio',
  'x-api-key': 'local-demo-key',
};
export const sceneVideoUrl = (path: string) => `${MEDIA_RUNTIME.apiBaseUrl}${path}`;
export async function sceneRequest(path: string, signal: AbortSignal, body?: unknown) {
  const response = await fetch(`${MEDIA_RUNTIME.apiBaseUrl}/v1/scene-render-jobs${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    cache: 'no-store',
    signal,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 409) throw new Error('同一操作識別已綁定不同場景，請確認原任務。');
  if (!response.ok)
    throw new Error(
      `無法取得輸出結果（${response.status}）。可重試原操作；需要啟動 API 與 PostgreSQL。`,
    );
  const job = sceneRenderJobSchema.parse(await response.json());
  const requestedId = path.split('/')[1];
  if (requestedId && job.id !== requestedId) throw new Error('伺服器回傳了不同任務，已停止更新。');
  return job;
}
export async function submitScene(command: CreateSceneRender, signal: AbortSignal) {
  const job = await sceneRequest('', signal, command);
  if (JSON.stringify(job.scene) !== JSON.stringify(command.scene))
    throw new Error('回傳場景與送出快照不同，已停止更新。');
  return job;
}
