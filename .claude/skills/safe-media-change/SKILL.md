---
name: safe-media-change
description: Apply a media pipeline change without breaking contracts, state transitions, cost attribution, or deterministic fallback.
---

# Safe media change

1. Identify the user-visible media outcome and its owning feature.
2. Read `packages/contracts` and the domain aggregate before editing an adapter or UI.
3. When the payload changes, update schema, controller, API reference, Bruno fixture, and contract test together.
4. When a status changes, prove every legal and illegal transition with tests.
5. Keep AI providers behind a port; preserve a deterministic Canvas/FFmpeg path and record provider, prompt version, tokens, latency, and cost.
6. Run `pnpm governance`, targeted unit tests, Bruno, then end-to-end verification. Do not approve snapshot churn without a named behavior change.
