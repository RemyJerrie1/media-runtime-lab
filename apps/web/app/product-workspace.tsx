'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { CompositionShowcase } from './features/composition-showcase/composition-showcase';
import { CostGovernance } from './features/cost-governance/cost-governance';
import { OperationsEvidence } from './features/operations-evidence/operations-evidence';
import { RenderLab } from './features/render-lab/render-lab';
import type { TourTabId } from './interview-tour-model';
import { isWorkspaceSection, type WorkspaceSection } from './workspace-sections';

type TabId = TourTabId & WorkspaceSection;
const tabs: [TabId, string, string][] = [
  ['overview', '平台概覽', '服務與處理範圍'],
  ['render', '影音工作台', '轉檔、編碼與交付'],
  ['composition', '媒體合成', '字幕、浮水印與時間軸'],
  ['cost', '成本', '用量與預算'],
  ['operations', '維運', '狀態與追蹤'],
  ['architecture', '架構', '服務邊界'],
];

function Overview() {
  return (
    <section className="workspace-overview">
      <p className="eyebrow">媒體運行實驗室</p>
      <h1>影音平台營運後台</h1>
      <p className="lede">統一管理轉檔、串流交付、服務品質與用量。</p>
      <div className="overview-grid" data-tour="overview-summary">
        <article>
          <span>處理流程</span>
          <strong>上傳 → 轉檔 → 交付</strong>
        </article>
        <article>
          <span>服務狀態</span>
          <strong>監控 → 復原 → 追蹤</strong>
        </article>
        <article>
          <span>任務控制</span>
          <strong>去重 → 續傳 → 完成</strong>
        </article>
        <article>
          <span>用量管理</span>
          <strong>紀錄 → 歸因 → 額度</strong>
        </article>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section className="workspace-architecture">
      <p className="eyebrow">系統邊界</p>
      <h2>產品流程、工程邊界與可驗證的維運證據。</h2>
      <div className="flow" data-tour="architecture-content">
        <article>
          <b>01 · 產品體驗</b>
          <h3>Next.js + TypeScript</h3>
          <p>算圖指令、即時進度與交付回饋。</p>
        </article>
        <i>→</i>
        <article>
          <b>02 · 介面與工作流</b>
          <h3>NestJS 應用程式</h3>
          <p>合約驗證、冪等性與任務生命週期。</p>
        </article>
        <i>→</i>
        <article>
          <b>03 · 媒體處理</b>
          <h3>Canvas + FFmpeg 轉接器</h3>
          <p>字幕、精靈圖、合成與確定性輸出。</p>
        </article>
        <i>→</i>
        <article>
          <b>04 · 交付與維運</b>
          <h3>成品與用量帳本</h3>
          <p>雜湊值、復原、Token 用量與成本歸因。</p>
        </article>
      </div>
    </section>
  );
}

export function ProductWorkspace({ initialTab = 'overview' }: { initialTab?: TabId }) {
  const [active, setActive] = useState<TabId>(initialTab);
  const selectActive = useCallback((next: TabId, historyMode: 'push' | 'replace' = 'push') => {
    setActive(next);
    const nextPath = `/${next}`;
    if (window.location.pathname !== nextPath) {
      window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({}, '', nextPath);
    }
  }, []);
  useEffect(() => {
    const requested = window.location.pathname.slice(1);
    if (isWorkspaceSection(requested)) {
      setActive(requested);
      if (new URLSearchParams(window.location.search).get('focus') === 'decision') {
        window.setTimeout(
          () => document.querySelector('.encoding-decision')?.scrollIntoView({ block: 'center' }),
          350,
        );
      }
    }
    const restoreFromHistory = () => {
      const section = window.location.pathname.slice(1);
      if (isWorkspaceSection(section)) setActive(section);
    };
    window.addEventListener('popstate', restoreFromHistory);
    return () => window.removeEventListener('popstate', restoreFromHistory);
  }, []);
  useEffect(() => {
    const selectTab = (event: Event) => {
      const requested = event instanceof CustomEvent ? (event.detail as TabId) : undefined;
      if (requested && tabs.some(([id]) => id === requested)) selectActive(requested, 'replace');
    };
    window.addEventListener('media-lab:select-tab', selectTab);
    return () => window.removeEventListener('media-lab:select-tab', selectTab);
  }, [selectActive]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const current = tabs.findIndex(([id]) => id === active);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const next = tabs[(current + direction + tabs.length) % tabs.length]![0];
    selectActive(next);
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };
  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <a className="workspace-brand" href="/overview">
          媒體運行實驗室
        </a>
        <button
          className="tour-launch"
          type="button"
          onClick={() => window.dispatchEvent(new Event('media-lab:start-tour'))}
        >
          <span>互動導覽</span>
          <strong>開始導覽 →</strong>
          <small>跟著實際操作認識影音營運後台</small>
        </button>
        <div
          className="workspace-tabs"
          role="tablist"
          aria-label="平台明暗主題"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
        >
          {tabs.map(([id, label, description]) => (
            <button
              id={`tab-${id}`}
              key={id}
              role="tab"
              aria-selected={active === id}
              aria-controls={`panel-${id}`}
              tabIndex={active === id ? 0 : -1}
              data-tour={`tab-${id}`}
              className={
                ['cost', 'operations', 'architecture'].includes(id)
                  ? 'workspace-tab-secondary'
                  : undefined
              }
              onClick={() => selectActive(id)}
            >
              <strong>{label}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
        <nav className="workspace-links" aria-label="參考頁面">
          <a href="/design-system" data-tour="open-design-system">
            設計系統預覽
          </a>
          <a href="/api-reference">API 文件</a>
        </nav>
      </aside>
      <div className="workspace-content">
        <div
          id={`panel-${active}`}
          className="workspace-panel"
          role="tabpanel"
          aria-labelledby={`tab-${active}`}
          tabIndex={0}
        >
          {active === 'overview' ? (
            <Overview />
          ) : active === 'render' ? (
            <RenderLab />
          ) : active === 'composition' ? (
            <CompositionShowcase />
          ) : active === 'cost' ? (
            <CostGovernance />
          ) : active === 'operations' ? (
            <OperationsEvidence />
          ) : (
            <Architecture />
          )}
        </div>
      </div>
    </main>
  );
}
