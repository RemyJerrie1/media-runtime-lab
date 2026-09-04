'use client';
import { useState } from 'react';
import type { OperationsSnapshot } from '@media-lab/contracts';
import { getOperations } from '../../shared/api/render-jobs';
import styles from './operations-evidence.module.css';

const targets = [
  { value: '99.9%', label: '任務成功率', detail: '避免轉檔任務無聲失敗' },
  { value: '≤ 2 秒', label: '故障復原目標', detail: 'Worker 中斷後接續處理' },
  { value: '0%', label: '重複執行上限', detail: '相同指令只產生一份成品' },
  { value: '100%', label: '追蹤覆蓋率', detail: '從請求一路追到成品與成本' },
];

export function OperationsEvidence() {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    try {
      setError(null);
      setSnapshot(await getOperations());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '讀取失敗');
    }
  };
  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">維運證據</p>
          <h2>讓每一次媒體任務，都有可驗證的完成證據。</h2>
          <p>即時掌握任務結果、復原能力與追蹤鏈，快速回答服務是否可靠。</p>
        </div>
        <button
          className={styles.refresh}
          type="button"
          onClick={refresh}
          data-tour="operations-content"
        >
          更新維運數據
        </button>
      </div>
      <div className={styles.snapshot} aria-live="polite" data-tour="operations-result">
        {snapshot ? (
          <>
            <strong>目前執行狀態</strong>
            <span>收到 {snapshot.commands} 筆任務</span>
            <span>完成 {snapshot.completed} 筆</span>
            <span>處理中 {snapshot.active} 筆</span>
            <span>復原 {snapshot.replayedEvents} 個事件</span>
          </>
        ) : (
          <span>更新數據，查看目前任務的執行狀態與服務指標。</span>
        )}
        {error ? <span role="alert">{error}</span> : null}
      </div>
      <div className={styles.targets} data-tour="operations-targets">
        {targets.map((target) => (
          <article key={target.label}>
            <strong>{target.value}</strong>
            <span>{target.label}</span>
            <p>{target.detail}</p>
          </article>
        ))}
      </div>
      <div className={styles.trace} data-tour="operations-trace">
        <div>
          <span>入口請求</span>
          <strong>Request ID</strong>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>跨服務追蹤</span>
          <strong>W3C Trace ID</strong>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>狀態轉換</span>
          <strong>事件序列</strong>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>串流交付</span>
          <strong>Manifest + SHA-256</strong>
        </div>
        <i aria-hidden="true">→</i>
        <div>
          <span>成本歸因</span>
          <strong>處理成本</strong>
        </div>
      </div>
      <details className={styles.evidenceJson} open={Boolean(snapshot?.latestEvidence)}>
        <summary>查看端到端追蹤 JSON</summary>
        <p>W3C Trace Context 串聯請求與任務；Request ID 用於定位單次 HTTP 請求。</p>
        <pre>
          {JSON.stringify(
            snapshot?.latestEvidence
              ? {
                  traceContext: 'W3C traceparent',
                  ...snapshot.latestEvidence,
                  statusChain: ['accepted', 'composing', 'encoding', 'packaging', 'ready'],
                }
              : {
                  status: '尚無任務資料',
                  action: '請先更新維運數據',
                },
            null,
            2,
          )}
        </pre>
      </details>
      <div className={styles.controls}>
        <span>資料庫冪等性</span>
        <span>工作租約復原</span>
        <span>事件序列重播</span>
        <span>租戶額度控制</span>
      </div>
    </section>
  );
}
