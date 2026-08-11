import type { RenderJob } from '@media-lab/contracts';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function createRenderJob(): Promise<RenderJob> {
  const response = await fetch(`${API}/v1/render-jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: 'portfolio-reel',
      template: 'landscape',
      durationSeconds: 18,
      narration: 'A deterministic media runtime governed by explicit contracts.',
      idempotencyKey: `portfolio-${Date.now()}`,
    }),
  });
  if (!response.ok) throw new Error(`Render command rejected (${response.status})`);
  return response.json() as Promise<RenderJob>;
}

export async function getRenderJob(id: string): Promise<RenderJob> {
  const response = await fetch(`${API}/v1/render-jobs/${id}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to recover render state (${response.status})`);
  return response.json() as Promise<RenderJob>;
}

export function renderJobEvents(id: string) {
  return new EventSource(`${API}/v1/render-jobs/${id}/events`);
}
