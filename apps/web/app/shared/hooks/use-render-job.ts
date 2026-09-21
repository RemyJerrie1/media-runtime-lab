'use client';

import { useEffect, useRef, useState } from 'react';
import { createRenderJobSchema, type CreateRenderJob, type RenderJob } from '@media-lab/contracts';
import {
  createRenderJob,
  getRenderJob,
  parseRenderJobEvent,
  renderJobEvents,
  type RenderEditorCommand,
} from '../api/render-jobs';

const STORAGE_PREFIX = 'media-runtime-active-job-v1:';
const PENDING_PREFIX = 'media-runtime-pending-command-v1:';
const terminal = (job: RenderJob | null) => job?.status === 'ready' || job?.status === 'failed';

export function useRenderJob(scope: 'render' | 'composition') {
  const storageKey = `${STORAGE_PREFIX}${scope}`;
  const pendingKey = `${PENDING_PREFIX}${scope}`;
  const [job, setJob] = useState<RenderJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const operation = useRef<CreateRenderJob | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const sending = useRef(false);
  const activeId = useRef<string | null>(null);
  const snapshot = useRef<RenderJob | null>(null);
  const stream = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeStream() {
    stream.current?.close();
    stream.current = null;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = null;
  }
  function begin(id: string | null) {
    generation.current += 1;
    closeStream();
    activeId.current = id;
    snapshot.current = null;
    setJob(null);
    setError(null);
    return generation.current;
  }
  function current(epoch: number) {
    return mounted.current && generation.current === epoch;
  }
  function accept(next: RenderJob, epoch: number) {
    if (!current(epoch) || next.id !== activeId.current) return false;
    const previous = snapshot.current;
    if (previous && (next.sequence <= previous.sequence || terminal(previous))) return false;
    snapshot.current = next;
    setJob(next);
    return true;
  }
  function connect(id: string, epoch: number) {
    if (!current(epoch) || id !== activeId.current || terminal(snapshot.current)) return;
    closeStream();
    const events = renderJobEvents(id, snapshot.current?.sequence ?? 0);
    stream.current = events;
    const ownsStream = () => current(epoch) && stream.current === events && activeId.current === id;
    events.addEventListener('render.progress', (event) => {
      if (!ownsStream()) return;
      try {
        const next = parseRenderJobEvent((event as MessageEvent).data);
        if (accept(next, epoch) && terminal(next)) closeStream();
      } catch {
        closeStream();
        setError('收到的任務進度格式不正確，已停止更新；請重新載入以取得後端狀態。');
      }
    });
    events.onerror = async () => {
      if (!ownsStream()) return;
      // Remove ownership before awaiting GET so repeated errors cannot launch overlapping recovery.
      closeStream();
      try {
        const recovered = await getRenderJob(id);
        if (!current(epoch) || activeId.current !== id) return;
        if (recovered.id !== id) throw new Error('Unexpected job identity');
        accept(recovered, epoch);
        if (!terminal(snapshot.current)) {
          reconnectTimer.current = setTimeout(() => connect(id, epoch), 1000);
        }
      } catch {
        if (current(epoch))
          setError('即時進度已中斷，目前無法取回後端的權威狀態，請稍後重新載入。');
      }
    };
  }
  async function restore(id: string) {
    const epoch = begin(id);
    setBusy(true);
    try {
      const recovered = await getRenderJob(id);
      if (!current(epoch)) return;
      if (recovered.id !== id) throw new Error('Unexpected job identity');
      accept(recovered, epoch);
      connect(id, epoch);
    } catch {
      if (current(epoch)) setError('已保留上次任務編號，但目前無法取回後端狀態。');
    } finally {
      if (current(epoch)) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    function load() {
      // A storage event also invalidates in-flight creation and recovery from this tab.
      begin(null);
      sending.current = false;
      setBusy(false);
      operation.current = null;
      try {
        const saved = window.localStorage.getItem(pendingKey);
        operation.current = saved ? createRenderJobSchema.parse(JSON.parse(saved)) : null;
        setPending(Boolean(operation.current));
        if (saved) {
          setError('上次送出尚未確認結果，請重試原操作以取回同一筆任務。');
          return;
        }
        const id = window.localStorage.getItem(storageKey);
        if (id) void restore(id);
      } catch {
        setPending(true);
        setError('無法讀取已保存的操作。請確認瀏覽器儲存空間，或明確放棄重試。');
      }
    }
    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey || event.key === pendingKey) load();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      mounted.current = false;
      generation.current += 1;
      sending.current = false;
      closeStream();
      window.removeEventListener('storage', onStorage);
    };
  }, [storageKey, pendingKey]);

  async function send(request: CreateRenderJob) {
    if (!mounted.current || sending.current) return;
    sending.current = true;
    const epoch = begin(null);
    setBusy(true);
    try {
      // Persist before the network call: an ambiguous response must remain retryable after reload.
      window.localStorage.setItem(pendingKey, JSON.stringify(request));
      operation.current = request;
      setPending(true);
      const created = await createRenderJob(request, request.idempotencyKey);
      if (!current(epoch)) return;
      window.localStorage.setItem(storageKey, created.id);
      window.localStorage.removeItem(pendingKey);
      operation.current = null;
      setPending(false);
      activeId.current = created.id;
      accept(created, epoch);
      connect(created.id, epoch);
    } catch {
      if (current(epoch)) {
        setError('尚未確認任務是否建立；請重試原操作，避免重複建立任務。');
      }
    } finally {
      if (current(epoch)) {
        sending.current = false;
        setBusy(false);
      }
    }
  }
  async function run(command: RenderEditorCommand) {
    if (!mounted.current || sending.current || pending || operation.current) return;
    try {
      const request = createRenderJobSchema.parse({
        ...command,
        projectId: 'portfolio-reel',
        narration: 'A deterministic media runtime governed by explicit contracts.',
        idempotencyKey: crypto.randomUUID(),
      });
      // Retain the intent even if persistence itself fails; never send without saving it.
      operation.current = request;
      setPending(true);
      await send(request);
    } catch {
      setError('轉檔設定不符合契約，請檢查後重新送出。');
    }
  }
  async function retry() {
    if (operation.current) await send(operation.current);
    else setError('已保存的操作無法讀取，請明確放棄重試後再建立任務。');
  }
  function discardPending() {
    if (sending.current) return;
    try {
      window.localStorage.removeItem(pendingKey);
      window.localStorage.removeItem(storageKey);
      operation.current = null;
      setPending(false);
      begin(null);
    } catch {
      setError('無法清除已保存的操作，請檢查瀏覽器儲存空間。');
    }
  }
  return { job, busy, error, run, pending, retry, discardPending };
}
