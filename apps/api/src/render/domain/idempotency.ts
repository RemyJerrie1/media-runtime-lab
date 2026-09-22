import { createHash } from 'node:crypto';
import { createRenderJobSchema, type CreateRenderJob } from '@media-lab/contracts';

export class IdempotencyConflict extends Error {
  constructor() {
    super('IDEMPOTENCY_CONFLICT');
  }
}

// Schema parsing fixes field order at every object level and strips unknown fields.
// Trace/request IDs and the idempotency key do not describe the render intent.
export function requestFingerprint(command: CreateRenderJob) {
  const { idempotencyKey: _key, ...intent } = createRenderJobSchema.parse(command);
  return `v1:${createHash('sha256').update(JSON.stringify(intent)).digest('hex')}`;
}

export function assertSameRequest(stored: string | null | undefined, incoming: string) {
  // Legacy rows did not persist narration, so their complete intent cannot be reconstructed.
  if (stored !== incoming) throw new IdempotencyConflict();
}
