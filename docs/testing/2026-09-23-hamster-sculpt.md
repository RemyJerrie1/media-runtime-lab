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
every original decoded-audio assertion and the same 120-second per-test limit.
Each processor gets a 110-second limit so browser/encoder cleanup precedes the test
deadline. No production timeout, model quality or acceptance assertion was relaxed.
