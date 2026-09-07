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
        test: {
          // Plugin (Obsidian adapter) tests: same core aliases plus the
          // `obsidian` stub.
          name: 'plugin',
          environment: 'node',
          globals: true,
          include: ['tests/plugin/**/*.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
});
