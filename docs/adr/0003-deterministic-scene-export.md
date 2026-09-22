# 0003 — Deterministic hamster scene export

Status: accepted for [round 4 / issue #6](https://github.com/RemyJerrie1/media-runtime-lab/issues/6).

## Context

The existing media pipeline takes an uploaded file. A hamster document instead describes procedural geometry, animation and Chinese captions. Reusing the file-transcode command would hide an incompatible input contract. Real-time screen recording would make frame count and timing depend on machine speed.

## Decision

- Use a separate version-1 `hamster-scene` command and `/v1/scene-render-jobs` resource, accepting an explicit v3 document snapshot and UUID idempotency key. Existing v1/v2 document migration remains in the editor. The server never reads the current browser editor after submission.
- Move the actual evaluator, Three.js renderer and caption rasterizer into `@media-lab/scene-renderer`. Frontend wrappers retain import compatibility; subpath exports keep Three.js lazy. Build a local browser bundle with esbuild, using identical font bytes guarded by governance. Both checked-in font paths contain the same Git blob and OFL license.
- The backend domain port takes a scene job and returns a validated receipt. Its adapter starts an isolated headless Chromium page with only fulfilled local bundle/font requests; every other request is blocked. It uses a fixed 640×360 framebuffer, one PNG at a time through FFmpeg stdin with write completion as backpressure. The frame loop evaluates exactly `index / 24` for indexes 0 through 119. No recorder, requestAnimationFrame, external page or user-supplied asset URL is used.
- A dedicated PostgreSQL table holds the immutable command identity and the current job/receipt snapshot. A tenant/key uniqueness constraint and canonical parsed-scene fingerprint implement deduplication and 409 conflicts. A serialized database claim permits one live leased scene job at a time across workers; a process runs only one scene tick at a time. Each tenant may queue at most three unfinished scene jobs, including retries.
- Workers renew a ten-second lease every second. Every update checks owner, attempt and unexpired lease. Cancel invalidates ownership; a subsequent progress update or renewal aborts the old work. A process crash is reclaimable from frame zero. Three crash attempts per explicit operation are allowed; a crash on the last attempt still becomes failed. Explicit retry keeps the scene, key and job ID and increases the attempt monotonically. It supplies the observed attempt so duplicate retries cannot restart a running attempt.
- Query authoritative snapshots every 500 ms rather than add a second SSE protocol for this five-second MVP. Each snapshot has a monotonic sequence. Browser requests use generation/abort guards and sequence checks. The original command/key is saved before POST and reused after ambiguous responses or reload.
- Generate unique attempt output names, then validate ffprobe dimensions, fps, decoded frame count, audio absence, duration and full FFmpeg decode. Only a fenced store update publishes the immutable receipt. A stale candidate can only delete its own generated artifact. If the database commit acknowledgement is ambiguous, reread the job; preserve the file when receipt ownership cannot be determined.
- The adapter has a 120-second deadline and a 20-second Chromium launch limit. Cancellation/deadline kills child processes, closes the browser, and removes the attempt directory. No frame files accumulate: only a temporary MP4 exists. Abrupt OS/process termination can leave an unreferenced temporary directory or file; these are local operational leftovers, never advertised as ready, and are not blindly deleted when publication is uncertain.

## Alternatives and consequences

Reusing the media-render schema was rejected because it would invent a source asset. Recording live playback was rejected because it cannot guarantee 120 evaluated frames. Reimplementing captions in FFmpeg drawtext was rejected because wrapping/font layout could diverge. A new durable broker was unnecessary for this local portfolio workload; the PostgreSQL slot preserves the existing lease/fencing semantics with a separate scene state machine.

The local setup needs PostgreSQL, FFmpeg/ffprobe and `pnpm exec playwright install chromium`. CI installs Chromium before application tests, since tests execute the real adapter. Normal shutdown aborts in-flight work. A worker restart recovers expired leases; artifacts are immutable and must remain available on the same local disk. This is a local silent MVP, not a distributed artifact service or public deployment. WebGL pixels are compared with tolerance in a fixed environment, not promised bit-identical across GPUs/OSes. Audio remains issue #7.
