import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function contractReminder(input) {
  const payload = input?.tool_input;
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  if (!/packages[\\/]+contracts/.test(content)) return {};
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        'Contract boundary change detected. Keep schema, adapter, API reference, Bruno fixtures, consumers and contract tests synchronized. Run pnpm verify before completion. This reminder is not a passing gate.',
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    process.stdout.write(JSON.stringify(contractReminder(JSON.parse(raw || '{}'))));
  } catch {
    process.stderr.write('Invalid PreToolUse input; repository policy could not be evaluated.');
    process.exitCode = 2;
  }
}
