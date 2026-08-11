'use client';

import { useEffect, useState } from 'react';
import { SectionHeading } from '../../shared/ui/section-heading';
import { aggregateUsage, budgetUtilization, USAGE_EVENTS } from './cost-model';
import styles from './cost-governance.module.css';

const STEPS = [
  ['01','Request Context','tenant · workspace · project'],
  ['02','Provider Receipt','model · prompt · completion'],
  ['03','Usage Ledger','append-only usage event'],
  ['04','Cost Attribution','project · feature · customer'],
  ['05','Budget Gate','alert · throttle · fallback'],
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
      eyebrow="AI USAGE & COST GOVERNANCE"
      title="每次模型呼叫都能追溯到功能、專案與工作區"
      description="Provider 回傳的 Token Usage 先轉成標準化事件，再進入不可變更的用量帳本；成本、額度與告警因此使用同一份事實來源。"
    />
    <div className={styles.panel}>
      <div className={styles.pipeline}>
        {STEPS.map(([index,title,detail], position) => <article className={styles.node} data-active={position === step} key={index}>
          <b>{index}</b><strong>{title}</strong><p>{detail}</p>
        </article>)}
      </div>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>RECORDED REQUESTS</span><strong>{totals.requests}</strong></div>
        <div className={styles.metric}><span>TOTAL TOKENS</span><strong>{totals.tokens.toLocaleString()}</strong></div>
        <div className={styles.metric}><span>ATTRIBUTED COST</span><strong>${totals.costUsd.toFixed(4)}</strong></div>
        <div className={styles.metric}><span>BUDGET UTILIZATION</span><strong>{budget}%</strong><div className={styles.budget}><i style={{width:`${budget}%`}} /></div></div>
      </div>
      <div className={styles.receipt}>
        <span className={styles.event}>{event.id}</span><strong>{event.provider} · {event.model}</strong><span>{event.workspace} / {event.project}</span><span>{event.promptTokens} in · {event.completionTokens} out</span><strong>${event.costUsd.toFixed(4)}</strong>
      </div>
    </div>
  </section>;
}
