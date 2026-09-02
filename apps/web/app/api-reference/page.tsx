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
];
const guarantees = `已接受 → 合成中 → 編碼中 → 封裝中 → 已就緒\n       ↘ 失敗     ↘ 失敗     ↘ 失敗\n\n來源素材：受驗證的影片上傳後取得媒體資產識別碼。\n真實 Worker：ffprobe 先檢測來源，FFmpeg 依 CRF／Bitrate、Preset、FPS、GOP 等參數轉檔，再由 ffprobe 驗證成品。\nArtifact：成品寫入靜態服務目錄、計算 SHA-256，並支援 HTTP Range Request 與 <video> 播放。\n處理合約：剪輯起點、長度、編碼設定與處理設定。\n冪等性：PostgreSQL 唯一限制加上租戶交易鎖。\n復原：Worker 中斷後可重新取得過期的工作租約。\n重播：從最後事件識別碼繼續持久化事件序列。\n原子性：就緒狀態、成品雜湊、事件與工作完成共用同一交易。\n隔離：每次讀取與指令都限定在已驗證租戶。`;
export default function ApiReference() {
  return (
    <main>
      <header className="nav">
        <a className="brand" href="/">
          媒體運行實驗室
        </a>
        <nav>
          <a href="/">返回作品</a>
        </nav>
      </header>
      <section className="docs">
        <p className="eyebrow">靜態介面規格參考</p>
        <h1>算圖任務介面</h1>
        <p className="lede">
          同一份合約規範 NestJS 介面、Next.js 用戶端、PostgreSQL 工作流、Bruno 集合與回歸測試。
        </p>
        <div className="endpoint-list">
          {endpoints.map((endpoint) => (
            <article key={endpoint.path}>
              <code>{endpoint.method}</code>
              <div>
                <h2>{endpoint.path}</h2>
                <p>{endpoint.purpose}</p>
                <small>{endpoint.contract}</small>
              </div>
            </article>
          ))}
        </div>
        <section className="contract">
          <h2>運行保證</h2>
          <pre>{guarantees}</pre>
        </section>
      </section>
    </main>
  );
}
