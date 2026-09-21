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

- No reverse dependency across domain boundaries or hidden network call in presentation components.
- No drift between schema, API, Bruno, consumers and tests.
- No snapshot churn without a named behavior change.
- No claim of completion without executable evidence appropriate to the change.
