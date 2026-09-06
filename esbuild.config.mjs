/**
 * esbuild bundler for the Obsidian plugin.
 *
 * Obsidian loads a single CommonJS `main.js` from the plugin folder. `obsidian`,
 * Electron and Node built-ins are provided by the host at runtime and must stay
 * external. `@labnoteo/core` is bundled in (it is TypeScript source, resolved
 * through the workspace).
 *
 * Usage:
 *   node esbuild.config.mjs             # watch (dev)
 *   node esbuild.config.mjs production  # one-shot minified build
 */
import esbuild from 'esbuild';
import builtins from 'builtin-modules';

const production = process.argv[2] === 'production';

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  minify: production,
  outfile: 'main.js',
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
