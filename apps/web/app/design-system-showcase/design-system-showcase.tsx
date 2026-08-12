'use client';

import { useState } from 'react';
import { Button } from '../design-system/button';
import { MetricCard } from '../design-system/metric-card';
import { ProgressBar } from '../design-system/progress-bar';
import { StatusBadge } from '../design-system/status-badge';
import styles from './design-system-showcase.module.css';

type View = 'tokens' | 'components' | 'usage';

const colors = [
  ['Canvas', '--color-canvas', '#080b12'], ['Surface', '--color-surface', '#101724'],
  ['Text', '--color-text', '#f3eee8'], ['Muted', '--color-text-muted', '#9eacba'],
  ['Accent', '--color-accent', '#5bd7e8'], ['Action', '--color-action', '#f1ae79'],
  ['Success', '--color-success', '#79d29d'], ['Danger', '--color-danger', '#ff8fa3'],
];
const spaces = [['01','4'],['02','8'],['03','12'],['04','16'],['05','22'],['06','30'],['07','40'],['08','56']];
const usage = [
  { name: 'Button', source: 'design-system/button.tsx', products: ['Render Lab', 'Error Recovery'], states: '3 variants · loading · disabled' },
  { name: 'MetricCard', source: 'design-system/metric-card.tsx', products: ['Render Lab', 'Job Evidence'], states: 'default · accent · success' },
  { name: 'ProgressBar', source: 'design-system/progress-bar.tsx', products: ['Render Lab', 'Cost Governance'], states: 'accent · success · warning' },
  { name: 'StatusBadge', source: 'design-system/status-badge.tsx', products: ['Composition', 'Delivery'], states: '5 semantic tones' },
];

export function DesignSystemShowcase() {
  const [view, setView] = useState<View>('tokens');
  return <main className={styles.page}>
    <header className={styles.header}>
      <a className={styles.brand} href="/">MEDIA RUNTIME LAB</a>
      <a className={styles.back} href="/">← PRODUCT EXPERIENCE</a>
    </header>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>DESIGN SYSTEM · V1.0</p><h1>One visual language.<br/>Every runtime state.</h1><p>Production primitives, semantic tokens, and traceable product adoption for the governed media workflow.</p></div>
      <div className={styles.summary}><span><b>28</b>FOUNDATION TOKENS</span><span><b>04</b>PRODUCTION PRIMITIVES</span><span><b>03</b>PRODUCT SURFACES</span></div>
    </section>
    <nav className={styles.tabs} aria-label="Design system views">
      {(['tokens','components','usage'] as View[]).map((item) => <button key={item} data-active={view === item} onClick={() => setView(item)}>{item === 'tokens' ? '01 · TOKENS' : item === 'components' ? '02 · COMPONENTS' : '03 · PRODUCT USAGE'}</button>)}
    </nav>

    {view === 'tokens' && <section className={styles.content}>
      <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>SEMANTIC COLOR</p><h2>Color communicates system state.</h2></div><StatusBadge tone="success">8 CORE ROLES</StatusBadge></div>
      <div className={styles.colorGrid}>{colors.map(([label, token, value]) => <article className={styles.swatch} key={token}><i style={{ background: value }} /><div><strong>{label}</strong><code>{token}</code><span>{value}</span></div></article>)}</div>
      <div className={styles.foundationGrid}>
        <article className={styles.foundation}><p className={styles.eyebrow}>SPACING SCALE</p>{spaces.map(([label,value]) => <div className={styles.spaceRow} key={label}><code>{label}</code><i style={{ width: `${Number(value) * 2.2}px` }} /><span>{value}px</span></div>)}</article>
        <article className={styles.foundation}><p className={styles.eyebrow}>TYPE & RADIUS</p><div className={styles.typeSample}><span>DISPLAY · 52/56</span><strong>Media Compute</strong></div><div className={styles.typeSample}><span>BODY · 17/28</span><p>Readable operational evidence across product surfaces.</p></div><div className={styles.radiusRow}><i data-radius="sm"/><i data-radius="md"/><i data-radius="lg"/><i data-radius="pill"/></div></article>
      </div>
    </section>}

    {view === 'components' && <section className={styles.content}>
      <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>PRODUCTION PRIMITIVES</p><h2>Variants and states, rendered from source.</h2></div><StatusBadge tone="accent">LIVE COMPONENTS</StatusBadge></div>
      <div className={styles.componentGrid}>
        <article className={styles.component}><header><div><code>Button</code><h3>Command actions</h3></div><StatusBadge tone="success">STABLE</StatusBadge></header><div className={styles.demoRow}><Button>RUN RENDER JOB</Button><Button variant="secondary">VIEW RECEIPT</Button><Button variant="ghost">API CONTRACT</Button><Button disabled>CREATING…</Button></div></article>
        <article className={styles.component}><header><div><code>StatusBadge</code><h3>Runtime semantics</h3></div><StatusBadge tone="success">STABLE</StatusBadge></header><div className={styles.demoRow}><StatusBadge>QUEUED</StatusBadge><StatusBadge tone="accent">PROCESSING</StatusBadge><StatusBadge tone="success">READY</StatusBadge><StatusBadge tone="warning">THROTTLED</StatusBadge><StatusBadge tone="danger">FAILED</StatusBadge></div></article>
        <article className={styles.component}><header><div><code>MetricCard</code><h3>Operational evidence</h3></div><StatusBadge tone="success">STABLE</StatusBadge></header><div className={styles.metricGrid}><MetricCard label="JOB STATUS" value="PROCESSING" tone="accent"/><MetricCard label="ARTIFACT" value="READY" tone="success"/><MetricCard label="COST / TOKEN" value="$0.083 / 4,920"/></div></article>
        <article className={styles.component}><header><div><code>ProgressBar</code><h3>Lifecycle progress</h3></div><StatusBadge tone="success">STABLE</StatusBadge></header><div className={styles.progressStack}><ProgressBar label="RENDER PROGRESS" value={68}/><ProgressBar label="ARTIFACT DELIVERY" value={100} tone="success"/><ProgressBar label="TOKEN BUDGET" value={84} tone="warning"/></div></article>
      </div>
    </section>}

    {view === 'usage' && <section className={styles.content}>
      <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>TRACEABLE ADOPTION</p><h2>Every primitive maps back to product.</h2></div><StatusBadge tone="success">NO ORPHAN PRIMITIVES</StatusBadge></div>
      <div className={styles.usageList}>{usage.map((item, index) => <article key={item.name}><span className={styles.index}>0{index + 1}</span><div><code>{item.source}</code><h3>{item.name}</h3></div><div className={styles.productTags}>{item.products.map((product) => <span key={product}>{product}</span>)}</div><p>{item.states}</p></article>)}</div>
      <div className={styles.map}><div><span>SEMANTIC TOKENS</span><strong>Color · Space · Type · Radius</strong></div><i>→</i><div><span>PRODUCTION PRIMITIVES</span><strong>Button · Metric · Status · Progress</strong></div><i>→</i><div><span>PRODUCT SURFACES</span><strong>Render · Compose · Govern</strong></div></div>
    </section>}
  </main>;
}