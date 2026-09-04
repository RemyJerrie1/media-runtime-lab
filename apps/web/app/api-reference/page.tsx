const endpoints = [
  {
    method: 'POST',
    path: '/v1/media',
    purpose: '上傳受大小與格式限制的來源影片',
    contract: 'multipart 影片 → 媒體資產識別碼',
  },
  {
    method: 'POST',
    path: '/v1/media/demo',
    purpose: '準備可立即操作與播放的內建示範素材',
    contract: '內建影片 → 已選取的媒體資產',
  },
  {
    method: 'GET',
    path: '/media/:assetId',
    purpose: '預覽來源素材並支援位元組範圍請求',
    contract: '媒體資產識別碼 → 可播放來源影片',
  },
  {
    method: 'POST',
    path: '/v1/render-jobs',
    purpose: '建立具租戶範圍與冪等性的原子指令',
    contract: '建立算圖任務 → 算圖任務',
  },
  {
    method: 'GET',
    path: '/v1/render-jobs/:id',
    purpose: '讀取持久化的權威狀態',
    contract: '算圖任務｜找不到任務',
  },
  {
    method: 'SSE',
    path: '/v1/render-jobs/:id/events',
    purpose: '先重播持久化序列，再串流傳送進度',
    contract: '最後事件識別碼 → 算圖進度事件',
  },
  {
    method: 'GET',
    path: '/v1/operations',
    purpose: '讀取運行證據與明確服務目標',
    contract: '維運快照',
  },
  {
    method: 'GET',
    path: '/artifacts/:jobId.mp4',
    purpose: '以 HTTP Range Request 串流實際 FFmpeg 成品',
    contract: '位元組範圍 → MP4 Partial Content',
  },
  {
    method: 'HLS',
    path: '/streams/:jobId/master.m3u8',
    purpose: '交付 ABR Master Playlist、各畫質 Playlist 與 CMAF Segments',
    contract: 'Master Manifest → 360p／540p／720p／1080p 自適應串流',
  },
];
const guarantees = `已接受 → 合成中 → ABR 編碼 → VMAF 驗證 → CMAF 封裝 → 已就緒\n       ↘ 失敗       ↘ 失敗       ↘ 失敗       ↘ 失敗\n\n來源素材：受驗證的影片上傳後取得媒體資產識別碼。\nABR Ladder：實際產生 360p／540p／720p／1080p 四個 H.264 + AAC Rendition。\nHLS + CMAF：輸出 Master Playlist、各畫質 Media Playlist、初始化片段與 fragmented MP4 Segments。\nVMAF：以來源與各 Rendition 實際比對；執行環境缺少 libvmaf 時回報 unavailable，不填入範例分數。\n證據鏈：任務 JSON 回傳解析度、碼率、VMAF、Manifest URL、SHA-256、Trace ID 與 Request ID。\n追蹤：POST /v1/render-jobs 接受 W3C traceparent 與 x-request-id，串起任務、事件、成品與成本。\n驗證：指令與狀態介面使用租戶識別與存取金鑰；事件串流使用同等範圍的查詢憑證。\n治理：每個租戶都有請求限流與 Token 額度，/v1/operations 回傳即時用量與證據鏈。\n冪等性：PostgreSQL 唯一限制加上租戶交易鎖。\n復原：Worker 中斷後可重新取得過期的工作租約。\n重播：從最後事件識別碼繼續持久化事件序列。\n原子性：就緒狀態、Manifest、Rendition 收據、雜湊與事件共用同一交易。\n隔離：每次讀取與指令都限定在已驗證租戶。`;
export default function ApiReference() {
  return (
    <main>
      <header className="nav">
        <a className="brand" href="/">
          媒體運行實驗室
        </a>
        <nav>
          <a href="/">返回影音後台</a>
        </nav>
      </header>
      <section className="docs">
        <p className="eyebrow">靜態介面規格參考</p>
        <h1>算圖任務介面</h1>
        <p className="lede" data-tour="api-overview">
          同一份合約規範 NestJS 介面、Next.js 用戶端、PostgreSQL 工作流、Bruno 集合與回歸測試。
        </p>
        <div className="endpoint-list">
          {endpoints.map((endpoint, index) => (
            <article key={endpoint.path}>
              <code>{endpoint.method}</code>
              <div>
                <h2 data-tour={`api-endpoint-${index + 1}`}>{endpoint.path}</h2>
                <p>{endpoint.purpose}</p>
                <small>{endpoint.contract}</small>
              </div>
            </article>
          ))}
        </div>
        <section className="contract">
          <h2 data-tour="api-guarantees">運行保證</h2>
          <pre>{guarantees}</pre>
        </section>
      </section>
    </main>
  );
}
