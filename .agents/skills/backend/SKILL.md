---
name: backend
description: Build or review the NestJS media control plane with explicit domain invariants, idempotent commands, recoverable jobs, and attributable artifacts.
---

# Backend engineering

1. Keep domain policy independent from NestJS, persistence, queues, and providers.
2. Validate commands at the interface boundary with the shared contract.
3. Assign one stable job identity across command acceptance, execution, events, artifact registration, and retries.
4. Enforce legal state transitions in the aggregate; adapters never mutate status directly.
5. Make duplicate commands safe through idempotency keys and authoritative reads.
6. Record artifact checksum, provider, prompt version, token usage, latency, and estimated cost.
7. Keep Canvas/FFmpeg execution behind a port so infrastructure can evolve from in-process to queue and worker isolation.

## Reliability checks

- Timeouts, retry budgets, and terminal failure are explicit.
- Event delivery can be repeated without corrupting state.
- Logs and metrics carry job, project, and tenant correlation.
- Cross-tenant reads are impossible at repository boundaries.
- Operational errors preserve stable public error semantics.
