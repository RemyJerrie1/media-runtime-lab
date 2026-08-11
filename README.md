# Media Runtime Lab

小而完整的 **Media SaaS Full-Stack Reference Implementation**：以同一個 Render Job Identity 串起 API、SSE Progress、Deterministic Composition、Artifact Delivery、Token Usage 與 Cost Attribution。

## 🎬 Executable Media Flow

<a href="./docs/media/product-demo.mp4"><img src="./docs/media/product-demo.gif" width="760" alt="Media render workflow" /></a>

- **Control Plane** — NestJS · Idempotency · State Machine
- **Execution** — Canvas Timeline · FFmpeg-ready Port · Deterministic Fallback
- **Evidence** — Artifact · Token Usage · Cost Ledger

## 🎞️ Composition Timeline

<a href="./docs/media/render-lifecycle.mp4"><img src="./docs/media/render-lifecycle.gif" width="680" alt="Deterministic composition timeline" /></a>

- Scene Clips · CJK Subtitle Cues · Audio Envelope
- 18s Timeline · 30fps Frame Identity · Render Playhead

## ✨ Subtitle · Sprite · 2D／3D Composition

<a href="./docs/media/composition-showcase.mp4"><img src="./docs/media/composition-showcase.gif" width="760" alt="Subtitle sprite and 2D 3D media composition" /></a>

- **CJK Subtitle** — Cue 切換與 Media Clock 對齊
- **Sprite Sheet** — Frame Index 與播放進度可追蹤
- **Canvas 2D** — Deterministic Composition Fallback
- **CSS 3D** — 立體 Layer；保留 WebGL／Three.js Adapter 邊界

## 🔌 API Contract

<a href="./docs/media/api-contract.mp4"><img src="./docs/media/api-contract.gif" width="760" alt="API contract walkthrough" /></a>

- `POST /v1/render-jobs` — Idempotent Command
- `GET /v1/render-jobs/:id` — Authoritative State
- `SSE /v1/render-jobs/:id/events` — Progress & Recovery

## 🧪 Bruno Regression

<a href="./docs/media/bruno-contract-tests.mp4"><img src="./docs/media/bruno-contract-tests.gif" width="760" alt="Bruno contract verification" /></a>

- 4 Requests · 5 Assertions
- Idempotency · Boundary Rejection · State Recovery

## 🧱 Architecture & Ownership

```text
apps/
├─ web/app/
│  ├─ design-system/             # Design Tokens · UI Primitives
│  ├─ config/                    # Environment · Media Runtime Constants
│  ├─ shared/
│  │  ├─ api/                    # Typed API Adapters
│  │  ├─ constants/              # Navigation · Shared Policies
│  │  ├─ hooks/                  # SSE Lifecycle · Recovery
│  │  └─ ui/                     # Shared Presentation
│  └─ features/
│     ├─ render-lab/             # Job Lifecycle · Media Timeline
│     └─ composition-showcase/   # CJK Cue · Sprite · Canvas 2D · CSS 3D
└─ api/src/render/
   ├─ domain/                    # State Machine · Invariants · Ports
   ├─ application/               # Use Cases · Job Orchestration
   ├─ interfaces/                # HTTP · SSE · Contract Validation
   └─ infrastructure/            # Repository · Worker Adapters

packages/contracts/              # Shared Zod Contract · No DTO Drift
bruno/                           # Executable HTTP Regression
.agents/skills/                  # Development · Frontend · Backend · E2E
.codex/                          # Hooks · Governance Gate · Project Config
.husky/pre-commit                # Governance · Typecheck · Tests
scripts/                         # Architecture Fitness Functions
```

- **Frontend Three Layers** — Route (RSC) → Feature (Client Island) → Shared／Design System
- **Backend Boundary** — Interface → Application → Domain ← Infrastructure
- **Design System** — Tokens 與 Primitive Components 集中管理視覺與互動規則
- **State Ownership** — Server State 由 `useRenderJob` 管理；Canvas Timeline 保持純展示責任
- **App Router** — `layout/page/loading/error/not-found` 採官方 File Conventions；互動範圍才建立 Client Boundary

## 🛡️ Codex Engineering Governance

- **Project Config** — [`.codex/config.toml`](./.codex/config.toml) · [Lifecycle Hooks](./.codex/hooks.json)
- **Codex Hooks** — [PreTool Policy](./.codex/hooks/pre-tool-governance.mjs) · [Stop Gate](./.codex/hooks/governance-gate.mjs)
- **Codex Skills** — [Development](./.agents/skills/development/SKILL.md) · [Frontend](./.agents/skills/frontend/SKILL.md) · [Backend](./.agents/skills/backend/SKILL.md) · [E2E](./.agents/skills/test-e2e/SKILL.md)
- **Architecture Decision** — [ADR 0001](./docs/adr/0001-modular-control-plane.md)

## ✅ Verification

- Contract Tests · Domain Tests · Application Tests
- Timeline Mapping · Subtitle Cue · Sprite Frame · Playhead Boundary · Frame Identity
- Bruno HTTP Regression · Typecheck · Production Build
- Husky Pre-commit · Architecture Fitness Functions

<details>
<summary><strong>Local Verification</strong></summary>

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
