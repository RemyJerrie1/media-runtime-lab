import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  const bytes = await readFile(
    resolve(process.cwd(), '../../packages/scene-renderer/assets/hamster-3/studio-env.bin'),
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
