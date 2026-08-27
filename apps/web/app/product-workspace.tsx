'use client';

import {useEffect,useState,type KeyboardEvent} from 'react';
import {CompositionShowcase} from './features/composition-showcase/composition-showcase';
import {CostGovernance} from './features/cost-governance/cost-governance';
import {OperationsEvidence} from './features/operations-evidence/operations-evidence';
import {RenderLab} from './features/render-lab/render-lab';

type TabId='overview'|'render'|'composition'|'cost'|'operations'|'architecture';
const tabs:[TabId,string,string][]=[['overview','作品概覽','核心價值與系統範圍'],['render','影音工作台','剪輯、編碼與交付'],['composition','媒體合成','字幕、精靈圖與時間軸'],['cost','人工智慧成本','用量、預算與歸因'],['operations','維運證據','目標、復原與追蹤'],['architecture','系統架構','邊界與責任分工']];

function Overview(){return <section className="workspace-overview"><p className="eyebrow">媒體運行實驗室</p><h1>受治理的媒體運算，<br/>從內容建立到成本歸因。</h1><p className="lede">以確定性 Canvas 與 FFmpeg 工作流承接不穩定的人工智慧輸出，讓每次算圖都可追蹤、可復原、可歸因。</p><div className="overview-grid"><article><span>媒體生命週期</span><strong>建立 → 合成 → 交付</strong></article><article><span>服務品質</span><strong>追蹤 → 復原 → 最佳化</strong></article><article><span>工作流保證</span><strong>冪等 → 重播 → 原子完成</strong></article><article><span>成本治理</span><strong>用量 → 歸因 → 額度控制</strong></article></div></section>}

function Architecture(){return <section className="workspace-architecture"><p className="eyebrow">系統邊界</p><h2>產品流程、工程邊界與可驗證的維運證據。</h2><div className="flow"><article><b>01 · 產品體驗</b><h3>Next.js + TypeScript</h3><p>算圖指令、即時進度與交付回饋。</p></article><i>→</i><article><b>02 · 介面與工作流</b><h3>NestJS 應用程式</h3><p>合約驗證、冪等性與任務生命週期。</p></article><i>→</i><article><b>03 · 媒體處理</b><h3>Canvas + FFmpeg 轉接器</h3><p>字幕、精靈圖、合成與確定性輸出。</p></article><i>→</i><article><b>04 · 交付與維運</b><h3>成品與用量帳本</h3><p>雜湊值、復原、Token 用量與成本歸因。</p></article></div></section>}

export function ProductWorkspace(){
  const [active,setActive]=useState<TabId>('overview');
  useEffect(()=>{const requested=window.location.hash.slice(1) as TabId;if(tabs.some(([id])=>id===requested))setActive(requested);},[]);
  const onKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;event.preventDefault();const current=tabs.findIndex(([id])=>id===active);const direction=event.key==='ArrowDown'?1:-1;const next=tabs[(current+direction+tabs.length)%tabs.length]![0];setActive(next);requestAnimationFrame(()=>document.getElementById(`tab-${next}`)?.focus());};
  return <main className="workspace-shell"><aside className="workspace-sidebar"><a className="workspace-brand" href="/">媒體運行實驗室</a><div className="workspace-tabs" role="tablist" aria-label="作品主題" aria-orientation="vertical" onKeyDown={onKeyDown}>{tabs.map(([id,label,description])=><button id={`tab-${id}`} key={id} role="tab" aria-selected={active===id} aria-controls={`panel-${id}`} tabIndex={active===id?0:-1} onClick={()=>setActive(id)}><strong>{label}</strong><span>{description}</span></button>)}</div><nav className="workspace-links" aria-label="參考頁面"><a href="/design-system">設計系統預覽</a><a href="/api-reference">介面規格參考</a></nav></aside><div className="workspace-content"><div id={`panel-${active}`} className="workspace-panel" role="tabpanel" aria-labelledby={`tab-${active}`} tabIndex={0}>{active==='overview'?<Overview/>:active==='render'?<RenderLab/>:active==='composition'?<CompositionShowcase/>:active==='cost'?<CostGovernance/>:active==='operations'?<OperationsEvidence/>:<Architecture/>}</div></div></main>;
}
