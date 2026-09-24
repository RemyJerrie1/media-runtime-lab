import { spawnSync } from 'node:child_process';

const requested = process.argv[2];
if (requested && !/^[12]\/2$/.test(requested)) throw new Error('Expected shard 1/2 or 2/2');
for (const shard of requested ? [requested] : ['1/2', '2/2']) {
  for (const name of ['contracts', 'web', 'api']) {
    const result = spawnSync(
      'pnpm',
      ['--filter', `@media-lab/${name}`, 'exec', 'vitest', 'run', `--shard=${shard}`],
      {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: process.env,
      },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
