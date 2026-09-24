# Portfolio quality gates

Scope: [#11](https://github.com/RemyJerrie1/media-runtime-lab/issues/11), following `1ece441`. This remains a local portfolio application, without a public deployment requirement.

## Performance evidence and budget

`node scripts/benchmark-web.mjs --verify` starts the production Next build, measures the render page until its demo-ready state, then performs 100 overview/render round trips. The API response is fixed so this measures browser/UI behavior, not network or media-processing throughput. Five load samples follow one discarded warm-up; interaction samples follow five warm-up cycles. Chromium CDP explicitly collects garbage before both heap measurements.

Same local environment before and after: Windows, Intel Core Ultra 7 270K Plus, Node 22.23.2, Chromium 153.0.8010.12. The before run used the `1ece441` production web build; the after run includes the responsive-grid and metadata-preload changes. Raw samples remain in ignored `.runtime/web-before.json` and `.runtime/web-after.json`.

| Metric | Before | After | Delta | Enforced CI ceiling |
| --- | ---: | ---: | ---: | ---: |
| Render-page ready median | 131 ms | 348 ms | +217 ms | 3,000 ms |
| Workspace-switch median | 87 ms | 64 ms | -23 ms | 1,000 ms |
| Heap before 100 cycles, after GC | 5,695,600 bytes | 5,694,648 bytes | -952 bytes | — |
| Heap after 100 cycles, after GC | 6,152,248 bytes | 6,164,004 bytes | +11,756 bytes | — |
| Retained heap growth | 456,648 bytes | 469,356 bytes | +12,708 bytes | 4,194,304 bytes |

The observed load median increased; passing a budget does not establish no regression. Five samples are a smoke benchmark, not a causal performance study or a cold-network measurement. The ceilings allow slower shared CI CPUs while bounding unresponsive behavior and sustained retained growth. A nonzero retained heap includes legitimate framework caches; this is distinct from the existing exact-zero request/timer cleanup assertions. CI uploads the raw benchmark JSON and fails on a budget breach. It does not compare different machines as if they were identical hardware.

## Abuse, scaling and disk boundaries

- Real browser input supplies 100,000 caption characters, checks rejection and disabled application, discards the draft, clicks save 20 times, and checks bounded saved state and a ready scene. This uses Playwright input filling, not the operating-system clipboard.
- Actual HTTP calls verify unauthenticated rejection, an oversized body, rate limiting of 40 malformed requests, and 20 concurrent submissions of one intent returning one job ID.
- A real PostgreSQL test grows from 10 to 1,000 jobs. At both sizes it checks tenant isolation, active count and idempotent replay; three operations must complete under one second. It finally asserts exactly 1,000 jobs, events and outbox entries. The focused local run measured 1.21 ms / 1.54 ms and process heap 26,416,080 / 31,835,352 bytes. These process-heap samples do not force GC and are not leak measurements.
- Uploaded-media receipts and scene-audio receipts are parsed with Zod, limited to 64 KiB and checked against canonical per-asset paths. Media receipts must agree with their ID, MIME extension, URL and actual file size. Malformed JSON, wrong fields, traversal and oversized metadata fail as missing assets; restored receipts or replacement uploads work.
- FFprobe and VMAF JSON now have shared runtime schemas. Invalid duration, dimensions and score shapes are rejected before consumption. Filesystem checks are not a sandbox against an attacker concurrently replacing files on disk.

## Browser gates and isolation

| Command | Responsibility |
| --- | --- |
| `pnpm verify` | Governance, types, application tests and production builds |
| `pnpm test:ci` | Both Vitest shards for contracts, web and API; failures propagate |
| `pnpm test:server` | API tests, including real PostgreSQL and media fixtures when configured |
| `pnpm test:rwd` | All seven workspace sections at 390/1280 px, overflow and keyboard behavior in both engines |
| `pnpm test:visual` | Recovery behavior plus committed whole-page layout comparisons in both engines |
| `pnpm test:e2e` | Full Chromium and WebKit suite, including actual 3D, audio, output and SSE behavior |
| `pnpm benchmark:web` | Production-browser performance budget |

The 28 new whole-page screenshots cover seven workspace sections at two widths in two engines. They were visually reviewed with the bundled font pinned. Canvas/video pixels are masked only in these layout snapshots because GPU/media behavior has separate real-browser assertions. This does not claim an artistic pixel baseline for the hamster. The original four recovery-card baselines are unchanged. CI never updates screenshots; intentional updates need review and a reason in the commit.

Windows WebKit native video requests can bypass `page.route`. The output-failure cases therefore use a test-only HTTP proxy that forwards normal requests to the real API and serves registered missing/corrupt/held video fixtures. Recovery then serves a real MP4, checks decoded readiness, and preserves the original job. The proxy is started and stopped by Playwright and is not part of the product runtime.

Browser CI uses four independent jobs: Chromium/WebKit × shards 1/2 and 2/2. Each has its own VM, PostgreSQL service, ports, media files and report artifact. API database tests use random schemas and clean them up. Unit shards run sequentially in the quality job; they do not share concurrent filesystem writers. The separate Windows snapshot job uses the reviewed baseline OS and both engines. No new retries or screenshot tolerances hide failures.

## Final verification

Local `pnpm verify` passed 22 governance checks and 146 application tests (12 contracts, 77 web, 57 API), with PostgreSQL configured and no skipped integration tests. Type checking and production builds passed. The complete browser suite passed 128/128 (64 per engine) in 5.6 minutes, including Bruno's 14 requests / 16 assertions per engine.

The normal snapshot comparison passed 48/48 in 45.5 seconds without updating baselines. `pnpm test:ci` passed all 146 tests across six package/shard runs (6 + 18 + 28 + 6 + 59 + 29), with no skips. Both before/after performance runs were isolated from the browser regression runs. Git's enabled pre-commit hook reruns `pnpm verify`; the exact pushed SHA's CI result is recorded in issue #11. Detailed local logs are kept under ignored `.runtime/issue11-*.log`.

## CI portability follow-up

The first remote run on `dadf369` exposed failures that the local Windows run did not: partial font fallback in the new Windows WebKit snapshots, Linux WebKit navigating to a video document instead of downloading it, and a mobile playback assertion inspecting an offscreen second card. The quality job and three browser shards passed; that run was not accepted as delivery.

The new layout fixture now pins the bundled variable font on every descendant, including native controls and monospace declarations, and waits for font readiness. The affected baselines were regenerated for that explicit fixture change and reviewed at both widths in both engines; normal comparison then passed 48/48 in 45.1 seconds. Product font styles and the original recovery-card baselines are unchanged.

Scene download responses now use `application/octet-stream`, attachment disposition and `nosniff`; preview responses retain `video/mp4`. The real download test checks response headers, suggested filename, downloaded bytes against the receipt checksum, and decoding. The mobile comparison test scrolls each actual video into view before checking its clock, matching how the stacked cards are inspected without requiring offscreen playback. It retains all three playback assertions and does not replace media with mocks or add retries.

The focused post-fix Windows run passed 8/8 in 2.2 minutes across Chromium and WebKit, including audible/muted export, preview-frame equivalence, real downloads and all three comparison videos. Remote Linux results are recorded on the issue after the final SHA completes.

On `635830c`, all four Linux browser shards and the quality job passed. Windows visual comparison still exposed native `<summary>` marker metrics and file-selector fonts that descendant font rules do not control. Its render-page trace also showed the font response completing with HTTP 200 while `document.fonts.ready` stayed pending for the test deadline. The fixture now explicitly loads a `FontFace` before applying it, renders a fixed-width disclosure marker, and inherits the file-selector button font. These are test-only rendering conditions; real keyboard/media/control behavior continues to run without them. Fourteen affected baselines were regenerated and visually reviewed for those marker/button changes, with no screenshot tolerance or retry changes.

On `886d2c9`, all native-control comparisons passed; only the two WebKit render-page screenshots still stopped inside Playwright's redundant `document.fonts.ready` wait. Every layout case now asserts the registered fixture face is loaded and usable for Chinese/Latin text after explicitly awaiting `FontFace.load()`. Only the WebKit render screenshots disable Playwright's internal global font wait, restoring that environment setting in `finally`. Pixel matching, screenshot stability, readiness assertions and timeouts remain enabled; a missing/unusable font still fails. No baseline changes accompany this wait replacement.
