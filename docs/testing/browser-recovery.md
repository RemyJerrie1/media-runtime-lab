# Browser recovery and retry verification

## Behavior

- Render updates are scoped to a mounted hook generation and active job identity. Only strictly newer sequences update the UI; terminal state cannot regress.
- Switching jobs, navigating away, and cross-tab storage changes invalidate older requests and timers. SSE failures recover through GET before reconnecting from the accepted sequence. Invalid events close the stream and show a recovery message.
- A command and UUID are saved before POST. Ambiguous failures retain the original command across reloads. **Retry original operation** uses the same payload and key even if editor controls changed. Successful submission clears the pending command after saving the job ID.
- Starting another operation after success creates a fresh UUID. Discarding an uncertain operation is explicit and warns that the original job might already exist. Persistence failure prevents sending an unrecorded command.

## Reproduction

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Install Chromium with `pnpm exec playwright install chromium` (Linux CI uses `--with-deps`).
3. Run `pnpm verify`, then `pnpm test:e2e`. Ports 3000 and 4000 must be free; the runner owns and stops its web/API servers.
4. Set `DATABASE_URL` to a dedicated test database to exercise the live browser flow with PostgreSQL. Without it, the live API uses the explicit in-memory fallback. The API runner enables its worker; `NODE_ENV=test` would disable it.

The CI gate includes all 11 Playwright cases: 9 browser fault/recovery cases, 1 live media workflow, and 1 Bruno collection check. Fault tests use production React UI with controlled responses/event ordering. One fault case exercises native EventSource EOF, GET recovery, and cursor replay. The live workflow uses the real API, native SSE, FFmpeg and browser video loading, dropping the first POST response only after the backend accepted it. Bruno provisions its own demo asset and runs the render requests with assertions; the long-lived SSE request is excluded with `--tests-only` and covered by the browser cases.

Existing unit/integration tests cover illegal domain transitions and provider/processor failure paths. Browser coverage currently targets Chromium. It does not establish cross-browser compatibility or multi-device coordination of pending commands.

Evidence is written under ignored `.runtime/playwright-report` and `.runtime/playwright-results`, including a live completion screenshot and receipt, Bruno JSON, and failure traces/screenshots. GitHub Actions uploads these as `browser-test-evidence` for seven days.

Job lookup and event endpoints validate UUID v4 path parameters before accessing storage: malformed IDs return 400, while a well-formed absent ID returns 404. The live HTTP checks cover these cases with PostgreSQL.

Local verification (2026-09-21): pnpm verify passed (77 application tests including 4 PostgreSQL integration tests; 10 boundary tests; typecheck and build). All 11 Playwright cases passed with DATABASE_URL configured. Temporary PostgreSQL, web and API servers were stopped afterward.
