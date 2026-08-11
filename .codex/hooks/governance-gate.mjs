import { spawnSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw || '{}');

if (input.stop_hook_active) {
  process.stdout.write('{}');
  process.exit(0);
}

const runner = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(runner, ['governance'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32',
  env: { ...process.env, CI: 'true' },
});

if (result.status === 0) {
  process.stdout.write('{}');
  process.exit(0);
}

const evidence = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
process.stdout.write(JSON.stringify({
  decision: 'block',
  reason: `Governance gate failed. Repair boundary or contract drift before completion.\n${evidence}`,
}));
