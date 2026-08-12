# ADR 0002 - Durable workflow, outbox lease, and persisted replay

## Status

Accepted.

## Context

Process-local Maps and RxJS Subjects cannot preserve idempotency, work ownership, or progress history across API replicas and restarts. A portfolio control plane must demonstrate the failure semantics it claims.

## Decision

- Persist jobs, monotonic events, work leases, and artifacts in PostgreSQL.
- Serialize commands per tenant with a transaction advisory lock and enforce identity with a database unique constraint.
- Treat the outbox row as durable work ownership. Workers claim with `FOR UPDATE SKIP LOCKED`, receive a bounded lease, and release after each legal transition.
- Reclaim expired leases so a different worker can resume from authoritative job state.
- Store every transition with a monotonically increasing sequence. SSE reads persisted events after `Last-Event-ID`, so late and reconnecting consumers do not depend on process memory.
- Commit ready state, artifact URL/checksum, terminal event, and outbox completion in one transaction.
- Keep the application layer dependent on `WorkflowStore`, never on PostgreSQL or the in-memory adapter.

## Consequences

The control plane now survives API and worker restart and supports multiple replicas. PostgreSQL is intentionally doing queue coordination at this scale; a broker is not introduced until queue wait, workload isolation, or throughput measurements justify its operating cost. Polling is bounded and replaceable behind the same port.

## Re-evaluation signals

- p95 claim latency or database write contention breaches the queue SLO.
- Work classes need independent autoscaling, priority, or isolation.
- Delivery requires regional fan-out or event retention beyond the operational database.
- A managed broker provides lower total operating cost than PostgreSQL coordination.