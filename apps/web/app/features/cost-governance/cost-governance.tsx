'use client';

import { useEffect, useState } from 'react';
import { SectionHeading } from '../../shared/ui/section-heading';
import { aggregateUsage, budgetUtilization, USAGE_EVENTS } from './cost-model';
import styles from './cost-governance.module.css';

const STEPS = [
  ['01','請求脈絡','租戶 · 工作區 · 專案'],
  ['02','供應商收據','模型 · 提示詞 · 回覆'],
  ['03','用量帳本','僅附加的用量事件'],
  ['04','成本歸因','專案 · 功能 · 客戶'],
  ['05','預算閘門','告警 · 限流 · 降級'],
] as const;

export function CostGovernance() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setTick((current) => (current + 1) % 15), 720);
    return () => window.clearInterval(timer);
  }, []);

  const step = tick % STEPS.length;
  const eventIndex = Math.floor(tick / STEPS.length);
  const event = USAGE_EVENTS[eventIndex]!;
  const totals = aggregateUsage(USAGE_EVENTS.slice(0, eventIndex + 1));
  const budget = budgetUtilization(totals.costUsd);

  return <section id="cost" className={styles.section}>
    <SectionHeading
      eyebrow="人工智慧用量與成本治理"
      title="每次模型呼叫都能追溯到功能、專案與工作區"
      description="模型供應商回傳的 Token 用量會先轉成標準事件，再寫入不可變更的用量帳本；成本、額度與告警因此共用同一份事實來源。"
    />
    <div className={styles.panel}>
      <div className={styles.pipeline}>
        {STEPS.map(([index,title,detail], position) => <article className={styles.node} data-active={position === step} key={index}>
          <b>{index}</b><strong>{title}</strong><p>{detail}</p>
        </article>)}
      </div>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>已記錄請求</span><strong>{totals.requests}</strong></div>
        <div className={styles.metric}><span>Token 總量</span><strong>{totals.tokens.toLocaleString()}</strong></div>
        <div className={styles.metric}><span>已歸因成本</span><strong>${totals.costUsd.toFixed(4)}</strong></div>
        <div className={styles.metric}><span>預算使用率</span><strong>{budget}%</strong><div className={styles.budget}><i style={{width:`${budget}%`}} /></div></div>
      </div>
      <div className={styles.receipt} aria-label="目前用量事件">
        <span className={styles.event}>{event.id}</span><strong>{event.provider} · {event.model}</strong><span>{event.workspace}／{event.project}</span><span>輸入 {event.promptTokens} · 輸出 {event.completionTokens}</span><strong>${event.costUsd.toFixed(4)}</strong>
      </div>
    </div>
  </section>;
}
