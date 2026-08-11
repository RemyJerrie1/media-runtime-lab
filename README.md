# Media Runtime Lab

A full-stack media workflow built with **Next.js, TypeScript, and NestJS**. It covers render-job creation, live progress, subtitle and motion composition, artifact delivery, AI token attribution, and cost governance.

## 🎬 Media Job Workflow

<a href="./docs/media/product-demo.mp4"><img src="./docs/media/product-demo.gif" width="760" alt="Media render workflow" /></a>

- **Frontend** — Next.js App Router · SSE Progress · Canvas Timeline
- **Backend** — NestJS · Idempotency · State Machine · Artifact Registry
- **Media** — CJK Subtitle · Sprite Sheet · 2D/3D Composition · FFmpeg-ready Adapter
- **Operations** — Retry & Recovery · Token Usage · Cost Attribution

## 🎞️ Composition Timeline

<a href="./docs/media/render-lifecycle.mp4"><img src="./docs/media/render-lifecycle.gif" width="680" alt="Deterministic composition timeline" /></a>

- Scene Clips · CJK Subtitle Cues · Audio Envelope
- 18-second Timeline · 30 fps Frame Identity · Render Playhead

## ✨ Subtitle · Sprite · 2D/3D Composition

<a href="./docs/media/composition-showcase.mp4"><img src="./docs/media/composition-showcase.gif" width="760" alt="Subtitle sprite and 2D 3D media composition" /></a>

- **CJK Subtitle** — Cue changes aligned with the media clock
- **Sprite Sheet** — Traceable frame index and playback progress
- **Canvas 2D** — Deterministic composition fallback
- **CSS 3D** — Layered motion with an explicit WebGL/Three.js adapter boundary

## 💰 AI Token Usage & Cost Governance

<a href="./docs/media/ai-cost-governance.mp4"><img src="./docs/media/ai-cost-governance.gif" width="760" alt="AI token usage attribution and budget governance" /></a>

- **Usage Receipt** — Provider · Model · Prompt/Completion Token
- **Attribution** — Tenant · Workspace · Project · Feature
- **Usage Ledger** — Append-only events as the source of truth for cost and quota
- **Budget Gate** — Alert · Throttle · Model Fallback
- **Execution Note** — Provider receipts are simulated; no external model or API key is used

## 🛡️ Reliability & Recovery

<a href="./docs/media/reliability-recovery.mp4"><img src="./docs/media/reliability-recovery.gif" width="760" alt="Idempotency SSE recovery and artifact delivery" /></a>

- Duplicate commands return the same Job Identity instead of creating duplicate work
- SSE progress can recover through an authoritative `GET` after interruption
- State transitions remain explicit until the artifact reaches `ready`

## 🔌 API Contract

<a href="./docs/media/api-contract.mp4"><img src="./docs/media/api-contract.gif" width="760" alt="API contract walkthrough" /></a>

- `POST /v1/render-jobs` — Idempotent Command
- `GET /v1/render-jobs/:id` — Authoritative State
- `SSE /v1/render-jobs/:id/events` — Progress and Recovery

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
│     ├─ composition-showcase/   # CJK Cue · Sprite · Canvas 2D · CSS 3D
│     └─ cost-governance/        # Usage Receipt · Attribution · Budget Gate
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

- **Frontend Three Layers** — Route (RSC) → Feature (Client Island) → Shared/Design System
- **Backend Boundary** — Interface → Application → Domain ← Infrastructure
- **Design System** — Centralized tokens and primitive interaction rules
- **State Ownership** — `useRenderJob` owns server state; media canvases own transient render state
- **App Router** — `layout`, `page`, `loading`, `error`, and `not-found` follow official file conventions

## ⚙️ Codex Engineering Governance

- **Project Config** — [`.codex/config.toml`](./.codex/config.toml) · [Lifecycle Hooks](./.codex/hooks.json)
- **Codex Hooks** — [PreTool Policy](./.codex/hooks/pre-tool-governance.mjs) · [Stop Gate](./.codex/hooks/governance-gate.mjs)
- **Codex Skills** — [Development](./.agents/skills/development/SKILL.md) · [Frontend](./.agents/skills/frontend/SKILL.md) · [Backend](./.agents/skills/backend/SKILL.md) · [E2E](./.agents/skills/test-e2e/SKILL.md)
- **Architecture Decision** — [ADR 0001](./docs/adr/0001-modular-control-plane.md)

## ✅ Verification

- Contract Tests · Domain Tests · Application Tests
- Timeline Mapping · Subtitle Cue · Sprite Frame · Playhead Boundary · Frame Identity
- AI Usage Aggregation · Cost Attribution · Budget Threshold
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
