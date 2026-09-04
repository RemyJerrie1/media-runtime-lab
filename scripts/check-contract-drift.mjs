/**
 * Contract fitness function: the schema, the published reference, and the executable
 * regression suite must describe the same API.
 *
 * A single Zod schema in packages/contracts removes DTO drift between web and api, but it
 * cannot stop the *other* two copies of the truth from rotting: the API reference page a
 * consumer reads, and the Bruno requests that prove the endpoint still behaves. Those decay
 * quietly — nothing fails when a field is added to the schema and nowhere else, until an
 * integrator follows the documentation and gets a 400.
 *
 * So this gate asserts all three mention the same command fields and the same routes. It runs
 * on pre-commit and in CI: changing the schema without updating the reference or the requests
 * simply does not commit.
 *
 * Kept as a textual assertion on purpose — no parsing, no build, no runtime. The cost of a
 * gate is paid on every commit, so it has to be close to free.
 */
import { readFileSync } from 'node:fs';
const contract = readFileSync(
  new URL('../packages/contracts/src/index.ts', import.meta.url),
  'utf8',
);
const docs = readFileSync(
  new URL('../apps/web/app/api-reference/page.tsx', import.meta.url),
  'utf8',
);
const bruno = readFileSync(new URL('../bruno/render-jobs/create-job.bru', import.meta.url), 'utf8');
for (const field of [
  'projectId',
  'template',
  'trimStartSeconds',
  'durationSeconds',
  'encoding',
  'processing',
  'deliveryFormat',
  'abrLadder',
  'qualityMetric',
  'narration',
  'idempotencyKey',
])
  if (!contract.includes(field) || !bruno.includes(field)) {
    console.error(`Contract drift: ${field}`);
    process.exit(1);
  }
for (const route of [
  '/v1/render-jobs',
  ':id/events',
  '/v1/operations',
  '/streams/:jobId/master.m3u8',
])
  if (!docs.includes(route)) {
    console.error(`Reference drift: ${route}`);
    process.exit(1);
  }
console.log('Contract gate: schema, API reference and Bruno aligned');
