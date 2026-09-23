import { spawn } from 'node:child_process';
export function startSceneProcess(binary: string, args: string[], signal: AbortSignal) {
  signal.throwIfAborted();
  const child = spawn(binary, args, { stdio: 'pipe', windowsHide: true });
  let errorText = '';
  const chunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => {
    if (chunks.reduce((sum, item) => sum + item.length, 0) < 2_000_000) chunks.push(chunk);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    errorText = (errorText + chunk.toString()).slice(-2000);
  });
  // EPIPE is surfaced by close/write, never as an unhandled EventEmitter error.
  child.stdin.on('error', () => {});
  const abort = () => {
    child.kill('SIGKILL');
  };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const done = new Promise<Buffer>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(signal.reason);
      else if (code !== 0) reject(new Error(`SCENE_PROCESS_FAILED:${errorText.slice(-300)}`));
      else resolve(Buffer.concat(chunks));
    });
  });
  void done.catch(() => {});
  return { child, done };
}
