'use client';

export function PendingRenderOperation({
  busy,
  retry,
  discard,
}: {
  busy: boolean;
  retry: () => Promise<void>;
  discard: () => void;
}) {
  return (
    <div role="group" aria-label="未確認的轉檔操作">
      <p>重試會沿用原本的設定與任務識別。放棄重試後另建任務，可能與已送出的任務重複。</p>
      <button type="button" disabled={busy} onClick={() => void retry()}>
        重試原操作
      </button>
      <button type="button" disabled={busy} onClick={discard}>
        放棄重試，準備新任務
      </button>
    </div>
  );
}
