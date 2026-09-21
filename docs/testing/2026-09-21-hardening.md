# 2026-09-21 核心可靠性補強與測試結果

## 結果

`pnpm verify` 成功（exit code 0）：54 項測試通過，0 失敗、0 略過。

| 範圍 | 通過 |
| --- | ---: |
| API（含真實 PostgreSQL 與 FFmpeg 整合測試） | 24 |
| Web | 27 |
| 共用契約 | 3 |

格式、架構邊界、API／Bruno 契約、25 組色彩對比、TypeScript 與正式建置全部通過。Next.js 完成 13 個靜態頁面的產生。完整本機紀錄位於 `.runtime/verify-final.log`（不納入 Git）。

## 已補強

- MP4／HLS 共用處理計畫，保留浮水印、剪輯、幀率與音訊同步；關閉 ABR 時只產生一種畫質。
- 五秒工作租約每秒續租；租約失效取消 FFmpeg，資料庫寫入同時檢查 Worker、執行次數與租約期限。
- 每次處理採用獨立成品路徑，避免過期 Worker 覆寫成功成品；前端畫質預覽與 Bruno 改用回應交付路徑。
- 最多執行十次轉檔，重試延遲由一秒倍增至六十秒；失敗耗盡或最後一次執行崩潰後，都會產生明確的 failed 終止事件。
- 驗證資訊改存成品 ffprobe 資料，完成 MP4 與各 HLS 媒體播放清單的實際解碼後才標示 playbackVerified。
- 應用層透過 MediaProcessor 介面呼叫處理器；Worker 輪詢錯誤不再成為未處理的 Promise rejection。
- Turbo 傳遞 DATABASE_URL／FFmpeg 路徑並停用測試快取，避免資料庫測試被略過或重用舊結果。

## 實際驗證情境

- 100 個並行請求只建立一個任務；儲存介面重新建立後仍能讀取任務與事件。
- 長任務跨越租約時間仍保持單一擁有者；過期租約與重複 Worker ID 的舊執行次數均不能寫入。
- 十次轉檔失敗後結束；第十次執行崩潰後重新領取只做終止處理。
- 產生前三秒測試素材，剪去第一秒白色畫面；實際解碼確認成品只剩黑色背景與浮水印亮像素。
- 單一畫質與四種 ABR 畫質皆檢查 24fps、48kHz 音訊、一秒成品長度，以及可讀取的相對 HLS 初始化片段路徑。
- 中止執行中的媒體處理時，不回傳成功收據。
- 前端切换畫質採用已提交成品的識別碼；舊任務與無指定畫質時仍可退回主 MP4。

## 執行環境與重跑

本次使用 Windows、Node.js 22、既有 lockfile 依賴，以及專案 `.runtime` 內的臨時 PostgreSQL 18.4，監聽 `127.0.0.1:55439`。測試各自建立隨機 schema 並清除，不使用既有業務資料。測試後已停止臨時資料庫；未安裝系統服務。GitHub Actions 的 PostgreSQL 16 執行結果需由遠端 CI 另行確認。

一般重跑需先提供可用的測試 DATABASE_URL：

```powershell
$env:DATABASE_URL = '<測試 PostgreSQL 連線字串>'
pnpm verify
```

本機提供的 pnpm 啟動器會自動檢查／安裝依賴；確認 `pnpm install --frozen-lockfile` 成功後，本次執行另設定 `$env:pnpm_config_verify_deps_before_run='false'`，避免執行腳本時再次更動依賴。未設定 DATABASE_URL 時，資料庫整合測試仍會略過，不能視為完整驗證。

## 尚未涵蓋

此次未執行瀏覽器互動 E2E 或 Bruno HTTP 全流程。playbackVerified 代表解碼成功，並非所有瀏覽器的相容性認證；浮水印模式記錄成功執行的設定，GOP 間隔仍為設定推算值。租戶素材授權、全域維運統計隔離、前端提交冪等性，以及失敗成品的定期清理，留待下一階段補強。
