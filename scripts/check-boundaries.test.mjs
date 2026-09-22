import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { checkBoundaries } from './check-boundaries.mjs';

function check(files) {
  const root = mkdtempSync(join(tmpdir(), 'media-boundary-'));
  try {
    for (const project of ['api', 'web']) {
      const directory = join(root, 'apps', project);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            moduleResolution: 'bundler',
            module: 'esnext',
            baseUrl: '.',
            paths: { '@/*': ['./*'] },
          },
        }),
      );
    }
    for (const [name, content] of Object.entries(files)) {
      const path = join(root, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    return checkBoundaries(root).errors;
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + 'media-boundary-'));
    rmSync(root, { recursive: true, force: true });
  }
}

for (const statement of [
  "import { value } from '../infrastructure/store';",
  "export { value } from '../infrastructure/store';",
  "const value = import('../infrastructure/store');",
  "const value = require('../infrastructure/store');",
  "import value = require('../infrastructure/store');",
  "type Value = import('../infrastructure/store').Value;",
])
  test(`rejects application infrastructure reference: ${statement}`, () => {
    assert.ok(
      check({
        'apps/api/src/render/application/use-case.ts': statement,
        'apps/api/src/render/infrastructure/store.ts':
          'export const value = 1; export type Value = number;',
      }).some((error) => error.includes('application depends on infrastructure')),
    );
  });

test('scene rendering follows backend layers and cannot import another feature', () => {
  assert.ok(
    check({
      'apps/api/src/scene-render/application/work.ts':
        "import { value } from '../infrastructure/store';",
      'apps/api/src/scene-render/infrastructure/store.ts': 'export const value = 1;',
    }).some((error) => error.includes('application depends on infrastructure')),
  );
  assert.ok(
    check({
      'apps/api/src/scene-render/application/work.ts':
        "import { value } from '../../render/domain/model';",
      'apps/api/src/render/domain/model.ts': 'export const value = 1;',
    }).some((error) => error.includes('cross-feature dependency')),
  );
});

test('resolves alias imports and follows barrels across features', () => {
  const errors = check({
    'apps/web/app/features/a/view.ts': "import { value } from '@/app/bridge';",
    'apps/web/app/bridge.ts': "export * from './features/b/model';",
    'apps/web/app/features/b/model.ts': 'export const value = 1;',
  });
  assert.ok(
    errors.some(
      (error) => error.includes('cross-feature dependency: a -> b') && error.includes('bridge.ts'),
    ),
  );
});

test('allows local feature imports, shared dependencies, comments and composition roots', () => {
  assert.deepEqual(
    check({
      'apps/web/app/features/a/view.ts':
        "import './model'; import '../../shared/helper'; // import '../../features/b/model'",
      'apps/web/app/features/a/model.ts': 'export const value = 1;',
      'apps/web/app/shared/helper.ts': 'export const helper = 1;',
      'apps/web/app/page.ts': "import './features/a/view'; import './features/b/model';",
      'apps/web/app/features/b/model.ts': 'export const value = 2;',
      'apps/api/src/render/application/use-case.test.ts': "import '../infrastructure/store';",
      'apps/api/src/render/infrastructure/store.ts': 'export const value = 1;',
    }),
    [],
  );
});

test('enforces domain, shared and design-system rules', () => {
  const errors = check({
    'apps/api/src/render/domain/model.ts': "import '../application/use-case';",
    'apps/api/src/render/application/use-case.ts': 'export {};',
    'apps/web/app/shared/helper.ts': "import '../features/a/model';",
    'apps/web/app/design-system/button.ts': "import '../shared/helper';",
    'apps/web/app/features/a/model.ts': 'export {};',
  });
  assert.ok(errors.some((error) => error.includes('domain depends on application')));
  assert.ok(errors.some((error) => error.includes('shared depends on feature')));
  assert.ok(errors.some((error) => error.includes('design-system depends on outer layer')));
});

test('production cannot bypass rules through test files or computed imports', () => {
  assert.ok(
    check({
      'apps/web/app/shared/helper.ts': "import './fixture.test';",
      'apps/web/app/shared/fixture.test.ts': 'export {};',
    }).some((error) => error.includes('production imports test code')),
  );
  assert.ok(
    check({ 'apps/web/app/features/a/model.ts': 'const target = "x"; import(target);' }).some(
      (error) => error.includes('nonliteral'),
    ),
  );
});
