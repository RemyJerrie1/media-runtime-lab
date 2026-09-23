const endpointGroups = [
  {
    name: '倉鼠場景逐幀輸出（Scene Render）',
    description:
      '獨立於影片轉檔的持久化任務。POST 接受 version=1、kind=hamster-scene、scene（v3／v4）及 UUID idempotencyKey；鎖定快照。固定 640×360、24 fps、120 幀、5 秒 MP4；v4 可選 audio（asset、trimStart、start、volume、muted）。需 PostgreSQL、Playwright Chromium 與 FFmpeg。',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/scene-audio',
        purpose: '上傳單音軌素材',
        contract:
          'multipart file；MP3／WAV，10 MB／60 秒上限；驗證實際格式並轉為 48 kHz stereo PCM。回傳 id、checksum、durationSeconds、sizeBytes、url；不可變素材保存於 API 本機磁碟。',
      },
      {
        method: 'GET',
        path: '/v1/scene-audio/:id',
        purpose: '取得音檔契約與存在狀態',
        contract: '租戶驗證；不存在回 404。JSON 只含素材引用，不含音檔 bytes；遺失請重新上傳。',
      },
      {
        method: 'GET',
        path: '/scene-audio/:file',
        purpose: '音訊預覽',
        contract:
          'UUID.wav；支援 Range。音檔先裁切 trimStart，再於 start 秒播放；volume 0–1，muted 或無音軌輸出無聲。尾端補靜音、截斷至 5 秒；有聲 MP4 為 AAC stereo 48 kHz。',
      },
      {
        method: 'POST',
        path: '/v1/scene-render-jobs',
        purpose: '建立或找回相同操作',
        contract:
          '同 key 同內容回原任務；不同內容回 409 IDEMPOTENCY_CONFLICT。每租戶最多 3 筆未完成任務。',
      },
      {
        method: 'GET',
        path: '/v1/scene-render-jobs/:id',
        purpose: '重新讀取任務、實際幀數與不可變 receipt',
        contract:
          'sceneFingerprint、rendererVersion、status、sequence、attempt、completedFrames、error、receipt；前端每 500ms 輪詢，斷線後可恢復。',
      },
      {
        method: 'POST',
        path: '/v1/scene-render-jobs/:id/retry',
        purpose: '重試失敗任務並保留快照',
        contract: '{ expectedAttempt }；冪等重送不重啟已進行或已完成的 attempt。',
      },
      {
        method: 'POST',
        path: '/v1/scene-render-jobs/:id/cancel',
        purpose: '取消尚未完成的任務',
        contract: '撤銷租約；舊 worker 無法提交 receipt。',
      },
      {
        method: 'GET',
        path: '/scene-artifacts/:file',
        purpose: '播放或下載已編碼的 MP4',
        contract:
          '使用 receipt.artifactUrl 原值，支援 Range；?download=1 下載。receipt 含 fps、frameCount、durationSeconds、width、height、audioStreams、sizeBytes、checksum。',
      },
    ],
  },
  {
    name: '媒體資產（Media Assets）',
    description: '建立與讀取轉檔流程使用的來源媒體。',
    endpoints: [
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
    ],
  },
  {
    name: '算圖任務（Render Jobs）',
    description: '建立任務、查詢權威狀態並接續進度事件。',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/render-jobs',
        purpose: '建立具租戶範圍與冪等性的原子指令',
        contract:
          '同租戶、同 key、同內容 → 原任務；不同內容或無法比對的舊請求 → 409 IDEMPOTENCY_CONFLICT（code、message、traceId）',
      },
      {
        method: 'GET',
        path: '/v1/render-jobs/:id',
        purpose: '讀取持久化的權威狀態',
        contract: '任務識別碼 → 算圖任務',
      },
      {
        method: 'SSE',
        path: '/v1/render-jobs/:id/events',
        purpose: '重播持久化序列並串流傳送後續進度',
        contract: 'Last-Event-ID 或 after 游標 → 算圖進度事件',
      },
    ],
  },
  {
    name: '維運與可觀測性（Operations & Observability）',
    description: '取得服務目標、任務統計與最新追蹤證據。',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/operations',
        purpose: '讀取服務運行指標、SLO 與追蹤證據',
        contract: '租戶憑證 → 維運快照',
      },
    ],
  },
  {
    name: '串流與成品交付（Streaming & Delivery）',
    description:
      '以位元組範圍或 HLS/CMAF 交付處理結果。請使用任務回應中的交付 URL，成品 ID 與任務 ID 不同。',
    endpoints: [
      {
        method: 'GET',
        path: '/artifacts/:artifactId.mp4',
        purpose: '以 HTTP Range Request 串流 FFmpeg 成品',
        contract: '位元組範圍 → MP4 Partial Content',
      },
      {
        method: 'GET',
        path: '/streams/:artifactId/:filename',
        purpose: '交付 HLS Master、Media Playlist、初始化片段與 CMAF Segments',
        contract: 'Manifest 或媒體分段 → 自適應串流內容',
      },
      {
        method: 'GET',
        path: '/streams/:artifactId/master.m3u8',
        purpose: '取得自適應串流的 HLS 主播放清單',
        contract: 'manifestUrl → Master Playlist 與各畫質串流',
      },
    ],
  },
] as const;

const guarantees = [
  {
    title: '處理品質',
    description: '驗證來源影片，產生四種畫質，並以 VMAF 記錄實際品質。',
    detail: '360p／540p／720p／1080p · H.264 + AAC',
  },
  {
    title: '串流交付',
    description: '同時提供 MP4 範圍請求與 HLS/CMAF 自適應串流。',
    detail: 'Master Playlist · Media Playlist · CMAF Segments',
  },
  {
    title: '任務可靠性',
    description: '冪等指令避免重複執行；中斷後可接續事件並重新取得工作。',
    detail: 'Idempotency Key · Last-Event-ID · Worker Lease',
  },
  {
    title: '追蹤與隔離',
    description: '每次操作限定在租戶範圍，並串起任務、事件與成品證據。',
    detail: 'Trace ID · Request ID · SHA-256',
  },
] as const;

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
        <p className="eyebrow">API 文件</p>
        <h1>媒體處理 API</h1>
        <p className="lede" data-tour="api-overview">
          完整涵蓋媒體資產、算圖任務、事件串流、成品交付與維運查詢；Bruno collection
          可直接執行相同合約。
        </p>
        <div className="endpoint-groups">
          {endpointGroups.map((group, groupIndex) => {
            const offset = endpointGroups
              .slice(0, groupIndex)
              .reduce((total, item) => total + item.endpoints.length, 0);
            return (
              <section className="endpoint-group" key={group.name}>
                <header>
                  <h2>{group.name}</h2>
                  <p>{group.description}</p>
                </header>
                <div className="endpoint-list">
                  {group.endpoints.map((endpoint, index) => (
                    <article key={endpoint.path}>
                      <code>{endpoint.method}</code>
                      <div>
                        <h3 data-tour={`api-endpoint-${offset + index + 1}`}>{endpoint.path}</h3>
                        <p>{endpoint.purpose}</p>
                        <small>{endpoint.contract}</small>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <section className="contract">
          <div data-tour="api-guarantees">
            <p className="eyebrow">處理流程</p>
            <h2>從接收任務到成品就緒</h2>
          </div>
          <ol className="contract-flow" aria-label="算圖任務處理流程">
            {['已接受', '合成', 'ABR 編碼', '品質驗證', 'CMAF 封裝', '已就緒'].map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
          <div className="guarantee-grid">
            {guarantees.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
