import { requestJson, UPLOAD_TIMEOUT_MS } from './request-json';
import {
  mediaAssetSchema,
  renderJobSchema,
  operationsSnapshotSchema,
  idempotencyConflictSchema,
  type CreateRenderJob,
  type MediaAsset,
  type OperationsSnapshot,
  type RenderJob,
} from '@media-lab/contracts';
import { MEDIA_RUNTIME } from '../../config/media';

const API = MEDIA_RUNTIME.apiBaseUrl;
const tenantHeaders = { 'x-tenant-id': 'portfolio', 'x-api-key': 'local-demo-key' };

export class RenderConflictError extends Error {
  constructor() {
    super('原操作識別已用於不同內容，或屬於無法比對的舊任務。請放棄重試後明確建立新任務。');
  }
}

function normalizeRenderJob(value: unknown): RenderJob {
  const job =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return renderJobSchema.parse({
    ...job,
    requestId: job.requestId === undefined ? job.traceId : job.requestId,
    manifestUrl: job.manifestUrl ?? null,
    renditions: job.renditions === undefined ? [] : job.renditions,
  });
}

export type RenderEditorCommand = Pick<
  CreateRenderJob,
  'sourceAssetId' | 'template' | 'trimStartSeconds' | 'durationSeconds' | 'encoding' | 'processing'
>;

function parseMediaAsset(value: unknown): MediaAsset {
  const result = mediaAssetSchema.safeParse(value);
  if (!result.success) throw new Error('素材回應格式不正確，請重試；若持續失敗，請確認 API 版本。');
  return result.data;
}

export function mediaFailureMessage(cause: unknown): string {
  // WebKit can report JSON parsing as a DOMException named SyntaxError.
  if (cause instanceof Error && cause.name === 'SyntaxError')
    return '素材回應不完整或格式不正確，請重試。';
  if (cause instanceof TypeError) return '無法連線取得素材，請確認網路與 API 已啟動後重試。';
  return cause instanceof Error ? cause.message : '素材載入失敗，請重試。';
}

export async function uploadMedia(file: File, signal?: AbortSignal): Promise<MediaAsset> {
  const body = new FormData();
  body.append('file', file);
  const response = await requestJson(
    `${API}/v1/media`,
    { method: 'POST', headers: tenantHeaders, body, signal: signal ?? null },
    UPLOAD_TIMEOUT_MS,
  );
  if (!response.ok) throw new Error(`素材上傳失敗（${response.status}）`);
  return parseMediaAsset(response.data);
}

export async function getDemoMedia(signal?: AbortSignal): Promise<MediaAsset> {
  const response = await requestJson(`${API}/v1/media/demo`, {
    method: 'POST',
    headers: tenantHeaders,
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error(`示範素材準備失敗（${response.status}）`);
  return parseMediaAsset(response.data);
}

export function artifactUrl(path: string) {
  return `${API}${path}`;
}

export function playbackPath(
  job: Pick<RenderJob, 'artifactUrl' | 'renditions'>,
  renditionId: string,
) {
  const rendition = job.renditions.find((item) => item.id === renditionId);
  return rendition?.playlistUrl.replace(/\.m3u8$/, '.mp4') ?? job.artifactUrl;
}

export async function createRenderJob(
  editor: RenderEditorCommand,
  idempotencyKey: string,
): Promise<RenderJob> {
  const traceId = crypto.randomUUID().replaceAll('-', '');
  const spanId = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  const response = await requestJson(`${API}/v1/render-jobs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...tenantHeaders,
      traceparent: `00-${traceId}-${spanId}-01`,
      'x-request-id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      projectId: 'portfolio-reel',
      ...editor,
      narration: 'A deterministic media runtime governed by explicit contracts.',
      idempotencyKey,
    }),
  });
  if (response.status === 409) {
    idempotencyConflictSchema.parse(response.data);
    throw new RenderConflictError();
  }
  if (!response.ok) throw new Error(`Render command rejected (${response.status})`);
  return normalizeRenderJob(response.data);
}

export async function getRenderJob(id: string): Promise<RenderJob> {
  const response = await requestJson(`${API}/v1/render-jobs/${id}`, {
    cache: 'no-store',
    headers: tenantHeaders,
  });
  if (!response.ok) throw new Error(`Unable to recover render state (${response.status})`);
  return normalizeRenderJob(response.data);
}

export function parseRenderJobEvent(value: string): RenderJob {
  return normalizeRenderJob(JSON.parse(value));
}

export function renderJobEvents(id: string, after = 0) {
  const query = new URLSearchParams({
    tenantId: 'portfolio',
    accessToken: 'local-demo-key',
    after: String(after),
  });
  return new EventSource(`${API}/v1/render-jobs/${id}/events?${query}`);
}

export async function getOperations(): Promise<OperationsSnapshot> {
  const response = await requestJson(`${API}/v1/operations`, {
    cache: 'no-store',
    headers: tenantHeaders,
  });
  if (!response.ok) throw new Error(`維運快照讀取失敗（${response.status}）`);
  return operationsSnapshotSchema.parse(response.data);
}
