# Codex automatic hook activation — 2026-09-22

## Diagnosis and repair

The official app-server `config/read` reported the repository project layer disabled because the nested Git repository was not trusted. `hooks/list` returned an empty list. Trust of the parent `self` directory did not enable the nested repository layer.

After explicit user confirmation, project trust and the two exact hook definition hashes were saved through `config/value/write`. `hooks/list` then reported both hooks enabled/trusted. No bypass-hook-trust, sandbox bypass, or approval-policy changes were used.

Actual app-server execution exposed a second problem: both original Windows command wrappers exited 1 before entering the scripts. Replacing the nested PowerShell wrapper with a Node launcher fixed automatic execution. The launcher resolves the Git root and forwards stdin and the child exit code. A regression test executes both configured commands from `apps/`, including stdin forwarding.

## Observed automatic behavior

Short-lived, ephemeral Codex integration runs read `packages/contracts/package.json` once and then finished. Their prompts prohibited edits, manual hook execution and repairs. The app-server emitted native hook/started and hook/completed notifications; these were correlated with `.runtime/codex-hook-invocations.jsonl`.

- Positive session `01a0c733-6a7f-7a51-b676-b64b28514fb1`, turn `01a0c733-6b48-76c1-b549-2747700773eb`: PreToolUse completed and returned the contract reminder; Stop ran full verification and completed successfully in 35.4 seconds. Local invocation result: passed.
- Negative session `01a0c734-08ea-7ed0-9a6d-0d91a1cb9f6f`, turn `01a0c734-0997-7663-b202-0d6917972223`: intentionally unavailable local database at port 1 caused six integration failures. Stop returned a blocking result, and Codex continued to report failure without repairs. The subsequent continuation guard emitted a not-rerun warning, not passing evidence.
- Raw local evidence: `.runtime/auto-hook-fixed-events.jsonl`, `.runtime/auto-hook-negative-events.jsonl`, `.runtime/codex-hook-invocations.jsonl`. Runtime files remain ignored. Hook invocation records exclude command payloads.
- Hook regression tests: 11 passed. Skill validation passed. Full verification and pre-commit checks are required for this change; remote CI is checked for the pushed SHA separately.

## Scope of activation

Automatic behavior is established for Codex sessions whose project cwd is `media-runtime-lab`, using the locally approved hook definitions. Trust is machine-local, not committed. Other clones need their own review. The original desktop task is rooted in the parent `self` folder; this evidence does not claim that the already-running parent-folder task hot-reloaded the nested hooks. The desktop's existing task could not be updated from the independent diagnostic app-server (`thread not found`); no running task or global sandbox policy was changed.

Use this repository as the Codex project root for development. Inspect config layers and hooks/list before relying on activation; correlate actual host hook notifications with invocation metadata. Metadata by itself can be fabricated and is not authentication.

Reference: https://learn.chatgpt.com/docs/hooks
