import { StatusBadge } from '../../design-system/status-badge';
import styles from './operations-evidence.module.css';

const targets = [
  { value: '99.9%', label: '算圖成功率目標', detail: '終態轉換服務目標' },
  { value: '≤ 2 秒', label: '復原時間', detail: '持久化序列重播' },
  { value: '0%', label: '重複執行率', detail: '資料庫強制唯一識別' },
  { value: '100%', label: '追蹤完整度', detail: '從指令到成本證據' },
];

export function OperationsEvidence() {
  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">維運證據</p>
          <h2>明確的目標、故障控制與可追蹤收據。</h2>
          <p>以下是參考系統的工程目標，不代表歷史客戶流量的實績聲明。</p>
        </div>
        <StatusBadge tone="success">持續整合已驗證</StatusBadge>
      </div>
      <div className={styles.targets}>
        {targets.map((target) => (
          <article key={target.label}>
            <strong>{target.value}</strong>
            <span>{target.label}</span>
            <p>{target.detail}</p>
          </article>
        ))}
      </div>
      <div className={styles.trace}>
        <div>
          <span>指令</span>
          <strong>trace_91A2</strong>
        </div>
        <i>↓</i>
        <div>
          <span>任務</span>
          <strong>job_72C1</strong>
        </div>
        <i>↓</i>
        <div>
          <span>狀態轉換</span>
          <strong>序列 05 · 就緒</strong>
        </div>
        <i>↓</i>
        <div>
          <span>成品</span>
          <strong>雜湊值已驗證</strong>
        </div>
        <i>↓</i>
        <div>
          <span>成本歸因</span>
          <strong>$0.083 · 4,920 Token</strong>
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
