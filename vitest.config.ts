import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

// Array-form aliases so the `@labnoteo/core/lib/*` wildcard subpath can be
// resolved via a RegExp (vite/@rollup-plugin-alias only support wildcard
// matching through RegExp `find` entries). Order matters: the most specific
// entries must come first so a shorter prefix does not shadow them.
const coreAlias = [
  {
    find: /^@labnoteo\/core\/lib\/(.*)$/,
    replacement: path.resolve(__dirname, 'packages/labnoteo-core/src/lib/$1.ts'),
  },
  {
    find: '@labnoteo/core/headings',
    replacement: path.resolve(__dirname, 'packages/labnoteo-core/src/sections/unitOpHeading.ts'),
  },
  {
    find: '@labnoteo/core/posix',
    replacement: path.resolve(__dirname, 'packages/labnoteo-core/src/util/posixPath.ts'),
  },
  {
    find: '@labnoteo/core',
    replacement: path.resolve(__dirname, 'packages/labnoteo-core/src/index.ts'),
  },
];

// The published `obsidian` package ships types only, so plugin code that uses it
// as a value needs a runtime stand-in. Scoped to the `plugin` project: the core
// project must stay unable to resolve it at all.
const obsidianAlias = {
  find: /^obsidian$/,
  replacement: path.resolve(__dirname, 'tests/stubs/obsidian.ts'),
};

// Mirror esbuild's `text` embedding (see esbuild.config.mjs) for the test env:
// `src/scaffold/assets.ts` imports static templates and the built automation
// `.mjs` as strings. Vite has no such loader, so resolve those specific assets
// to a default-exported string. Scoped to `automation/templates/*` and
// `dist-automation/*.mjs` so unrelated ESM (e.g. js-yaml.mjs) is untouched, and
// tolerant of a not-yet-built `.mjs` (tests may run before `npm run build`).
const embeddedTextAssets = {
  name: 'embedded-text-assets',
  enforce: 'pre' as const,
  async resolveId(source: string, importer: string | undefined) {
    const isTemplate = /[\\/]automation[\\/]templates[\\/].*\.(snippet|sh|md|yml|jsonc)$/.test(source);
    const isAutomationBuild = /[\\/]dist-automation[\\/].*\.mjs$/.test(source);
    if (!isTemplate && !isAutomationBuild) return null;
    const abs =
      importer && source.startsWith('.')
        ? path.resolve(path.dirname(importer), source)
        : source;
    return `\0embedded:${abs}`;
  },
  async load(id: string) {
    if (!id.startsWith('\0embedded:')) return null;
    const abs = id.slice('\0embedded:'.length);
    const { readFile } = await import('node:fs/promises');
    let contents = '';
    try {
      contents = await readFile(abs, 'utf8');
    } catch {
      contents = ''; // built automation .mjs may not exist yet in CI
    }
    return `export default ${JSON.stringify(contents)};`;
  },
};

// NOTE: vitest 4 does NOT inherit root-level options into inline projects
// (`extends` only defaults to true from vitest 5). Each project therefore
// declares the aliases it needs rather than relying on a root `resolve` block.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: coreAlias },
        test: {
          // Core tests run WITHOUT any host mock so pure logic stays decoupled
          // from the Obsidian plugin layer.
          name: 'core',
          environment: 'node',
          globals: true,
          include: ['packages/labnoteo-core/src/**/*.{test,spec}.{js,ts}'],
        },
      },
      {
        resolve: { alias: [...coreAlias, obsidianAlias] },
        plugins: [embeddedTextAssets],
        test: {
          // Plugin (Obsidian adapter) tests: same core aliases plus the
          // `obsidian` stub.
          name: 'plugin',
          environment: 'node',
          globals: true,
          include: ['tests/plugin/**/*.{test,spec}.{js,ts}'],
        },
      },
      {
        test: {
          // Automation script tests: zero-dependency Node sources, so no core
          // aliases or obsidian stub are needed.
          name: 'automation',
          environment: 'node',
          globals: true,
          include: ['automation/**/*.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
});
