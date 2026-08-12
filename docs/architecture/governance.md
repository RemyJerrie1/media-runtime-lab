# AI-assisted engineering governance

AI may propose code; repository policy decides whether it enters the system. The controls are executable:

- Architecture fitness functions reject reversed dependency direction and concrete infrastructure imports from application policy.
- Contract drift checks keep Zod schema, API reference, and Bruno examples aligned.
- Domain tests lock legal transitions and atomic artifact evidence.
- Application tests cover concurrent idempotency, tenant isolation, quota, work leases, and event replay.
- PostgreSQL integration tests run in CI against a real service and cover cross-instance deduplication, restart persistence, and expired-lease recovery.
- GitHub Actions blocks merge on governance, typecheck, tests, production build, and high-severity dependency audit.

The in-memory store is an explicit local fallback. Setting `DATABASE_URL` activates the durable PostgreSQL workflow. External identity, object storage, provider receipt verification, and OpenTelemetry export remain deliberate next milestones; the repository does not claim those controls are already production services.