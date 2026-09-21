import {
  mediaAssetSchema,
  renderJobSchema,
  operationsSnapshotSchema,
  type CreateRenderJob,
  type MediaAsset,
  type OperationsSnapshot,
  type RenderJob,
} from '@media-lab/contracts';
import { MEDIA_RUNTIME } from '../../config/media';

const API = MEDIA_RUNTIME.apiBaseUrl;
const tenantHeaders = { 'x-tenant-id': 'portfolio', 'x-api-key': 'local-demo-key' };

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

export async function uploadMedia(file: File): Promise<MediaAsset> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${API}/v1/media`, { method: 'POST', headers: tenantHeaders, body });
  if (!response.ok) throw new Error(`素材上傳失敗（${response.status}）`);
  return mediaAssetSchema.parse(await response.json());
}

export async function getDemoMedia(): Promise<MediaAsset> {
  const response = await fetch(`${API}/v1/media/demo`, { method: 'POST', headers: tenantHeaders });
  if (!response.ok) throw new Error(`示範素材準備失敗（${response.status}）`);
  return mediaAssetSchema.parse(await response.json());
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
  const response = await fetch(`${API}/v1/render-jobs`, {
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
  if (!response.ok) throw new Error(`Render command rejected (${response.status})`);
  return normalizeRenderJob(await response.json());
}

export async function getRenderJob(id: string): Promise<RenderJob> {
  const response = await fetch(`${API}/v1/render-jobs/${id}`, {
    cache: 'no-store',
    headers: tenantHeaders,
  });
  if (!response.ok) throw new Error(`Unable to recover render state (${response.status})`);
  return normalizeRenderJob(await response.json());
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
  const response = await fetch(`${API}/v1/operations`, {
    cache: 'no-store',
    headers: tenantHeaders,
  });
  if (!response.ok) throw new Error(`維運快照讀取失敗（${response.status}）`);
  return operationsSnapshotSchema.parse(await response.json());
}
