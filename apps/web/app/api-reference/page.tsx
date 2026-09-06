const endpointGroups = [
  { name: '媒體資產（Media Assets）', description: '建立與讀取轉檔流程使用的來源媒體。', endpoints: [
    { method: 'POST', path: '/v1/media', purpose: '上傳受大小與格式限制的來源影片', contract: 'multipart 影片 → 媒體資產識別碼' },
    { method: 'POST', path: '/v1/media/demo', purpose: '準備可立即操作與播放的內建示範素材', contract: '內建影片 → 已選取的媒體資產' },
    { method: 'GET', path: '/media/:assetId', purpose: '預覽來源素材並支援位元組範圍請求', contract: '媒體資產識別碼 → 可播放來源影片' },
  ]},
  { name: '算圖任務（Render Jobs）', description: '建立任務、查詢權威狀態並接續進度事件。', endpoints: [
    { method: 'POST', path: '/v1/render-jobs', purpose: '建立具租戶範圍與冪等性的原子指令', contract: '建立算圖任務 → 算圖任務' },
    { method: 'GET', path: '/v1/render-jobs/:id', purpose: '讀取持久化的權威狀態', contract: '任務識別碼 → 算圖任務' },
    { method: 'SSE', path: '/v1/render-jobs/:id/events', purpose: '重播持久化序列並串流傳送後續進度', contract: 'Last-Event-ID 或 after 游標 → 算圖進度事件' },
  ]},
  { name: '維運與可觀測性（Operations & Observability）', description: '取得服務目標、任務統計與最新追蹤證據。', endpoints: [
    { method: 'GET', path: '/v1/operations', purpose: '讀取服務運行指標、SLO 與追蹤證據', contract: '租戶憑證 → 維運快照' },
  ]},
  { name: '串流與成品交付（Streaming & Delivery）', description: '以位元組範圍或 HLS/CMAF 交付處理結果。', endpoints: [
    { method: 'GET', path: '/artifacts/:jobId.mp4', purpose: '以 HTTP Range Request 串流 FFmpeg 成品', contract: '位元組範圍 → MP4 Partial Content' },
    { method: 'GET', path: '/streams/:jobId/:filename', purpose: '交付 HLS Master、Media Playlist、初始化片段與 CMAF Segments', contract: 'Manifest 或媒體分段 → 自適應串流內容' },
  ]},
] as const;

const guarantees = [
  { title: '處理品質', description: '驗證來源影片，產生四種畫質，並以 VMAF 記錄實際品質。', detail: '360p／540p／720p／1080p · H.264 + AAC' },
  { title: '串流交付', description: '同時提供 MP4 範圍請求與 HLS/CMAF 自適應串流。', detail: 'Master Playlist · Media Playlist · CMAF Segments' },
  { title: '任務可靠性', description: '冪等指令避免重複執行；中斷後可接續事件並重新取得工作。', detail: 'Idempotency Key · Last-Event-ID · Worker Lease' },
  { title: '追蹤與隔離', description: '每次操作限定在租戶範圍，並串起任務、事件與成品證據。', detail: 'Trace ID · Request ID · SHA-256' },
] as const;

export default function ApiReference() {
  return <main>
    <header className="nav"><a className="brand" href="/">媒體運行實驗室</a><nav><a href="/">返回影音後台</a></nav></header>
    <section className="docs">
      <p className="eyebrow">API 文件</p>
      <h1>媒體處理 API</h1>
      <p className="lede" data-tour="api-overview">完整涵蓋媒體資產、算圖任務、事件串流、成品交付與維運查詢；Bruno collection 可直接執行相同合約。</p>
      <div className="endpoint-groups">
        {endpointGroups.map((group, groupIndex) => {
          const offset = endpointGroups.slice(0, groupIndex).reduce((total, item) => total + item.endpoints.length, 0);
          return <section className="endpoint-group" key={group.name}>
            <header><h2>{group.name}</h2><p>{group.description}</p></header>
            <div className="endpoint-list">{group.endpoints.map((endpoint, index) => <article key={endpoint.path}>
              <code>{endpoint.method}</code><div><h3 data-tour={`api-endpoint-${offset + index + 1}`}>{endpoint.path}</h3><p>{endpoint.purpose}</p><small>{endpoint.contract}</small></div>
            </article>)}</div>
          </section>;
        })}
      </div>
      <section className="contract" data-tour="api-guarantees">
        <p className="eyebrow">處理流程</p>
        <h2>從接收任務到成品就緒</h2>
        <ol className="contract-flow" aria-label="算圖任務處理流程">
          {['已接受', '合成', 'ABR 編碼', '品質驗證', 'CMAF 封裝', '已就緒'].map((stage) => <li key={stage}>{stage}</li>)}
        </ol>
        <div className="guarantee-grid">
          {guarantees.map((item) => <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <small>{item.detail}</small>
          </article>)}
        </div>
      </section>
    </section>
  </main>;
}
