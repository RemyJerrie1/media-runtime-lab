import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function invocationRecord(input, event, result) {
  return {
    at: new Date().toISOString(),
    event,
    result,
    inputEvent: input.hook_event_name ?? null,
    sessionId: input.session_id ?? null,
    turnId: input.turn_id ?? null,
    cwd: input.cwd ?? null,
    // Metadata is correlation evidence, not authentication. Check host events too.
    hasHostContext: input.hook_event_name === event && typeof input.session_id === 'string',
  };
}

export function logInvocation(input, event, result) {
  const directory = fileURLToPath(new URL('../../.runtime/', import.meta.url));
  mkdirSync(directory, { recursive: true });
  appendFileSync(
    resolve(directory, 'codex-hook-invocations.jsonl'),
    JSON.stringify(invocationRecord(input, event, result)) + '\n',
  );
}
