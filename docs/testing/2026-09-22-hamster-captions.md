# Hamster round 3 — one timed Chinese caption

Scope and acceptance: [issue #5](https://github.com/RemyJerrie1/media-runtime-lab/issues/5).

## Behavior

- One bottom-safe-area caption; editable text, enabled state, start/end, size, text color and solid background.
- Explicit Apply keeps an invalid draft separate from the valid scene. Save/export are disabled while a draft is pending; navigation warns about unsaved drafts. Invalid imports preserve the active and stored document.
- Version 3 requires caption data. Versions 1 and 2 migrate with captions disabled, preserving position, size, color and animation. Storage is overwritten only on explicit save. Existing storage key remains unchanged.
- Time uses `evaluateScene` and the half-open interval `start <= t < end`. No independent subtitle timer or CSS animation.
- A 1280×720 transparent Canvas layer uses bundled Noto Sans TC, weight 400. Every character occupies one font-size cell, including Latin text. Twenty cells per line, maximum two lines / 40 characters; manual newlines share the same wrapping rule. Supported input is basic Chinese, ASCII and specified punctuation; emoji and control characters are rejected explicitly.
- Size 32–52, line height 1.5, padding 16 and bottom inset 40 are reference-canvas coordinates, scaled as one image with the preview. `captionLayout` and `drawCaption` are the shared geometry/rasterization entry points for the next export round. There is no FFmpeg text re-layout or video-export implementation in this round.
- Font and WebGL resources must finish before `data-ready=true`. Load failure offers retry; resources are released on unmount. Font provenance, hash, size and OFL license are in `apps/web/public/fonts/`.

## Verification

Windows, Node 22.23.2, pnpm 11.16.0, Playwright Chromium 1.63.0; production Next build and real API with isolated-schema PostgreSQL on port 55440.

- `pnpm verify`: 21 governance tests; 111 application tests (contracts 7, web 71, API 33), including 6 real PostgreSQL and 4 real FFmpeg tests; typecheck and production build pass. No skipped tests.
- `pnpm test:e2e`: all 28 pass, including four new caption scenarios and the original render/recovery/benchmark workflows. The live Bruno scenario also passes its six requests and eight assertions.
- Exact 0.99 / 1 / 3.99 / 4 second boundaries, reverse seek, pause, replay, reload and JSON import verified in Chromium. Caption canvas PNG data is identical at the same time before/after reload and desktop/mobile resizing in the same browser.
- Invalid length, newline count, unsupported symbols and timing prevent applying or saving; applied pixels and stored JSON remain intact. Font request abortion does not report ready; retry restores rendering.
- Desktop 1440 and mobile 390 screenshots inspected: Chinese glyphs render, two full lines at maximum size fit, no horizontal overflow, caption stays inside the frame above playback controls.
- Screenshots: [desktop](hamster-captions/desktop.png), [frame](hamster-captions/frame.png), [mobile](hamster-captions/mobile.png), [mobile frame](hamster-captions/mobile-frame.png).

Full logs remain local under `.runtime/hamster-captions-{verify,e2e,commit}.log`. Git pre-commit runs the required verify gate; current-session automatic Codex hook dispatch is not inferred from these manual commands. Exact pushed SHA CI is recorded in the issue after completion.

## Limits

Single caption only, fixed-cell typography and a full 11.9 MB font asset. Same-browser pixel determinism is verified; identical rasterization across operating systems is not claimed. Video export, multiple tracks and audio remain later issues. No public deployment was performed.
