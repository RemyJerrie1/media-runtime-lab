'use client';

import { useState } from 'react';
import { SectionHeading } from '../../shared/ui/section-heading';
import { aggregateUsage, budgetUtilization, USAGE_EVENTS } from './cost-model';
import styles from './cost-governance.module.css';

const STEPS = [
  ['01', '請求脈絡', '租戶 · 工作區 · 專案'],
  ['02', '供應商收據介面', '統一用量格式'],
  ['03', '用量帳本', '僅附加的用量事件'],
  ['04', '成本歸因', '專案 · 功能 · 客戶'],
  ['05', '預算閘門', '告警 · 限流 · 降級'],
] as const;

export function CostGovernance() {
  const [eventIndex, setEventIndex] = useState(0);
  const [budgetUsd, setBudgetUsd] = useState(0.02);
  const event = USAGE_EVENTS[eventIndex]!;
  const totals = aggregateUsage(USAGE_EVENTS.slice(0, eventIndex + 1));
  const budget = budgetUtilization(totals.costUsd, budgetUsd);
  const decision =
    budget >= 100 ? '停止非必要生成' : budget >= 75 ? '告警並改用低成本模型' : '允許執行';

  return (
    <section id="cost" className={styles.section}>
      <SectionHeading
        eyebrow="人工智慧用量與成本治理"
        title="示範如何把模型用量歸因到功能、專案與工作區"
        description="目前使用固定範例資料，尚未連接 AI 模型供應商。正式環境會把供應商回傳的 Token 用量標準化，再寫入不可變更的用量帳本。"
      />
      <div className={styles.panel}>
        <div className={styles.simulator} data-tour="cost-content">
          <label>
            使用情境
            <select
              value={eventIndex}
              onChange={(event) => setEventIndex(Number(event.target.value))}
            >
              {USAGE_EVENTS.map((item, index) => (
                <option key={item.id} value={index}>
                  {item.project} · {item.model}
                </option>
              ))}
            </select>
          </label>
          <label>
            本次預算（美元）
            <input
              type="number"
              min="0.005"
              step="0.005"
              value={budgetUsd}
              onChange={(event) => setBudgetUsd(Math.max(0.005, Number(event.target.value)))}
            />
          </label>
          <div className={styles.decision}>
            <span>系統決策</span>
            <strong>{decision}</strong>
            <small>依預設費率估算，未呼叫模型</small>
          </div>
        </div>
        <div className={styles.pipeline} data-tour="cost-pipeline">
          {STEPS.map(([index, title, detail]) => (
            <article className={styles.node} key={index}>
              <b>{index}</b>
              <strong>{title}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </div>
        <div className={styles.metrics} data-tour="cost-metrics">
          <div className={styles.metric}>
            <span>已記錄請求</span>
            <strong>{totals.requests}</strong>
          </div>
          <div className={styles.metric}>
            <span>預估 Token 總量</span>
            <strong>{totals.tokens.toLocaleString()}</strong>
          </div>
          <div className={styles.metric}>
            <span>預估歸因成本</span>
            <strong>${totals.costUsd.toFixed(4)}</strong>
          </div>
          <div className={styles.metric}>
            <span>預算使用率</span>
            <strong>{budget}%</strong>
            <div className={styles.budget}>
              <i style={{ width: `${budget}%` }} />
            </div>
          </div>
        </div>
        <div
          className={styles.receipt}
          data-tour="cost-receipt"
          aria-label="預估用量事件（未連接模型供應商）"
        >
          <span className={styles.event}>{event.id}</span>
          <strong>
            {event.provider} · {event.model}
          </strong>
          <span>
            {event.workspace}／{event.project}
          </span>
          <span>
            輸入 {event.promptTokens} · 輸出 {event.completionTokens}
          </span>
          <strong>${event.costUsd.toFixed(4)}</strong>
        </div>
      </div>
    </section>
  );
}
