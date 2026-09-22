import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { encodingBenchmarkSchema } from '../packages/contracts/dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRequire = createRequire(resolve(root, 'apps/api/package.json'));
const ffmpeg = process.env.FFMPEG_BINARY || apiRequire('ffmpeg-static');
const ffprobe = process.env.FFPROBE_BINARY || apiRequire('@ffprobe-installer/ffprobe').path;
const output = resolve(root, 'apps/web/public/benchmarks');
const source = resolve(root, 'docs/media/product-demo.mp4');
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const run = (binary, args) => {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
};
if (process.argv.includes('--verify')) {
  const report = encodingBenchmarkSchema.parse(
    JSON.parse(readFileSync(resolve(output, 'report.json'), 'utf8')),
  );
  if (hash(source) !== report.source.sha256)
    throw new Error('Benchmark source changed; rerun pnpm benchmark');
  for (const row of report.results) {
    const file = resolve(output, `${row.id}.mp4`);
    if (
      row.posterUrl !== `/benchmarks/${row.id}.jpg` ||
      hash(resolve(output, `${row.id}.jpg`)) !== row.posterSha256
    )
      throw new Error(`Benchmark poster mismatch: ${row.id}`);
    if (
      row.videoUrl !== `/benchmarks/${row.id}.mp4` ||
      row.sizeBytes !== statSync(file).size ||
      row.sha256 !== hash(file)
    )
      throw new Error(`Benchmark artifact mismatch: ${row.id}`);
    const median = [...row.elapsedMs].sort((a, b) => a - b)[1];
    if (row.medianMs !== median) throw new Error(`Incorrect median: ${row.id}`);
    run(ffmpeg, ['-v', 'error', '-i', file, '-f', 'null', '-']);
  }
  console.log('Benchmark evidence: source, output hashes, sizes, medians and real decode verified');
} else {
  mkdirSync(output, { recursive: true });
  const profiles = [
    { id: 'ultrafast-23', preset: 'ultrafast', crf: 23 },
    { id: 'slow-23', preset: 'slow', crf: 23 },
    { id: 'slow-30', preset: 'slow', crf: 30 },
  ];
  const input = [
    '-v',
    'error',
    '-y',
    '-ss',
    '0',
    '-i',
    source,
    '-t',
    '3',
    '-an',
    '-vf',
    'scale=640:360,fps=30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-threads',
    '2',
  ];
  // Warm the input and encoder once. Rotate profile order between rounds to reduce ordering bias.
  run(ffmpeg, [...input, '-preset', 'ultrafast', '-crf', '23', '-f', 'null', '-']);
  const timings = new Map(profiles.map((profile) => [profile.id, []]));
  for (let round = 0; round < 3; round++) {
    for (let index = 0; index < profiles.length; index++) {
      const profile = profiles[(index + round) % profiles.length];
      const start = performance.now();
      run(ffmpeg, [
        ...input,
        '-preset',
        profile.preset,
        '-crf',
        String(profile.crf),
        '-movflags',
        '+faststart',
        resolve(output, `${profile.id}.mp4`),
      ]);
      timings.get(profile.id).push(Math.round((performance.now() - start) * 100) / 100);
    }
  }
  const results = profiles.map((profile) => {
    const file = resolve(output, `${profile.id}.mp4`);
    const probe = JSON.parse(
      run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]),
    );
    run(ffmpeg, ['-v', 'error', '-i', file, '-f', 'null', '-']);
    const elapsedMs = timings.get(profile.id);
    const poster = resolve(output, `${profile.id}.jpg`);
    run(ffmpeg, ['-v', 'error', '-y', '-i', file, '-frames:v', '1', poster]);
    return {
      ...profile,
      elapsedMs,
      medianMs: [...elapsedMs].sort((a, b) => a - b)[1],
      sizeBytes: statSync(file).size,
      sha256: hash(file),
      videoUrl: `/benchmarks/${profile.id}.mp4`,
      posterUrl: `/benchmarks/${profile.id}.jpg`,
      posterSha256: hash(poster),
      width: probe.streams[0].width,
      height: probe.streams[0].height,
      durationSeconds: Number(probe.format.duration),
      decoded: true,
    };
  });
  const report = encodingBenchmarkSchema.parse({
    measuredAt: new Date().toISOString(),
    source: {
      path: 'docs/media/product-demo.mp4',
      sha256: hash(source),
      startSeconds: 0,
      durationSeconds: 3,
    },
    environment: {
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      node: process.version,
      ffmpeg: run(ffmpeg, ['-version']).split(/\r?\n/)[0],
      threads: 2,
    },
    method:
      'Same 3-second source, 640x360 / 30fps / no audio / libx264 / 2 threads. One warm-up; three sequential rounds with rotating profile order. Wall time includes process launch and output write, excludes probe/decode. Median reported; last output retained. Local measurements, not universal performance rankings or objective quality scores.',
    results,
  });
  writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
