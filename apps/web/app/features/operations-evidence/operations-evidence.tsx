'use client';
import { useState } from 'react';
import type { OperationsSnapshot } from '@media-lab/contracts';
import { getOperations } from '../../shared/api/render-jobs';
import styles from './operations-evidence.module.css';

const targets = [
  { value: '99.9%', label: '算圖成功率目標', detail: '終態轉換服務目標' },
  { value: '≤ 2 秒', label: '復原時間', detail: '持久化序列重播' },
  { value: '0%', label: '重複執行率', detail: '資料庫強制唯一識別' },
  { value: '100%', label: '追蹤完整度', detail: '從指令到成本證據' },
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
          <h2>明確的目標、故障控制與可追蹤收據。</h2>
          <p>以下是參考系統的工程目標，不代表歷史客戶流量的實績聲明。</p>
        </div>
        <button
          className={styles.refresh}
          type="button"
          onClick={refresh}
          data-tour="operations-content"
        >
          讀取本機 API 維運快照
        </button>
      </div>
      <div className={styles.snapshot} aria-live="polite" data-tour="operations-result">
        {snapshot ? (
          <>
            <strong>真實後端快照</strong>
            <span>指令 {snapshot.commands}</span>
            <span>完成 {snapshot.completed}</span>
            <span>處理中 {snapshot.active}</span>
            <span>重播事件 {snapshot.replayedEvents}</span>
          </>
        ) : (
          <span>按下按鈕，查看這次本機執行留下的真實數據。</span>
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
          <span>指令</span>
          <strong>請求追蹤 ID</strong>
        </div>
        <i>↓</i>
        <div>
          <span>任務</span>
          <strong>算圖任務 ID</strong>
        </div>
        <i>↓</i>
        <div>
          <span>狀態轉換</span>
          <strong>狀態與事件序列</strong>
        </div>
        <i>↓</i>
        <div>
          <span>成品</span>
          <strong>檔案雜湊值</strong>
        </div>
        <i>↓</i>
        <div>
          <span>成本歸因</span>
          <strong>估算處理成本</strong>
        </div>
      </div>
      <div className={styles.controls}>
        <span>資料庫冪等性</span>
        <span>工作租約復原</span>
        <span>事件序列重播</span>
        <span>租戶額度控制</span>
      </div>
    </section>
  );
}
