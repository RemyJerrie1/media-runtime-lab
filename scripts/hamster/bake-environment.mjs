import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

const rendererRequire = createRequire(resolve('packages/scene-renderer/package.json'));
const apiRequire = createRequire(resolve('apps/api/package.json'));
const { build } = rendererRequire('esbuild');
const { chromium } = apiRequire('playwright');
const bundle = await build({
  stdin: {
    contents: `
      import * as THREE from 'three';
      import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
      const renderer = new THREE.WebGLRenderer();
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const target = pmrem.fromScene(room, .04);
      const pixels = new Uint16Array(target.width * target.height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
      const bytes = new Uint8Array(pixels.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      window.baked = { width: target.width, height: target.height, colorSpace: target.texture.colorSpace, bytes: btoa(binary) };
      target.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose();
    `,
    resolveDir: resolve('packages/scene-renderer'),
  },
  bundle: true,
  format: 'iife',
  write: false,
});
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const baked = await page.evaluate(() => window.baked);
  if (baked.width !== 768 || baked.height !== 1024) throw new Error('Unexpected PMREM layout');
  const bytes = Buffer.from(baked.bytes, 'base64');
  await writeFile('packages/scene-renderer/assets/hamster-3/studio-env.bin', bytes);
  console.log({
    width: baked.width,
    height: baked.height,
    colorSpace: baked.colorSpace,
    size: bytes.length,
  });
} finally {
  await browser.close();
}
