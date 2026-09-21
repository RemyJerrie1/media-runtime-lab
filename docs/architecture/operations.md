# Operations model

## Service objectives

| Signal | Objective | Measurement source |
| --- | ---: | --- |
| Render success | 99.9% | terminal transition counters |
| Duplicate execution | 0% | unique command identity and duplicate receipt counter |
| Client recovery | <= 2 seconds | persisted event sequence and reconnect timing |
| Cost attribution | 100% | jobs with token and cost evidence |
| Trace completeness | 100% | command, transitions, artifact, and usage share trace/job identity |

Targets are engineering objectives, not claims about historical customer traffic. The local `/v1/operations` endpoint exposes the current process window and target values. Production deployment should export the same dimensions through OpenTelemetry and alert on rolling SLO burn.

## Failure model

| Failure | Detection | Recovery |
| --- | --- | --- |
| Duplicate command on multiple API replicas | unique constraint conflict | return the persisted identity |
| API restart after command commit | job and outbox remain persisted | any API instance reads authoritative state |
| Worker crash during encoding | lease expires without terminal commit | another worker claims and resumes from current state |
| Encoding exceeds one lease | heartbeat every second renews a five-second lease | keep exclusive ownership; abort child processes if renewal fails |
| Repeated processing failure | ten rendering attempts exhausted | persist `failed` and its terminal event; release active quota count |
| Crash on the last attempt | exhausted expired lease is reclaimed | finalize `failed` without executing FFmpeg again |
| SSE disconnect or late subscription | client cursor is behind persisted sequence | replay events after `Last-Event-ID` |
| Artifact registration failure | transaction rolls back | outbox remains reclaimable; job does not falsely become ready |
| Tenant quota exceeded | transaction-scoped attributed token calculation | reject before job and work creation |

## Trace contract

Every structured workflow log includes `traceId`, `tenantId`, `projectId`, `jobId`, `status`, `sequence`, and `attempt`. Artifact URL/checksum and usage attribution live on the same job receipt. This makes the path `command -> job -> transition -> artifact -> cost` joinable without parsing human messages.

## Honest boundaries

Implemented: persistence, event replay, work lease recovery, atomic completion, tenant isolation, quota, structured logs, CI integration database.

Implemented locally: bounded media upload, ffprobe validation, FFmpeg worker execution, SHA-256 artifact receipt, HTTP range delivery, and HTML video preview.

Still simulated or out of scope: external AI provider receipt, object storage/CDN, identity provider, and distributed telemetry backend.

## Media and lease guarantees

Lease mutations are fenced by worker identity, attempt number, and unexpired ownership. Retry delay doubles from one second to a maximum of sixty seconds. Each FFmpeg/ffprobe child has a ten-minute timeout; lease loss aborts it. Concurrent rendition failures cancel siblings and await their exit before retrying.

MP4 and HLS renditions share the composition plan, including watermark, trimming, frame rate and audio resampling. `abrLadder=none` emits one source-size rendition; `standard` emits four. Evidence stores the output probe. `playbackVerified` means FFmpeg successfully decoded the MP4 and every media playlist, not a browser compatibility certification. `watermarkApplied` records the successfully executed filter mode; keyframe interval remains calculated from the requested GOP/FPS, not a frame-by-frame measurement.

Each execution writes to a fresh UUID-based delivery path. Clients must follow receipt URLs instead of deriving them from the job ID. Only the lease owner can register the receipt as ready. Failed or abandoned executions can leave unreferenced files; a retention/garbage-collection policy is still required before production use.
