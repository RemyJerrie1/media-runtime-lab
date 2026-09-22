import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { logInvocation } from './invocation-log.mjs';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export function evaluateGate(input, run = spawnSync) {
  if (input.stop_hook_active) {
    return {
      systemMessage:
        'Verification was not rerun: Stop continuation guard. This is NOT passing evidence. Run pnpm verify and report any unresolved failure before claiming completion.',
    };
  }
  const result = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['verify'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 540_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  });
  if (result.status === 0 && !result.error && !result.signal) return {};
  const evidence = [result.error?.message, result.signal, result.stdout, result.stderr]
    .filter(Boolean)
    .join('\n')
    .slice(-6000);
  return {
    decision: 'block',
    reason: `pnpm verify failed or could not finish. Repair the failure; do not claim completion.\n${evidence}`,
  };
}

export function parseInput(raw) {
  const input = JSON.parse(raw || '{}');
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected a hook input object');
  if ('stop_hook_active' in input && typeof input.stop_hook_active !== 'boolean')
    throw new Error('Invalid stop_hook_active');
  return input;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let output;
  try {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    mkdirSync(resolve(repositoryRoot, '.runtime'), { recursive: true });
    const input = parseInput(raw);
    output = evaluateGate(input, (...args) => {
      const result = spawnSync(...args);
      writeFileSync(
        resolve(repositoryRoot, '.runtime/codex-verify.log'),
        [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n'),
      );
      return result;
    });
    logInvocation(
      input,
      'Stop',
      output.decision === 'block' ? 'failed' : output.systemMessage ? 'not-rerun' : 'passed',
    );
    appendFileSync(
      resolve(repositoryRoot, '.runtime/codex-gate.jsonl'),
      JSON.stringify({
        at: new Date().toISOString(),
        event: 'Stop',
        result:
          output.decision === 'block' ? 'failed' : output.systemMessage ? 'not-rerun' : 'passed',
        command: 'pnpm verify',
      }) + '\n',
    );
  } catch (error) {
    output = { decision: 'block', reason: `Verification gate error: ${error.message}` };
  }
  process.stdout.write(JSON.stringify(output));
}
