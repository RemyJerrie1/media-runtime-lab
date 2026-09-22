# Codex gate verification — 2026-09-22

## Change

- Codex Stop now runs full `pnpm verify` from the repository root, with a 540-second child timeout inside the 600-second hook timeout. Process failure, startup error, signal and invalid input cannot produce a passing result.
- The Stop continuation guard prevents an infinite repair loop and explicitly reports verification was not rerun. It is not an approval receipt.
- `.runtime/codex-gate.jsonl` records invocations; `.runtime/codex-verify.log` contains the latest executed verification output. Both are ignored local evidence, not reusable authorization.
- Husky pre-commit now includes build through `pnpm verify`. Hook regression tests run in governance and therefore in existing CI.
- Contract reminders cover command/cmd, structured edits and raw patches. They remain reminders, not an enforcement boundary.
- Development skill and AGENTS now distinguish local gates, automatic dispatch and remote CI, and explain issue scope changes, deferred work and ADRs.

## Executed evidence

- Skill creator `quick_validate.py`: passed (UTF-8 mode, existing PyYAML dependency).
- Gate tests: 9 passed. Boundary tests: 10 passed. Total governance tests: 19 passed, zero skipped.
- Full Stop script invoked manually through stdin: initially returned `decision: block` when database integration failed due to the old cluster's unknown role; after using a dedicated cluster, returned `{}`.
- Full `pnpm verify`: passed. Application tests: contracts 3, web 51, API 33 = 87 passed. API includes 6 real PostgreSQL tests and 4 real FFmpeg tests. Typecheck and build passed.
- Dedicated local PostgreSQL 18 test cluster under ignored `.runtime/pg-gate-data`, bound to 127.0.0.1:55440. Integration tests use isolated random schemas.
- Actual `.husky/pre-commit` executed using Git Bash with an isolated failing pnpm fixture: propagated exit 23, as expected. No commit was created by that negative test.
- Existing dependencies restored with `pnpm install --frozen-lockfile`; no lockfile change.

## Limits

This proves script behavior and the Git hook path, not automatic Codex dispatch in this task. The task is rooted in the parent workspace; repo hook discovery/trust must be checked when opening this repository as the Codex project. Do not claim that a manual invocation proves host dispatch. Git hooks and Codex hooks are development guardrails, not protection against deliberate bypass.

Browser E2E, benchmark verification and audit are covered by the existing remote workflow and must be observed for the pushed SHA. They were not rerun locally for this tooling-only change. No application behavior or hamster implementation changed.

Hook semantics reference: https://learn.chatgpt.com/docs/hooks (unified exec matches Bash; Stop block requests continuation).
