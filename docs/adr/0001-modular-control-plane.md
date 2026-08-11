# ADR 0001 — Modular control plane before distributed infrastructure

## Decision

Start with a modular NestJS control plane and explicit ports. Keep media execution asynchronous, but do not introduce a broker, CDN, or service split until queue depth, transfer volume, regional latency, or team ownership creates evidence for it.

## Why

The smallest system still needs burst tolerance, idempotency and recovery; it does not need the fixed operating cost of premature distribution. Serverless compute and object storage absorb early bursts. At sustained load, the execution port can move to BullMQ/SQS, workers to ECS/EKS or Cloud Run, and delivery to CloudFront/Cloud CDN without rewriting business policy.

## Re-evaluation signals

- p95 queue wait breaches the product SLO.
- Egress or repeated origin reads exceed CDN break-even.
- A worker class requires independent scaling or isolation.
- Cross-region playback latency becomes measurable business loss.
