# Accepted hamster sculpt integration

Scope: [issue #8](https://github.com/RemyJerrie1/media-runtime-lab/issues/8);
decision: [ADR 0005](../adr/0005-versioned-hamster-asset.md).

## Change

The accepted iteration 16 GLB replaces the old geometric character for new v4 scene jobs
(`hamster-3`). Preview and MP4 capture await the same local asset and use identical
lighting/absolute-time evaluation. Continuous lower-body geometry replaces ankle cuffs.
Generated source is in `scripts/hamster/build.py`; temporary viewers and Blender tools remain ignored.

Legacy renderer source was compared against the previous committed renderer: identical
apart from the exported function name. Existing hamster-2 operations still deduplicate
against their stored renderer version; different scene content still produces a conflict.

## Local evidence

Windows, Node 22.23.2, pnpm 11.16.0, Playwright 1.63.0 Chromium. Dedicated PostgreSQL 18
on 127.0.0.1:55441; integration tests use random isolated schemas.

- `pnpm verify`: governance 22/22; contracts 12/12, web 71/71, API 51/51.
  No skipped tests. Typecheck and production build passed. The CI follow-up splits
  the three audio-export scenarios into independent tests (API total becomes 53).
- `pnpm test:e2e`: 35/35 passed, including model failure/retry and navigation while loading.
- Real audible/muted MP4 export, decoded duration/audio measurements, browser playback,
  preview-to-export pixel comparison, seek/reload determinism and caption boundaries passed.
- `pnpm bruno`: 14 requests and 16 tests passed, including new hamster-3 and legacy scenes.
- `pnpm benchmark:verify`: hashes, sizes, medians and real decoding passed.
- `pnpm audit --audit-level high`: exit 0; five moderate advisories remain.
- Actual production-preview screenshots were inspected; the GLB also passed four-angle
  prototype viewing with no browser errors.

Logs, movies and browser evidence remain under ignored `.runtime/`.
One earlier standalone Bruno attempt ran after E2E had stopped its servers; it failed
to connect. Restarting a dedicated local API produced the passing result above.

## Limits

The approximately 20 MB asset uses procedural root/body/foot motion, not a skeletal rig.
No claim of photorealistic equivalence to the concept image. Blender is needed only to
regenerate the asset, not to build or run the app.
Local results do not prove remote CI success or automatic Codex hook dispatch.
The pushed SHA's workflow result is recorded separately in issue #8.

## CI follow-up

The first pushed run, 35846213631, timed out in the combined audio test: it executed
three full exports within a single 120-second budget on Linux software rendering.
Split delayed/gain, muted, and clipped-tail cases into independent tests, retaining
every original decoded-audio assertion. Run 35847069383 passed all three cases,
measuring 109.855, 96.769 and 96.523 seconds on Linux software rendering.
The final test budgets follow the existing production 120-second render deadline:
130 seconds for one processor test / browser completion wait, 180 seconds for a
single-export E2E including interaction/decoding, and 300 seconds for two exports.
This replaces the browser's earlier 90-second wait, which expired before a valid
production render could finish. No production timeout, model quality or decoded
media acceptance assertion was relaxed.

Run 35848171457 exposed two additional browser assumptions: its implicit five-second
assertion deadline expired during 3D startup (no failed-load state), and real wall
time could finish the five-second animation before the test clicked pause. Asset
readiness now has an explicit 30-second deadline. Playback-control tests use
Playwright's clock to advance animation time deliberately, while retaining real
HTML audio playback, UI actions, WebGL frames, and decoded MP4 assertions.
The production animation duration and export deadline remain unchanged.

The fixed RoomEnvironment PMREM is precomputed and loaded with the GLB. A real
Chromium 640×360 RGBA readback before/after found zero differing channels. Local
startup measurements (2.801 vs 3.188 seconds) do not establish a speedup. Missing
and malformed lighting exercise the same retry path as unavailable model data.

Local follow-up passed: full 35-test browser suite, then all eight animation/model
recovery cases including the two new lighting failures. The suite now contains 37
cases. Full governance/typecheck/136 application tests/build passed with PostgreSQL.
