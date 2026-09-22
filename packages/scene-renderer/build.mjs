import { build } from 'esbuild';
await build({
  entryPoints: ['src/capture.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: 'dist/capture.js',
  minify: true,
});
