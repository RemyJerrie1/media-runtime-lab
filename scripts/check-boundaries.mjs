/**
 * Architecture fitness function: layering is enforced, not documented.
 *
 * A layer diagram in a README decays the moment someone is in a hurry. This gate runs on
 * pre-commit and in CI, so the boundary is a property of the repository rather than a habit.
 *
 * Backend (apps/api/src/render/) — dependencies point inward:
 *   domain          imports nothing from application / interfaces / infrastructure
 *   application     imports nothing from interfaces
 *   infrastructure  imports nothing from interfaces
 *
 * Frontend (apps/web/app/) — the design system is the innermost layer:
 *   design-system   imports nothing from features / shared
 *   shared          imports nothing from features
 *
 * Detection is intentionally textual (a path segment appearing in the source) rather than a
 * full import graph: it needs no build step, it cannot be fooled by a re-export chain, and it
 * gives the same answer locally and in CI. It errs toward false positives, which is the right
 * failure direction for a gate — a wrong "blocked" is visible, a missed violation is not.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../apps/api/src/render/', import.meta.url));
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') && files.push(path);
  }
}
walk(root);
const rules = [
  ['domain', ['application', 'interfaces', 'infrastructure']],
  ['application', ['interfaces']],
  ['infrastructure', ['interfaces']],
];
const errors = [];
for (const file of files) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const layer = rel.split('/')[0];
  const source = readFileSync(file, 'utf8');
  for (const [owner, forbidden] of rules)
    if (layer === owner)
      for (const target of forbidden)
        if (source.includes(`../${target}`) || source.includes(`/${target}/`))
          errors.push(`${rel} imports ${target}`);
}
const webRoot = fileURLToPath(new URL('../apps/web/app/', import.meta.url));
const webFiles = [];
function walkWeb(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    statSync(path).isDirectory() ? walkWeb(path) : /\.tsx?$/.test(path) && webFiles.push(path);
  }
}
walkWeb(webRoot);
const webRules = [
  ['design-system', ['features', 'shared']],
  ['shared', ['features']],
];
for (const file of webFiles) {
  const rel = relative(webRoot, file).replaceAll('\\', '/');
  const layer = rel.split('/')[0];
  const source = readFileSync(file, 'utf8');
  for (const [owner, forbidden] of webRules)
    if (layer === owner)
      for (const target of forbidden)
        if (source.includes(`../${target}`) || source.includes(`/${target}/`))
          errors.push(`web/${rel} imports ${target}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Boundary gate: ${files.length} backend + ${webFiles.length} frontend files checked`);
