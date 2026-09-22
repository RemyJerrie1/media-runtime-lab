# Portfolio reliability and encoding evidence

## Interactive recovery (`/composition`)

Create a real render, then choose **中斷進度連線** while it is running. This closes this page's EventSource; it does not kill the worker or pretend the server failed. **恢復進度連線** fetches the authoritative job and resumes from its accepted sequence. The evidence panel shows both job IDs and sequence values.

Enable **故障注入：下次送出後刻意丟棄成功回應** before creating a job to demonstrate ambiguous submission. The backend really accepts the command; the hook intentionally withholds that success from its normal state update. The panel keeps the observed identity as demonstration evidence. **重試原操作** resends the persisted original request/key. **重送原操作（驗證去重）** repeats a successfully acknowledged command from this page and compares identities. Editing controls does not change a retry's payload. Evidence is scoped to the current page session; pending commands still survive reload, but the before/after demonstration panel does not.

These controls are explicitly labeled fault injection. They do not claim an actual server outage. Terminal jobs no longer have a progress stream to interrupt, so interruption is disabled after completion.

## Measured encoding comparison

The same page includes three playable outputs from `docs/media/product-demo.mp4`: libx264 ultrafast/CRF 23, slow/CRF 23 and slow/CRF 30. All use the same first three seconds, 640x360, 30fps, no audio and two encoder threads.

`pnpm benchmark` performs one warm-up and three sequential rounds with rotating profile order. It writes real MP4 files and `apps/web/public/benchmarks/report.json`. Elapsed wall time includes process startup and output write, but excludes ffprobe/decode verification. The page displays each sample, its median, final output size, CPU/OS/Node/FFmpeg version and measurement timestamp. The final encode is retained for playback. These are saved local measurements, not live timing, cross-machine rankings or objective quality scores.

`pnpm benchmark:verify` validates the report schema, source and output hashes, file sizes, medians and real FFmpeg decoding. CI runs this check without replacing the saved measurements. To refresh the comparison, run `pnpm benchmark` and commit the report and all three outputs together.

## Idempotency conflict contract

After shared-schema parsing, a versioned SHA-256 fingerprint covers every render-intent field, including narration, encoding and processing. Field order is canonicalized by the schema; the idempotency key and tracing context do not contribute. The same tenant/key/intent replays the original job. Different intent returns HTTP 409 with `{ code: "IDEMPOTENCY_CONFLICT", message, traceId }` and does not create another event, job or outbox item. In-memory and PostgreSQL stores enforce the same rule. PostgreSQL checks run within the existing tenant transaction lock and survive process restart.

The additive startup migration adds nullable `request_fingerprint`. Existing rows remain readable and runnable. Their full original narration was never stored, so a replay of a legacy row with no fingerprint returns 409 rather than guessing equality or overwriting the row. The UI explains this and requires explicit abandonment before creating a new operation.

Bruno generates a fresh key per collection run, then uses it for both equivalent replay and changed-narration conflict checks. Browser tests cover the real UI fault controls, real API deduplication/conflict responses, and playback of the three measured artifacts on a narrow viewport. Screenshots and receipts are retained with the CI browser evidence artifact.

Verification on 2026-09-22: pnpm verify passed with 87 application tests (including 6 real PostgreSQL integration tests), 10 boundary tests, typecheck and production build. All 14 Playwright cases passed against PostgreSQL. pnpm benchmark:verify passed for all three videos and poster hashes. Desktop and mobile screenshots were reviewed; the temporary services were stopped.
