import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const runtime = 'nodejs';
export async function GET() {
  const bytes = await readFile(
    resolve(process.cwd(), '../../packages/scene-renderer/assets/hamster-3/hamster.glb'),
  );
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'public, max-age=3600' },
  });
}
