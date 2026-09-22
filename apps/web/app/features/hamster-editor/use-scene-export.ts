'use client';
import { useEffect, useRef, useState } from 'react';
import {
  createSceneRenderSchema,
  type CreateSceneRender,
  type HamsterScene,
  type SceneRenderJob,
} from '@media-lab/contracts';
import { sceneRequest, submitScene } from './scene-export-api';
export const SCENE_EXPORT_KEY = 'media-runtime-scene-export-v1';
const terminal = (job: SceneRenderJob | null) =>
  !!job && ['ready', 'failed', 'cancelled'].includes(job.status);

export function useSceneExport() {
  const [intent, setIntent] = useState<CreateSceneRender | null>(null);
  const [job, setJob] = useState<SceneRenderJob | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [operation, setOperation] = useState<{
    token: number;
    kind: 'resume' | 'retry' | 'cancel';
    id?: string;
    attempt?: number;
  }>({ token: 0, kind: 'resume' });
  const generation = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCENE_EXPORT_KEY);
      if (raw) setIntent(createSceneRenderSchema.parse(JSON.parse(raw)));
    } catch {
      setError('無法讀取輸出操作紀錄，請先清除無法讀取的紀錄再送出。');
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!intent) return;
    locked.current = true;
    const token = ++generation.current;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => generation.current === token && !controller.signal.aborted;
    const accept = (next: SceneRenderJob) => {
      if (!current()) return;
      setJob((previous) =>
        previous?.id === next.id && previous.sequence > next.sequence ? previous : next,
      );
      setError('');
    };
    const poll = async (id: string) => {
      try {
        const next = await sceneRequest(`/${id}`, controller.signal);
        if (!current()) return;
        accept(next);
        if (!terminal(next)) timer = setTimeout(() => void poll(id), 500);
      } catch (reason) {
        if (current()) setError(reason instanceof Error ? reason.message : '讀取進度失敗');
      }
    };
    void (async () => {
      try {
        let next = await submitScene(intent, controller.signal);
        if (!current()) return;
        if (operation.kind !== 'resume' && operation.id === next.id)
          next = await sceneRequest(
            `/${next.id}/${operation.kind}`,
            controller.signal,
            operation.kind === 'retry' ? { expectedAttempt: operation.attempt } : {},
          );
        if (!current()) return;
        accept(next);
        if (!terminal(next)) timer = setTimeout(() => void poll(next.id), 500);
      } catch (reason) {
        if (current())
          setError(reason instanceof Error ? reason.message : '送出結果不確定，請重試原操作');
      } finally {
        if (current()) locked.current = false;
      }
    })();
    return () => {
      controller.abort();
      clearTimeout(timer);
      generation.current++;
      locked.current = false;
    };
  }, [intent, operation]);
  function start(scene: HamsterScene) {
    if (locked.current || (intent && !terminal(job))) return;
    try {
      const command = createSceneRenderSchema.parse({
        version: 1,
        kind: 'hamster-scene',
        scene,
        idempotencyKey: crypto.randomUUID(),
      });
      localStorage.setItem(SCENE_EXPORT_KEY, JSON.stringify(command));
      generation.current++;
      locked.current = true;
      setJob(null);
      setError('');
      setIntent(command);
      setOperation({ token: Date.now(), kind: 'resume' });
    } catch {
      setError('無法保存輸出操作識別，尚未送出。請允許瀏覽器儲存空間後重試。');
    }
  }
  function act(kind: 'resume' | 'retry' | 'cancel') {
    if (locked.current || !intent) return;
    generation.current++;
    locked.current = true;
    setError('');
    setOperation({ token: Date.now(), kind, ...(job ? { id: job.id, attempt: job.attempt } : {}) });
  }
  function discard() {
    if (!window.confirm('清除本機輸出紀錄不會取消伺服器任務。確定清除並允許建立新操作？')) return;
    try {
      localStorage.removeItem(SCENE_EXPORT_KEY);
      generation.current++;
      setIntent(null);
      setJob(null);
      setError('');
      locked.current = false;
    } catch {
      setError('瀏覽器不允許清除紀錄。');
    }
  }
  return {
    job,
    error,
    start,
    act,
    discard,
    canStart: loaded && !error && (!intent || terminal(job)),
    hasIntent: !!intent,
  };
}
