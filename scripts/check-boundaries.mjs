import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const isTest = (file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
const normalized = (file) => file.replaceAll('\\', '/');

function forbidden(source, target) {
  if (isTest(target)) return 'production imports test code';
  const backend = 'apps/api/src/';
  const rules = {
    domain: ['application', 'interfaces', 'infrastructure'],
    application: ['interfaces', 'infrastructure'],
    infrastructure: ['interfaces', 'application'],
  };
  if (source.startsWith(backend) && target.startsWith(backend)) {
    const [feature, owner] = source.slice(backend.length).split('/');
    const [other, destination] = target.slice(backend.length).split('/');
    if (
      ['render', 'scene-render'].includes(feature) &&
      ['render', 'scene-render'].includes(other) &&
      feature !== other
    )
      return `cross-feature dependency: ${feature} -> ${other}`;
    if (rules[owner]?.includes(destination)) return `${owner} depends on ${destination}`;
  }
  const web = 'apps/web/app/';
  if (source.startsWith(web) && target.startsWith(web)) {
    const [owner, feature] = source.slice(web.length).split('/');
    const [destination, other] = target.slice(web.length).split('/');
    if (owner === 'design-system' && ['features', 'shared'].includes(destination))
      return 'design-system depends on outer layer';
    if (owner === 'shared' && destination === 'features') return 'shared depends on feature';
    if (owner === 'features' && destination === 'features' && feature !== other)
      return `cross-feature dependency: ${feature} -> ${other}`;
  }
}

export function checkBoundaries(root) {
  root = resolve(root);
  const files = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.next', 'dist', '.runtime'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.[cm]?[jt]sx?$/.test(path) && !path.endsWith('.d.ts')) files.push(path);
    }
  }
  walk(join(root, 'apps'));
  const graph = new Map();
  const errors = [];
  const options = new Map();
  for (const file of files) {
    const project = normalized(relative(root, file)).split('/').slice(0, 2).join('/');
    if (!options.has(project)) {
      const configPath = join(root, project, 'tsconfig.json');
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      if (config.error)
        throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, join(root, project));
      options.set(project, parsed.options);
    }
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const dependencies = [];
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      )
        specifier = node.moduleReference.expression;
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
        specifier = node.argument.literal;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        specifier = node.arguments[0];
        if (!specifier || !ts.isStringLiteralLike(specifier)) {
          if (!isTest(file))
            errors.push(
              `${normalized(relative(root, file))}: nonliteral import/require cannot be checked`,
            );
        }
      }
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const resolved = ts.resolveModuleName(
          specifier.text,
          file,
          options.get(project),
          ts.sys,
        ).resolvedModule;
        if (resolved && !resolved.isExternalLibraryImport)
          dependencies.push(resolve(resolved.resolvedFileName));
        else if (
          !resolved &&
          (specifier.text.startsWith('.') || specifier.text.startsWith('@/')) &&
          !/\.(css|svg|png|jpg)$/.test(specifier.text)
        ) {
          if (!isTest(file))
            errors.push(
              `${normalized(relative(root, file))}: unresolved local import ${specifier.text}`,
            );
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    graph.set(file, dependencies);
  }
  for (const source of files.filter((file) => !isTest(file))) {
    const sourceName = normalized(relative(root, source));
    const seen = new Set([source]);
    const queue = (graph.get(source) ?? []).map((target) => [target, [source, target]]);
    while (queue.length) {
      const [target, chain] = queue.shift();
      if (seen.has(target)) continue;
      seen.add(target);
      const reason = forbidden(sourceName, normalized(relative(root, target)));
      if (reason) {
        errors.push(
          `${reason}: ${chain.map((file) => normalized(relative(root, file))).join(' -> ')}`,
        );
        continue;
      }
      for (const dependency of graph.get(target) ?? [])
        queue.push([dependency, [...chain, dependency]]);
    }
  }
  return { errors, count: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkBoundaries(fileURLToPath(new URL('../', import.meta.url)));
  if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(`Boundary gate: ${result.count} source files checked (resolved dependency graph)`);
}
