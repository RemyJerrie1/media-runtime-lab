# ADR 0004 — One persistent audio track for hamster scenes

Status: accepted, 2026-09-23. Scope: [issue #7](https://github.com/RemyJerrie1/media-runtime-lab/issues/7).

The five-second silent scene renderer is complete. This round adds one optional uploaded background/voice track, not recording, generated speech, multiple tracks or public deployment.

## Decision

- Persist immutable audio in the local API asset store rather than IndexedDB. The user approved this revision; issue #7 records why. The editor and worker use the same validated bytes. Scene JSON/localStorage contain only an opaque asset ID, normalized-content checksum, measured duration/size and audio settings. Moving JSON alone does not move audio; missing assets require reconnecting the original API, replacing the upload or removing/muting the track.
- Accept actual MP3/WAV audio, at most 10 MiB and 60 seconds. Probe and decode on upload, normalize to stereo 48 kHz PCM, and atomically publish a UUID directory with metadata. Creation verifies tenant ownership and metadata/content identity. Worker verifies the immutable content again. Playback URLs are unguessable local-demo asset URLs, following the existing artifact model; this is not a private cloud file service.
- Scene v4 adds nullable `audio` with `asset`, `trimStart`, `start`, `volume` (0–1), and `muted`. Legacy documents migrate to v4 with no audio. Existing v3 render commands and job receipts remain readable with their original snapshot/fingerprint and renderer version. New v4 jobs use `hamster-2`; audio identity and settings are included in the existing fingerprint.
- Browser playback follows the absolute animation timeline, pauses on seek/visibility changes, and uses one audio element. A denied playback request pauses the timeline and presents a retry message. Files never autoplay on upload/reload. Rendered output uses the same trim/start convention: source time = trimStart + timeline time − start.
- Encode video as before, then stream-copy H.264 while adding AAC stereo 48 kHz. Normalize timestamps and use sample counts for trimming, delay and the exact five-second audio boundary. Pad a short source with silence; truncate a long source at the movie end. Muted, zero-volume or absent audio produces the existing video-only MP4. Check actual stream properties and full decode before publishing a receipt.

## Alternatives and consequences

IndexedDB would support offline audio preview but would add a second asset lifecycle and require a later upload/identity reconciliation. This portfolio already needs its local API for export, so one persistent backend copy is simpler to recover and verify. Web Audio could provide tighter sample scheduling; a single HTML audio element with timeline correction is sufficient for this MVP, with browser timing tolerance verified in E2E.

Replacing an upload creates a new immutable asset; assets referenced by older jobs are retained. There is no automatic asset garbage collector or cross-machine media bundle in this round. Normal upload failure/timeout removes temporary files, while abrupt process termination can leave orphan temporary directories, as with scene export. Request limits bound individual uploads; local disk retention is an explicit limitation.

Tests must measure decoded onset, tail silence and gain, not just FFmpeg arguments or presence of an audio stream. Browser tests cover upload, save/reload, seek, pause/replay, mute, replacement, missing/invalid assets, audible export/play/download and silent export. Existing preview/frame comparisons, legacy imports and recovery tests remain part of CI.
