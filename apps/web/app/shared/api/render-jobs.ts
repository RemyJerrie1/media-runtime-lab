import type { CreateRenderJob, RenderJob } from '@media-lab/contracts';
import { MEDIA_RUNTIME } from '../../config/media';

const API = MEDIA_RUNTIME.apiBaseUrl;
const tenantHeaders={'x-tenant-id':'portfolio','x-api-key':'local-demo-key'};

export type RenderEditorCommand = Pick<CreateRenderJob,'template'|'trimStartSeconds'|'durationSeconds'|'encoding'|'processing'>;

export async function createRenderJob(editor:RenderEditorCommand): Promise<RenderJob> {
  const response = await fetch(`${API}/v1/render-jobs`, {
    method: 'POST', headers: { 'content-type': 'application/json',...tenantHeaders,'x-trace-id':crypto.randomUUID() },
    body: JSON.stringify({projectId:'portfolio-reel',...editor,narration:'A deterministic media runtime governed by explicit contracts.',idempotencyKey:`portfolio-${Date.now()}`}),
  });
  if (!response.ok) throw new Error(`Render command rejected (${response.status})`);
  return response.json() as Promise<RenderJob>;
}

export async function getRenderJob(id: string): Promise<RenderJob> {
  const response = await fetch(`${API}/v1/render-jobs/${id}`, { cache:'no-store',headers:tenantHeaders });
  if (!response.ok) throw new Error(`Unable to recover render state (${response.status})`);
  return response.json() as Promise<RenderJob>;
}

export function renderJobEvents(id: string,after=0) {
  const query=new URLSearchParams({tenantId:'portfolio',accessToken:'local-demo-key',after:String(after)});
  return new EventSource(`${API}/v1/render-jobs/${id}/events?${query}`);
}
