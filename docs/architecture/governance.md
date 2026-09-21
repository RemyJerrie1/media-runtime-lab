# AI-assisted engineering governance

AI may propose code; repository policy decides whether it enters the system. The controls are executable:

- Architecture fitness functions reject reversed dependency direction and concrete infrastructure imports from application policy.
- Contract drift checks keep Zod schema, API reference, and Bruno examples aligned.
- Domain tests lock legal transitions and atomic artifact evidence.
- Application tests cover concurrent idempotency, tenant isolation, quota, work leases, and event replay.
- PostgreSQL integration tests run in CI against a real service and cover cross-instance deduplication, restart persistence, and expired-lease recovery.
- GitHub Actions blocks merge on governance, typecheck, tests, production build, and high-severity dependency audit.

The in-memory store is an explicit local fallback. Setting `DATABASE_URL` activates the durable PostgreSQL workflow. External identity, object storage, provider receipt verification, and OpenTelemetry export remain deliberate next milestones; the repository does not claim those controls are already production services.

## Runtime response contracts

The web API adapter parses media, render-job and operations responses with shared Zod schemas, including render-job SSE events. Invalid responses never become application state. Legacy jobs may omit `requestId`, `manifestUrl` and `renditions`; compatibility defaults are applied before full schema validation. Invalid SSE events close the stream and display a recovery message.

## Executable dependency boundaries

The boundary gate resolves imports using each app's TypeScript configuration and traverses the dependency graph, including aliases, barrels, type imports, literal dynamic imports and `require`. Backend domain code cannot reach outer layers; application cannot reach infrastructure or interfaces; infrastructure cannot reach application or interfaces. Web features cannot depend on other features, shared code cannot depend on features, and the design system cannot depend on shared or feature code.

Test files may compose adapters across layers, but production code cannot import test files. Nonliteral dynamic imports and unresolved local code imports fail the gate because their dependencies cannot be verified. These checks cover application source files under `apps`; external packages are not traversed. Fixture-based regression tests for the gate run as part of `pnpm governance` and `pnpm verify`.
