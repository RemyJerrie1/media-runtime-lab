# Recovery quality follow-up

Scope: [#10](https://github.com/RemyJerrie1/media-runtime-lab/issues/10), following the review of `64d7619`.

## Fixed behavior and evidence

- Invalid media contracts produce concise Chinese copy instead of raw Zod JSON. Broken JSON and unavailable network paths also have recovery messages. WebKit's JSON `DOMException` named `SyntaxError` is handled explicitly; the first browser run exposed this difference.
- Composition errors use an expanding card instead of a clipped 16:9 preview. The watermark is only shown when the source is available. Both viewport sizes check the retry button's actual hit target, keyboard Tab/Enter recovery, disabled submission, and lack of horizontal overflow.
- Render source loading, manual demo retry, and upload use one owned AbortController. Starting another source cancels the old request. Unmount cancels the active request. The tests count active fetches and their deadline timers, and assert both go from one to zero. Composition and the actual output player's metadata timer have cleanup coverage too.
- A deliberately cancellation-resistant old response cannot replace the new uploaded source.

`pnpm test:recovery` runs 10 scenarios in each of Chromium and WebKit (20 checks). It uses the production Next build with controlled API transport; it is not a claim of full WebKit 3D/media coverage. The existing Linux E2E suite still exercises the real API, PostgreSQL, FFmpeg, audio and SSE.

## Visual baseline policy

The four initial error-card PNGs were reviewed after the layout/copy correction. Screenshots cover widths 1280 and 390 in both engines. Tests load the existing bundled NotoSansTC font for the card to eliminate host language-pack differences; therefore this checks layout, wrapping, colors and controls with a pinned font, not every system-font fallback.

The separate Windows CI job matches the local baseline OS and installs both browsers. It compares committed images with `updateSnapshots: 'none'`; no CI step updates baselines. Intentional baseline changes require local `pnpm test:recovery --update-snapshots`, image review, and an explicit reason in the commit. Failure traces/screenshots are uploaded separately from Linux media evidence.

## Before/after size measurement

Compared `64d7619` with this change on Node 22.23.2, esbuild 0.25.12. Each feature was bundled/minified independently with React, React DOM, contracts, Next imports and CSS externalized identically; gzip uses Node's default settings.

| Feature entry | Before gzip bytes | After gzip bytes | Delta |
| --- | ---: | ---: | ---: |
| composition-showcase | 6,544 | 6,709 | +165 |
| render-lab | 11,819 | 12,035 | +216 |
| scene-export | 4,242 | 4,246 | +4 |

These overlap in shared code and must not be summed as page transfer size. They do not establish loading speed, memory usage, or an enforceable performance budget.

## Verification commands

Local hard gates passed: 22 governance tests, 142 application tests (12 contracts, 77 web, 53 API, including PostgreSQL), type checks and production builds. The unchanged media/SSE suite passed 46/46 in 2.6 minutes; the recovery suite passed 20/20 without snapshot updates. An earlier overlapping build interfered with the last browser case; verification was repeated sequentially against the finished build without relaxing assertions.

```powershell
$env:DATABASE_URL = '<isolated PostgreSQL test URL>'
pnpm verify
pnpm test:e2e
pnpm test:recovery
```

Local detailed logs remain in ignored `.runtime/quality-*.log`. The issue records final local counts and the exact pushed SHA's CI result. The remaining performance, abuse, disk-contract, broad visual and full cross-browser gates are tracked in [#11](https://github.com/RemyJerrie1/media-runtime-lab/issues/11); this change does not claim all eleven review gates pass.
