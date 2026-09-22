---
name: development
description: Deliver a governed end-to-end change in Media Runtime Lab with explicit contracts, dependency boundaries, real regression evidence, and a reviewable commit. Use for this repository's Codex dev-flow, including authorized commit and push requests.
---

# Governed development

1. Identify the user-visible outcome and owning feature. Read `AGENTS.md`, inspect the branch, remote and current diff, and preserve existing user changes.
2. Trace contract → domain invariant → application use case → adapter → UI. Keep infrastructure behind domain ports and network access outside presentation components.
3. Keep the smallest coherent change surface. Update executable contracts, documentation, Bruno fixtures, consumers and regression tests together. Preserve deterministic media behavior when providers fail.
4. Run focused regression tests during implementation, then `pnpm verify` on the final code. Record failures and fix their causes; distinguish an environment/dependency failure from a test assertion failure.
5. Record changed behavior, test counts, skipped checks and remaining limitations. Keep full local logs in ignored `.runtime/`; put a concise, reproducible result in `docs/testing/` when the change warrants durable evidence.

## Meaningful verification

- Workflow ownership/retry changes need real PostgreSQL tests as well as unit tests. Use isolated random schemas or a dedicated test database; clean up only those resources. Exercise expiry, stale worker attempts, retry exhaustion and recovery after a final-attempt crash when relevant.
- Confirm the test runner actually receives `DATABASE_URL`. An omitted variable or cached result can silently skip integration coverage. Report skips explicitly and never call that a full database verification.
- Media pipeline changes need short real FFmpeg fixtures that check decoded results: relevant pixels, duration, frame rate, audio properties and readable HLS segments. Argument-string tests alone do not establish output correctness.
- Delivery paths belong to the committed receipt. When their identity or layout changes, search UI consumers, preview-quality switching, API examples and Bruno for URLs constructed from job IDs.
- Distinguish output probe data, successful decoding, requested settings, estimates and browser playback evidence. Claim browser E2E or Bruno HTTP coverage only after actually running it; use the repository's `test-e2e` skill when that workflow is requested or needed.
- If pnpm tries to reinstall dependencies before tests, inspect the local launcher and dependency state. First restore declared dependencies using the lockfile. Disable `verify_deps_before_run` only for that invocation after dependencies are verified; do not weaken repository checks or skip hooks to get a green result.
- Stop temporary services started for verification. Report any deliberately retained test assets or remaining cleanup limitations.

## Commit and push

- Commit or push only within the user's requested scope. Existing explicit authorization remains sufficient; do not add a redundant confirmation step.
- Review the actual diff and `git diff --check`. Windows line-ending changes can make status noisy without substantive diffs. Stage only task-owned changes and inspect `git diff --cached --stat` and staged paths before committing. Exclude runtime media, logs, local databases, credentials and unrelated work.
- Keep hooks enabled and provide their required test environment. Documentation-only skill updates after a passing code verification require skill validation, not an unnecessary rebuild of unchanged application code.
- On Windows, check package-manager resolution in the Git hook shell, not just PowerShell. If the desktop runtime provides only a `.cmd` launcher that Git Bash cannot resolve, use a temporary shell-compatible shim invoking the same runtime and CLI, with PATH scoped to this invocation. Do not disable hooks or change global configuration to bypass the failure.
- Fetch the intended remote before pushing and check divergence. Do not force-push or overwrite remote work. If a normal push is rejected, inspect the new remote state before deciding how to integrate it; do not retry blindly.
- Use a behavior-focused commit message. Confirm the remote branch resolves to the pushed commit. Report the branch and commit hash; distinguish successful push from pending or unobserved remote CI.

## Completion gate

- The executable local gate is `pnpm verify` (governance, typecheck, tests, build), run by both Husky pre-commit and the Codex Stop hook. E2E, real database coverage and media checks still need the appropriate environment and separate evidence; a local pass is not remote CI success.
- Hook changes require `node --test scripts/codex-gate.test.mjs`, including failing child processes, malformed input and continuation handling. Keep these tests in governance/CI. Validate edited skills with the skill-creator validator when available.
- Codex matches unified `exec_command` as `Bash`; do not rename matchers based only on the API tool name. See https://learn.chatgpt.com/docs/hooks. Open the repository as the Codex project so its configuration is discoverable; merely running a command in a child repo does not establish hook activation.
- `.runtime/codex-gate.jsonl` records Stop gate invocations, not a reusable approval receipt. Manually invoking the script tests its behavior but does not prove automatic Codex dispatch. Report those separately. The continuation guard avoids infinite retries and emits a warning, never passing evidence.
- To establish automatic activation, inspect Codex `config/read` with layers and `hooks/list` for the actual task cwd. A disabled project layer or empty hook list is a failed activation check, not an executable test failure. Project trust and each hook definition's trust must be reviewed; never use bypass-hook-trust to claim a normal setup works. A parent folder's trust does not prove the child Git repository is trusted.
- Correlate `.runtime/codex-hook-invocations.jsonl` event/session/turn metadata with host hook-started/completed events. Missing host context identifies manual probes; context fields alone are not authentication. Verify a real PreToolUse and Stop invocation before calling automatic activation complete. Do not fabricate host fields for acceptance evidence.
- Never bypass hooks, remove failing acceptance criteria to get green, or claim success from skipped tests. Git hooks can be bypassed by a caller and Codex hooks depend on discovery/trust; neither is a security boundary. Confirm the pushed SHA's CI result separately before reporting delivery complete.

## Plan changes

- Treat the GitHub issue as the current scope and acceptance criteria; local planning documents link to it rather than maintaining a second progress ledger.
- Implementation details that preserve acceptance belong in the PR/commit explanation. Scope changes require updating the issue and recording what changed, why, and which dependent rounds are affected.
- Split added or deferred work into linked issues. Close cancelled work with the reason, not as completed acceptance. Keep evidence for superseded decisions instead of silently rewriting history.
- For significant architecture choices, write a short ADR covering context, decision, alternatives and consequences; link it from the issue/PR. Routine implementation choices do not need an ADR.
- Changing acceptance requires an explicit rationale and replacement verification; a failing test by itself is not a reason to weaken the gate.

- No reverse dependency across domain boundaries or hidden network call in presentation components.
- No drift between schema, API, Bruno, consumers and tests.
- No snapshot churn without a named behavior change.
- No claim of completion without executable evidence appropriate to the change.
