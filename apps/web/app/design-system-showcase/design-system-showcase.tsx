'use client';

import { useState } from 'react';
import { Button } from '../design-system/button';
import { MetricCard } from '../design-system/metric-card';
import { ProgressBar } from '../design-system/progress-bar';
import { StatusBadge } from '../design-system/status-badge';
import styles from './design-system-showcase.module.css';

type View = 'tokens' | 'components' | 'usage';
const colors = [
  ['畫布', '--color-canvas', '#080b12'],
  ['表面', '--color-surface', '#101724'],
  ['主要文字', '--color-text', '#f3eee8'],
  ['次要文字', '--color-text-muted', '#9eacba'],
  ['強調色', '--color-accent', '#5bd7e8'],
  ['操作色', '--color-action', '#f1ae79'],
  ['成功', '--color-success', '#79d29d'],
  ['危險', '--color-danger', '#ff8fa3'],
];
const spaces = [
  ['01', '4'],
  ['02', '8'],
  ['03', '12'],
  ['04', '16'],
  ['05', '22'],
  ['06', '30'],
  ['07', '40'],
  ['08', '56'],
];
const usage = [
  {
    name: '按鈕',
    source: 'design-system/button.tsx',
    products: ['影音工作台', '錯誤復原'],
    states: '三種樣式、載入中、停用',
  },
  {
    name: '指標卡片',
    source: 'design-system/metric-card.tsx',
    products: ['影音工作台', '任務證據'],
    states: '預設、強調、成功',
  },
  {
    name: '進度列',
    source: 'design-system/progress-bar.tsx',
    products: ['影音工作台', '成本治理'],
    states: '強調、成功、警告',
  },
  {
    name: '狀態徽章',
    source: 'design-system/status-badge.tsx',
    products: ['媒體合成', '成品交付'],
    states: '五種語意狀態',
  },
];

export function DesignSystemShowcase() {
  const [view, setView] = useState<View>('tokens');
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/">
          媒體運行實驗室
        </a>
        <div className={styles.headerLinks}>
          <a className={styles.back} href="/">
            返回影音後台
          </a>
          <a className={styles.back} href="/api-reference" data-tour="open-api-reference">
            前往介面規格 →
          </a>
        </div>
      </header>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>設計系統 · 版本 1.0</p>
          <h1>
            同一套視覺語言，
            <br />
            涵蓋所有運行狀態。
          </h1>
          <p>以語意色彩、基礎元件與可追蹤的採用關係，支撐受治理的媒體工作流。</p>
        </div>
        <div className={styles.summary}>
          <span>
            <b>28</b>基礎設計變數
          </span>
          <span>
            <b>04</b>正式共用元件
          </span>
          <span>
            <b>03</b>主要產品介面
          </span>
        </div>
      </section>
      <nav className={styles.tabs} aria-label="設計系統分類" data-tour="design-tabs">
        {(['tokens', 'components', 'usage'] as View[]).map((item) => (
          <button
            key={item}
            data-tour={`design-tab-${item}`}
            aria-current={view === item ? 'page' : undefined}
            data-active={view === item}
            onClick={() => setView(item)}
          >
            {item === 'tokens'
              ? '01 · 設計變數'
              : item === 'components'
                ? '02 · 共用元件'
                : '03 · 產品採用'}
          </button>
        ))}
      </nav>
      {view === 'tokens' ? (
        <section className={styles.content}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>語意色彩</p>
              <h2>色彩用來傳達系統狀態。</h2>
            </div>
            <StatusBadge tone="success">八種核心角色</StatusBadge>
          </div>
          <div className={styles.colorGrid}>
            {colors.map(([label, token, value], index) => (
              <article
                className={styles.swatch}
                key={token}
                data-tour={index === 0 ? 'design-tokens' : undefined}
              >
                <i style={{ background: value }} />
                <div>
                  <strong>{label}</strong>
                  <code>{token}</code>
                  <span>{value}</span>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.foundationGrid}>
            <article className={styles.foundation} data-tour="design-spacing">
              <p className={styles.eyebrow}>間距尺度</p>
              {spaces.map(([label, value]) => (
                <div className={styles.spaceRow} key={label}>
                  <code>{label}</code>
                  <i style={{ width: `${Number(value) * 2.2}px` }} />
                  <span>{value} 像素</span>
                </div>
              ))}
            </article>
            <article className={styles.foundation} data-tour="design-typography">
              <p className={styles.eyebrow}>字體階層與圓角</p>
              <div className={styles.typeScale}>
                <div data-type="display">
                  <span>頁面標題 · 40–60／1.18</span>
                  <strong>媒體運算決策</strong>
                </div>
                <div data-type="section">
                  <span>區塊標題 · 28–40／1.25</span>
                  <strong>品質與成本取捨</strong>
                </div>
                <div data-type="body">
                  <span>主要內文 · 16／1.65</span>
                  <p>讓所有產品介面的維運證據都清楚可讀。</p>
                </div>
                <div data-type="caption">
                  <span>輔助文字 · 14／1.55</span>
                  <p>適用於單位、補充說明與資料來源。</p>
                </div>
              </div>
              <div className={styles.radiusRow}>
                <i data-radius="sm" />
                <i data-radius="md" />
                <i data-radius="lg" />
                <i data-radius="pill" />
              </div>
            </article>
          </div>
        </section>
      ) : null}
      {view === 'components' ? (
        <section className={styles.content}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>正式共用元件</p>
              <h2>直接呈現元件樣式與互動狀態。</h2>
            </div>
            <StatusBadge tone="accent">即時元件</StatusBadge>
          </div>
          <div className={styles.componentGrid} data-tour="design-components">
            <article className={styles.component} data-tour="design-buttons">
              <header>
                <div>
                  <code>Button</code>
                  <h3>指令操作</h3>
                </div>
                <StatusBadge tone="success">穩定</StatusBadge>
              </header>
              <div className={styles.demoRow}>
                <Button>執行算圖</Button>
                <Button variant="secondary">查看收據</Button>
                <Button variant="ghost">介面合約</Button>
                <Button disabled>建立中…</Button>
              </div>
            </article>
            <article className={styles.component} data-tour="design-statuses">
              <header>
                <div>
                  <code>StatusBadge</code>
                  <h3>運行狀態語意</h3>
                </div>
                <StatusBadge tone="success">穩定</StatusBadge>
              </header>
              <div className={styles.demoRow}>
                <StatusBadge>排隊中</StatusBadge>
                <StatusBadge tone="accent">處理中</StatusBadge>
                <StatusBadge tone="success">已就緒</StatusBadge>
                <StatusBadge tone="warning">已限流</StatusBadge>
                <StatusBadge tone="danger">失敗</StatusBadge>
              </div>
            </article>
            <article className={styles.component} data-tour="design-metrics">
              <header>
                <div>
                  <code>MetricCard</code>
                  <h3>維運證據</h3>
                </div>
                <StatusBadge tone="success">穩定</StatusBadge>
              </header>
              <div className={styles.metricGrid}>
                <MetricCard label="任務狀態" value="處理中" tone="accent" />
                <MetricCard label="成品" value="已就緒" tone="success" />
                <MetricCard label="成本／Token" value="$0.083 / 4,920" />
              </div>
            </article>
            <article className={styles.component} data-tour="design-progress">
              <header>
                <div>
                  <code>ProgressBar</code>
                  <h3>生命週期進度</h3>
                </div>
                <StatusBadge tone="success">穩定</StatusBadge>
              </header>
              <div className={styles.progressStack}>
                <ProgressBar label="算圖進度" value={68} />
                <ProgressBar label="成品交付" value={100} tone="success" />
                <ProgressBar label="Token 預算" value={84} tone="warning" />
              </div>
            </article>
          </div>
        </section>
      ) : null}
      {view === 'usage' ? (
        <section className={styles.content}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.eyebrow}>可追蹤的採用關係</p>
              <h2>每個共用元件都能對應到產品介面。</h2>
            </div>
            <StatusBadge tone="success">沒有孤立元件</StatusBadge>
          </div>
          <div className={styles.usageList}>
            {usage.map((item, index) => (
              <article key={item.name}>
                <span className={styles.index}>0{index + 1}</span>
                <div data-tour={index === 0 ? 'design-usage' : undefined}>
                  <code>{item.source}</code>
                  <h3>{item.name}</h3>
                </div>
                <div className={styles.productTags}>
                  {item.products.map((product) => (
                    <span key={product}>{product}</span>
                  ))}
                </div>
                <p>{item.states}</p>
              </article>
            ))}
          </div>
          <div className={styles.map}>
            <div data-tour="design-adoption-map">
              <span>語意設計變數</span>
              <strong>色彩 · 間距 · 字體 · 圓角</strong>
            </div>
            <i>→</i>
            <div>
              <span>正式共用元件</span>
              <strong>按鈕 · 指標 · 狀態 · 進度</strong>
            </div>
            <i>→</i>
            <div>
              <span>產品介面</span>
              <strong>算圖 · 合成 · 治理</strong>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
