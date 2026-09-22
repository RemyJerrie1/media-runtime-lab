import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateGate, parseInput, repositoryRoot } from '../.codex/hooks/governance-gate.mjs';

test('gate runs full verification from repository root, not caller cwd', () => {
  let calls = 0;
  const result = evaluateGate({}, (command, args, options) => {
    calls++;
    assert.match(command, /^pnpm(?:\.cmd)?$/);
    assert.deepEqual(args, ['verify']);
    assert.equal(options.cwd, repositoryRoot);
    assert.equal(options.env.CI, 'true');
    assert.ok(options.timeout < 600_000);
    return { status: 0 };
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, {});
});
for (const [name, result] of Object.entries({
  assertion: { status: 1, stderr: 'assertion failed' },
  missingExecutable: { status: null, error: new Error('ENOENT') },
  timeout: { status: null, error: new Error('ETIMEDOUT'), signal: 'SIGTERM' },
  signal: { status: null, signal: 'SIGTERM' },
})) {
  test(`gate blocks ${name}`, () => {
    const output = evaluateGate({}, () => result);
    assert.equal(output.decision, 'block');
    assert.match(output.reason, /pnpm verify failed/);
  });
}
test('real failed child process cannot produce a passing gate', () => {
  const output = evaluateGate({}, () =>
    spawnSync(process.execPath, ['-e', 'console.error("fixture failure"); process.exit(7)'], {
      encoding: 'utf8',
    }),
  );
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /fixture failure/);
});
test('continuation guard prevents loops without asserting success', () => {
  const output = evaluateGate({ stop_hook_active: true }, () => assert.fail('must not rerun'));
  assert.match(output.systemMessage, /NOT passing evidence/);
});
test('malformed hook input is rejected, not mistaken for a continuation', () => {
  for (const raw of ['{', 'null', '[]', '{"stop_hook_active":"false"}'])
    assert.throws(() => parseInput(raw));
  const output = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../.codex/hooks/governance-gate.mjs', import.meta.url))],
    { input: '{', encoding: 'utf8' },
  );
  assert.equal(JSON.parse(output.stdout).decision, 'block');
});

test('contract reminder handles shell, exec, structured edits and raw patches', async () => {
  const { contractReminder } = await import('../.codex/hooks/pre-tool-governance.mjs');
  for (const tool_input of [
    { command: 'cat packages/contracts/src/index.ts' },
    { cmd: 'Get-Content packages\\contracts\\src\\index.ts' },
    { file_path: 'packages/contracts/src/index.ts' },
    '*** Update File: packages/contracts/src/index.ts',
  ]) {
    assert.equal(contractReminder({ tool_input }).hookSpecificOutput.hookEventName, 'PreToolUse');
  }
  assert.deepEqual(contractReminder({ tool_input: { cmd: 'git status' } }), {});
});
