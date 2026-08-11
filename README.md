# Media Runtime Lab

> 一個可執行、可驗證、可治理的全端影音任務系統。

- 🎬 **Media Pipeline** — 建立任務 → 非同步處理 → 成品交付
- 🛡️ **Runtime Reliability** — Idempotency · State Machine · SSE Recovery
- 📊 **Operational Evidence** — Artifact · Token Usage · Cost Attribution

## 🎬 影音任務全流程

<a href="./docs/media/product-demo.mp4"><img src="./docs/media/product-demo.gif" width="760" alt="Render job lifecycle" /></a>

- 同一個 `Job Identity` 串起 API、SSE Progress 與 Artifact Delivery
- AI Provider 可替換；Canvas／FFmpeg 保留 Deterministic Fallback

## ⚙️ Render Job Lifecycle

<a href="./docs/media/render-lifecycle.mp4"><img src="./docs/media/render-lifecycle.gif" width="680" alt="Animated render lifecycle" /></a>

- `accepted → composing → encoding → packaging → ready`
- Retry-safe · Recoverable · Observable

## 🔌 API Contract

<a href="./docs/media/api-contract.mp4"><img src="./docs/media/api-contract.gif" width="760" alt="API contract walkthrough" /></a>

- `POST /v1/render-jobs` — 建立具 Idempotency Key 的任務
- `GET /v1/render-jobs/:id` — 讀取 Authoritative State
- `SSE /v1/render-jobs/:id/events` — 接收進度並支援斷線恢復

## ✅ Bruno Regression

<a href="./docs/media/bruno-contract-tests.mp4"><img src="./docs/media/bruno-contract-tests.gif" width="760" alt="Bruno contract verification" /></a>

- 4 Requests · 5 Assertions
- 驗證 Idempotency、Boundary Rejection 與 State Recovery

## 🧭 Codex Engineering Governance

- **Project Config** — [`.codex/config.toml`](./.codex/config.toml) + [Lifecycle Hooks](./.codex/hooks.json)
- **Codex Hooks** — [PreToolUse Policy](./.codex/hooks/pre-tool-governance.mjs) + [Stop Governance Gate](./.codex/hooks/governance-gate.mjs)
- **Codex Skills** — [Development](./.agents/skills/development/SKILL.md) · [Frontend](./.agents/skills/frontend/SKILL.md) · [Backend](./.agents/skills/backend/SKILL.md) · [E2E](./.agents/skills/test-e2e/SKILL.md)
- **Engineering Policy** — [`AGENTS.md`](./AGENTS.md) + [Safe Media Change](./.agents/skills/safe-media-change/SKILL.md)
- **Automated Gates** — Dependency Boundary · Contract Drift · Typecheck · Tests · Production Build
- **Decision Record** — [ADR 0001](./docs/adr/0001-modular-control-plane.md)

## 🗂️ 專案結構與治理邊界

```text
media-runtime-lab/
├── apps/
│   ├── web/                     # Next.js · TypeScript · Canvas · SSE UI
│   │   └── app/features/        # Feature-first frontend modules
│   └── api/                     # NestJS Media Control Plane
│       └── src/render/
│           ├── domain/          # State Machine · Invariants · Ports
│           ├── application/     # Use Cases · Job Orchestration
│           ├── interfaces/      # HTTP · SSE · Contract Validation
│           └── infrastructure/  # Repository · Worker Adapters
├── packages/contracts/          # Shared Zod Contract · No DTO Drift
├── bruno/                       # Executable HTTP Regression
├── .agents/skills/              # Development · Frontend · Backend · E2E
├── .codex/                      # Hooks · Governance Gate · Project Config
├── .husky/pre-commit            # Governance · Typecheck · Tests
└── scripts/                     # Architecture Fitness Functions
```

- **Frontend** 採 Feature-first ownership，網路與狀態邏輯不散落在畫面元件。
- **Backend** 採 Domain → Application → Interface／Infrastructure 的依賴方向。
- **Contract** 由 Zod、NestJS、Next.js、Bruno 與 Regression Tests 共用並交叉驗證。

## 🧪 Test & Quality Gates

- **Domain Tests** — 合法／非法 State Transition
- **Application Tests** — Idempotency · Job Completion · Artifact Receipt
- **Frontend Tests** — Waveform Motion · Playhead Loop Boundary
- **Contract Tests** — Payload Boundary · Token／Cost Receipt
- **HTTP Regression** — Bruno 4 Requests · 5 Assertions
- **Pre-commit** — Husky → Governance → Typecheck → Tests

<details>
<summary><strong>🧪 Local Verification</strong></summary>

```bash
pnpm install
pnpm verify
pnpm dev
```

- Web — `http://localhost:3000`
- API — `http://localhost:4000`
- API Reference — `http://localhost:3000/api-reference`
- Bruno — `pnpm bruno`

</details>
