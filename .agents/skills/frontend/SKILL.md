---
name: frontend
description: Build or review the Next.js and TypeScript experience layer for media workflows, including state ownership, SSE recovery, accessibility, and visual regression.
---

# Frontend engineering

1. Start from the API contract and user state model, not from component markup.
2. Separate server state, workflow state, and local presentation state.
3. Keep network access in the feature data boundary; components consume typed commands and queries.
4. Treat SSE as invalidation and progress transport. Re-fetch the authoritative resource after reconnect.
5. Model loading, empty, partial, ready, failed, retrying, and disconnected states explicitly.
6. Preserve keyboard access, readable type scale, focus visibility, and reduced-motion behavior.
7. Verify responsive layout and the complete command → progress → artifact path in a browser.

## Review checks

- Next.js route and client boundaries are intentional.
- TypeScript does not duplicate backend schemas by hand.
- Effects are idempotent and cleaned up.
- Media previews do not block the main thread unnecessarily.
- UI copy communicates state and recovery, not implementation noise.
