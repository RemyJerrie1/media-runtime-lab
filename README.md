# Media Runtime Lab

An executable reference implementation for reliable media job orchestration.

- **Render Workflow** — Create → Process → Deliver
- **Runtime Guarantees** — Idempotency · SSE Recovery · State Machine
- **Operational Evidence** — Artifact · Token Usage · Cost Attribution

## Product Flow

[![Render job lifecycle](./docs/media/product-demo.gif)](./docs/media/product-demo.mp4)

- Command → Job → Progress → Artifact
- One identity across API, SSE, and delivery
- AI is replaceable; deterministic media stays available

## Render Lifecycle

[![Render lifecycle close-up](./docs/media/render-lifecycle.gif)](./docs/media/render-lifecycle.mp4)

- `accepted → composing → encoding → packaging → ready`
- Retry-safe · Recoverable · Observable

## API Contract

[![API contract walkthrough](./docs/media/api-contract.gif)](./docs/media/api-contract.mp4)

- `POST /v1/render-jobs`
- `GET /v1/render-jobs/:id`
- `SSE /v1/render-jobs/:id/events`

## Bruno Regression

[![Bruno contract verification](./docs/media/bruno-contract-tests.gif)](./docs/media/bruno-contract-tests.mp4)

- 4 requests · 5 assertions
- Idempotency · Boundary rejection · State recovery

## Governance

- **Fitness Functions** — dependency boundaries + contract drift
- **AI Guardrails** — skills + hooks + change policy
- **Regression** — domain tests + HTTP contract tests
- **Decision Record** — [ADR 0001](./docs/adr/0001-modular-control-plane.md)

<details>
<summary><strong>Run locally</strong></summary>

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
