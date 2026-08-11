'use client';

import { useEffect, useRef, useState } from 'react';
import type { RenderJob } from '@media-lab/contracts';
import { createRenderJob, getRenderJob, renderJobEvents } from '../api/render-jobs';

export function useRenderJob() {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<EventSource | null>(null);

  useEffect(() => () => stream.current?.close(), []);

  async function run() {
    setBusy(true);
    setError(null);
    stream.current?.close();
    try {
      const created = await createRenderJob();
      setJob(created);
      const events = renderJobEvents(created.id);
      stream.current = events;
      events.addEventListener('render.progress', (event) => {
        const next = JSON.parse((event as MessageEvent).data) as RenderJob;
        setJob(next);
        if (next.status === 'ready' || next.status === 'failed') events.close();
      });
      events.onerror = async () => {
        events.close();
        try { setJob(await getRenderJob(created.id)); }
        catch { setError('Live progress interrupted; authoritative state could not be recovered.'); }
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create render job.');
    } finally {
      setBusy(false);
    }
  }

  return { job, busy, error, run };
}
