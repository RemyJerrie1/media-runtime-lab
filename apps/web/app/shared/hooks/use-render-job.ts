'use client';

import { useEffect, useRef, useState } from 'react';
import type { RenderJob } from '@media-lab/contracts';
import {
  createRenderJob,
  getRenderJob,
  parseRenderJobEvent,
  renderJobEvents,
  type RenderEditorCommand,
} from '../api/render-jobs';

export function useRenderJob() {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stream = useRef<EventSource | null>(null);
  const lastReceivedSequence = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      stream.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    },
    [],
  );
  function connect(id: string, after: number) {
    stream.current?.close();
    const events = renderJobEvents(id, after);
    stream.current = events;
    events.addEventListener('render.progress', (event) => {
      if (stream.current !== events) return;
      const next = parseRenderJobEvent((event as MessageEvent).data);
      lastReceivedSequence.current = Math.max(lastReceivedSequence.current, next.sequence);
      setJob(next);
      if (next.status === 'ready' || next.status === 'failed') events.close();
    });
    events.onerror = async () => {
      if (stream.current !== events) return;
      events.close();
      try {
        const recovered = await getRenderJob(id);
        if (recovered.status === 'ready' || recovered.status === 'failed') {
          lastReceivedSequence.current = Math.max(lastReceivedSequence.current, recovered.sequence);
          setJob(recovered);
        } else {
          reconnectTimer.current = setTimeout(
            () => connect(id, lastReceivedSequence.current),
            1000,
          );
        }
      } catch {
        setError('即時進度已中斷，目前無法取回後端的權威狀態，請稍後重試。');
      }
    };
  }
  async function run(command: RenderEditorCommand) {
    setBusy(true);
    setError(null);
    stream.current?.close();
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    lastReceivedSequence.current = 0;
    try {
      const created = await createRenderJob(command);
      setJob(created);
      connect(created.id, 0);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : '目前無法建立算圖任務，請確認後端服務。';
      setError(message);
      window.dispatchEvent(new CustomEvent('media-lab:render-state', { detail: 'unavailable' }));
    } finally {
      setBusy(false);
    }
  }
  return { job, busy, error, run };
}
