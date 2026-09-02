# Media Runtime Lab

[![verify](https://github.com/RemyJerrie1/media-runtime-lab/actions/workflows/verify.yml/badge.svg?branch=dev)](https://github.com/RemyJerrie1/media-runtime-lab/actions/workflows/verify.yml)

> 可復原的影音處理工作流後台 — Recoverable media processing workflow backend.

可復原是三件具體的事：

- 同一個指令送幾次，都只有一個工作
- worker 掛掉後，另一個 worker 可以接手
- 連線中斷後，可以從斷點接回事件

這三條都有測試，並在 CI 使用真正的 PostgreSQL 驗證。

## 操作畫面

上傳來源影片，調整剪輯、CRF、碼率、FPS、GOP、字幕與水印參數，再查看真實任務進度、處理收據與成品預覽。

<a href="./docs/media/product-demo.mp4"><img src="./docs/media/product-demo.gif" width="760" alt="影音處理工作台操作示範" /></a>

## 任務生命週期

時間軸以 30 fps 計算影格位置，字幕提示跟著媒體時鐘切換。

<a href="./docs/media/render-lifecycle.mp4"><img src="./docs/media/render-lifecycle.gif" width="680" alt="媒體任務與時間軸示範" /></a>

## 字幕與合成

包含中文字幕、Sprite Sheet、Canvas 2D 合成，以及 CSS 3D 圖層示範。

<a href="./docs/media/composition-showcase.mp4"><img src="./docs/media/composition-showcase.gif" width="760" alt="字幕與媒體合成示範" /></a>

## 任務復原

後端保存 job、event 與 work lease。重複指令會回到同一個 job；lease 過期後可由其他 worker 接手；SSE 依 `Last-Event-ID` 重播事件。

<a href="./docs/media/reliability-recovery.mp4"><img src="./docs/media/reliability-recovery.gif" width="760" alt="冪等、worker 接手與事件重播示範" /></a>

完成時，成品紀錄、`ready` 狀態、事件與工作完成會在同一筆交易寫入。

## FFmpeg 處理計畫

<a href="./docs/media/api-contract.mp4"><img src="./docs/media/api-contract.gif" width="760" alt="API 與 FFmpeg 處理計畫示範" /></a>

- `POST /v1/media`：上傳來源影片並取得媒體資產識別碼
- `POST /v1/render-jobs`：以媒體資產建立或重播同一個指令
- `GET /v1/render-jobs/:id`：讀取目前狀態
- `SSE /v1/render-jobs/:id/events`：接收與重播進度事件
- `GET /artifacts/:jobId.mp4`：用 HTTP Range Request 傳送轉檔成品

Worker 會以 `ffprobe` 檢測來源、實際執行 FFmpeg、再次檢測輸出，並計算成品 SHA-256。Web 端使用真實 `<video>` 播放產生的 MP4。HLS/DASH、ABR、DRM 與直播仍不在目前範圍內。

## API 回歸測試

Bruno 測試涵蓋建立工作、重複指令、錯誤輸入、狀態查詢與復原流程。

<a href="./docs/media/bruno-contract-tests.mp4"><img src="./docs/media/bruno-contract-tests.gif" width="760" alt="Bruno API 回歸測試" /></a>

## 成本歸因示範

用模擬資料呈現供應商用量、專案歸因與預算門檻；沒有呼叫外部模型。

<a href="./docs/media/ai-cost-governance.mp4"><img src="./docs/media/ai-cost-governance.gif" width="760" alt="用量與成本歸因示範" /></a>

## 設計系統

共用色彩、間距、字體與狀態元件，並實際用在工作台頁面。

<a href="./docs/media/design-system-showcase.mp4"><img src="./docs/media/design-system-showcase.gif" width="760" alt="設計系統與元件狀態示範" /></a>

## 程式結構

```text
apps/web/                 Next.js 操作介面
apps/api/src/render/
  domain/                 狀態機、規則與 ports
  application/            工作調度與 worker
  interfaces/             HTTP 與 SSE
  infrastructure/         PostgreSQL 與記憶體 adapter
packages/contracts/       前後端共用 Zod contract
bruno/                    API 回歸測試
```

依賴方向：`interfaces → application → domain ← infrastructure`

- [架構選擇](./docs/adr/0001-modular-control-plane.md)
- [持久化與事件重播](./docs/adr/0002-durable-workflow-and-replay.md)
- [維運與失敗模式](./docs/architecture/operations.md)

## 本機執行

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm verify
pnpm dev
```

`pnpm install` 會透過 `ffmpeg-static` 與 `@ffprobe-installer/ffprobe` 安裝本機執行檔，不需要另外設定系統 PATH。

- Web：`http://localhost:3000`
- API：`http://localhost:4000`
- API 參考頁：`http://localhost:3000/api-reference`
- Bruno：`pnpm bruno`

`pnpm verify` 會檢查格式、架構邊界、合約、型別、測試與正式版本建置。本機沒有設定 `DATABASE_URL` 時，PostgreSQL 整合測試會跳過；CI 會使用真正的 PostgreSQL 執行。
