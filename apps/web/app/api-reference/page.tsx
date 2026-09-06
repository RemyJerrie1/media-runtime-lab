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

const guarantees = `已接受 → 合成中 → ABR 編碼 → VMAF 驗證 → CMAF 封裝 → 已就緒
       ↘ 失敗       ↘ 失敗       ↘ 失敗       ↘ 失敗

來源素材：受驗證的影片上傳後取得媒體資產識別碼。
ABR Ladder：實際產生 360p／540p／720p／1080p 四個 H.264 + AAC Rendition。
HLS + CMAF：輸出 Master Playlist、各畫質 Media Playlist、初始化片段與 fragmented MP4 Segments。
VMAF：以來源與各 Rendition 實際比對；執行環境缺少 libvmaf 時回報 unavailable，不填入範例分數。
證據鏈：任務 JSON 回傳解析度、碼率、VMAF、Manifest URL、SHA-256、Trace ID 與 Request ID。
追蹤：POST /v1/render-jobs 接受 W3C traceparent 與 x-request-id，串起任務、事件、成品與成本。
驗證：指令與狀態 API 使用租戶識別與存取金鑰；事件串流使用同等範圍的查詢憑證。
治理：每個租戶都有請求限流與 Token 額度，/v1/operations 回傳即時用量與證據鏈。
冪等性：PostgreSQL 唯一限制加上租戶交易鎖。
復原：Worker 中斷後可重新取得過期的工作租約。
重播：從最後事件識別碼繼續持久化事件序列。
原子性：就緒狀態、Manifest、Rendition 收據、雜湊與事件共用同一交易。
隔離：每次讀取與指令都限定在已驗證租戶。`;

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
      <section className="contract"><h2 data-tour="api-guarantees">運行保證</h2><pre>{guarantees}</pre></section>
    </section>
  </main>;
}
