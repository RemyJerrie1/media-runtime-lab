---
name: test-e2e
description: Verify Media Runtime Lab across browser, HTTP, state transition, artifact, and governance boundaries with reproducible evidence.
---

# End-to-end verification

1. Start the API and web application from a clean build.
2. Verify health checks before exercising product flows.
3. Run the Bruno collection and preserve request, assertion, and failure evidence.
4. In the browser, create a render job and observe accepted → processing → ready.
5. Confirm SSE reconnect recovers through an authoritative GET rather than client-only state.
6. Repeat the command with the same idempotency key and confirm the original job identity is returned.
7. Exercise invalid payload, missing job, illegal transition, and provider failure paths.
8. Confirm the artifact receipt contains checksum, token usage, and cost attribution.
9. Run `pnpm verify` and report exact pass/fail counts.

## Evidence contract

- Screenshot or animation of the product path.
- Bruno summary for HTTP behavior.
- Test output for domain invariants.
- Governance output for dependency and contract gates.
