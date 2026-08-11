let raw = '';
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || '{}');
const command = String(input?.tool_input?.command ?? '');
const touchesContract = /packages[\\/]contracts|packages\/contracts/.test(command);

if (!touchesContract) process.exit(0);

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: [
      'Contract boundary change detected.',
      'Keep schema, NestJS adapter, API reference, Bruno fixture, and contract tests synchronized.',
      'Run pnpm governance before completion.',
    ].join(' '),
  },
}));
