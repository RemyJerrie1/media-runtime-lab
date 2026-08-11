# Engineering Contract

## Change policy

1. Preserve the dependency direction: `interfaces → application → domain`; infrastructure implements domain ports and never owns business policy.
2. Change `packages/contracts` before changing an API payload. Update Bruno examples and contract tests in the same change.
3. Never bypass the render state machine. Every transition must be explicit, observable, and idempotent.
4. Keep AI and provider code behind ports. Deterministic Canvas/FFmpeg composition remains available when provider output is late, invalid, or expensive.
5. A change is complete only after `pnpm verify`; snapshots may change only with an explicit reason in the commit.

## Review order

Read contract → domain invariant → application use case → adapter → UI.

Reject cross-feature imports and hidden network calls in React components.
