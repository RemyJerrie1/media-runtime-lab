# Media Runtime Lab

一個小而完整的全端影音運算控制台：以可重現的媒體處理管線補足生成式 AI 的不確定性，並把任務狀態、成品資產與用量成本納入同一套治理模型。

## 可驗證的工程主張

- Next.js 操作面：建立算圖任務、接收 SSE 進度、檢視成品與成本歸戶。
- NestJS 控制面：idempotency、狀態機、事件串流與一致的錯誤契約。
- 契約優先：OpenAPI 靜態參考頁與 Bruno collection 共用同一份 schema 語意。
- AI 協作治理：依賴邊界、契約漂移、單元／回歸測試與變更技能，把 AI 產碼限制在可審查的工程護欄內。

```bash
pnpm install
pnpm dev
pnpm verify
pnpm bruno
```

Web: `http://localhost:3000` · API: `http://localhost:4000` · API Reference: `http://localhost:3000/api-reference`
