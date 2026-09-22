import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.platform === 'win32' ? 'bru.cmd' : 'bru';
const result = spawnSync(
  executable,
  [
    'run',
    'media-assets/provision-demo.bru',
    'render-jobs',
    'scene-render',
    '--tests-only',
    '--env',
    'local',
  ],
  {
    cwd: resolve(root, 'bruno'),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
