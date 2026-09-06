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
    find: '@labnoteo/core/node',
    replacement: path.resolve(__dirname, 'packages/labnoteo-core/src/node/index.ts'),
  },
  {
    find: '@labnoteo/core',
    replacement: path.resolve(__dirname, 'packages/labnoteo-core/src/index.ts'),
  },
];

export default defineConfig({
  resolve: {
    alias: coreAlias,
  },
  test: {
    // Core tests run WITHOUT any host mock so pure logic stays decoupled from
    // the Obsidian plugin layer.
    name: 'core',
    environment: 'node',
    globals: true,
    include: ['packages/labnoteo-core/src/**/*.{test,spec}.{js,ts}'],
  },
});
