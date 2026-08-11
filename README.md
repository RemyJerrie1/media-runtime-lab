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
│  ├─ shared/
│  │  ├─ api/                    # Typed API Adapters
│  │  └─ hooks/                  # SSE Lifecycle · Recovery
│  └─ features/render-lab/       # Feature Composition · Media Timeline
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

- **Frontend Boundary** — Page → Feature → Shared Hook/API → Contract
- **Backend Boundary** — Interface → Application → Domain ← Infrastructure
- **Design System** — Tokens 與 Primitive Components 集中管理視覺與互動規則
- **State Ownership** — Server State 由 `useRenderJob` 管理；Canvas Timeline 保持純展示責任

## 🛡️ Codex Engineering Governance

- **Project Config** — [`.codex/config.toml`](./.codex/config.toml) · [Lifecycle Hooks](./.codex/hooks.json)
- **Codex Hooks** — [PreTool Policy](./.codex/hooks/pre-tool-governance.mjs) · [Stop Gate](./.codex/hooks/governance-gate.mjs)
- **Codex Skills** — [Development](./.agents/skills/development/SKILL.md) · [Frontend](./.agents/skills/frontend/SKILL.md) · [Backend](./.agents/skills/backend/SKILL.md) · [E2E](./.agents/skills/test-e2e/SKILL.md)
- **Architecture Decision** — [ADR 0001](./docs/adr/0001-modular-control-plane.md)

## ✅ Verification

- Contract Tests · Domain Tests · Application Tests
- Timeline Mapping · Playhead Boundary · Frame Identity
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
