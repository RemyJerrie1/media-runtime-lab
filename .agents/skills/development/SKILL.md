---
name: development
description: Deliver a governed end-to-end change in Media Runtime Lab with explicit contracts, dependency boundaries, regression evidence, and a reviewable commit.
---

# Governed development

1. Define the user-visible outcome and the owning feature before editing code.
2. Trace the path from contract → domain invariant → application use case → adapter → UI.
3. Keep the smallest coherent change surface; do not mix unrelated refactors.
4. Update executable contracts, documentation, fixtures, and tests together.
5. Preserve deterministic media behavior when an AI provider is unavailable, late, invalid, or too expensive.
6. Run targeted tests during implementation, then `pnpm verify` before handoff.
7. Report changed behavior, architectural impact, verification evidence, and remaining risk.

## Completion gate

- No reverse dependency across domain boundaries.
- No hidden network call in presentation components.
- No contract drift between schema, API, Bruno, and tests.
- No claim of completion without executable evidence.
