# Exception recovery verification

Scope: [issue #9](https://github.com/RemyJerrie1/media-runtime-lab/issues/9).

## Behavior

- Demo media has loading, failure and retry states; leaving the component cancels its request.
- Shared JSON requests have a 15-second deadline, including response body consumption. Uploads allow 60 seconds. Caller cancellation remains supported. The client does not automatically retry POST requests.
- An ambiguous render submission retains its persisted operation and idempotency key across reload; retry sends the original command.
- Render, composition and hamster output players report media errors and initial metadata loading timeout (30 seconds). Reloading the video reads the existing artifact without submitting another job. This is not a watchdog for every playback stall after metadata is loaded.
- Page and independent root-layout error fallbacks offer retry and home navigation, and acknowledge that unsaved edits can be lost.
- Unknown workspace URLs return HTTP 404. The regression initially found a 404 screen with HTTP 200; restricting the generated workspace route to its declared parameters fixed the response status.

## Reproduction

Using Node 22.23.2, pnpm 11.16.0, Windows and a local PostgreSQL test instance:

```powershell
$env:DATABASE_URL = '<isolated test PostgreSQL URL>'
pnpm verify
pnpm test:e2e
```

`pnpm verify` passed: 22 governance tests, 12 contract tests, 76 web tests and 53 API tests, including real PostgreSQL integration coverage. Type checks and production builds passed. Unchanged build tasks used Turbo's existing successful cache; application tests executed with the database configured.

Browser tests inject failures through Playwright request interception and browser API overrides; no fault-injection application route or production query parameter was added. Page and root-layout tests exercise the actual Next error boundaries and reset recovery. Because the workspace routes are statically generated, the loading test mounts the actual `loading.tsx` component inside a delayed React Suspense harness; it does not claim to exercise a streamed Next navigation.

The full browser suite passed: **46/46**, no retries, in 2.9 minutes. It includes real FFmpeg exports, browser playback, Bruno HTTP checks, existing SSE recovery, and the nine added exception/recovery cases. Delivery and exact-commit CI results are recorded on issue #9. Detailed local logs remain in ignored `.runtime/exception-*.log`; CI uploads Playwright evidence.
