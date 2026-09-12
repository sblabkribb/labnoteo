/**
 * esbuild bundler for the Obsidian plugin — two staged builds.
 *
 * Stage 1 (automation): the `automation/src/*.ts` sources are bundled to
 * zero-dependency Node ESM `.mjs` files in `dist-automation/`. These are the
 * scripts the plugin later scaffolds into a vault (`node .labnoteo/scripts/*.mjs`). They
 * share the same `@labnoteo/core` workspace source the plugin uses, so there is
 * no drift; only Node built-ins stay external (js-yaml / core are inlined).
 *
 * Stage 2 (plugin): Obsidian loads a single CommonJS `main.js`. `obsidian`,
 * Electron and Node built-ins are provided by the host and stay external;
 * `@labnoteo/core` is bundled in. A `text` loader lets `src/` import the built
 * `.mjs` (stage 1 output) and the static templates as strings, so they are
 * embedded into `main.js` — a 3-file install (main.js/manifest.json/styles.css)
 * therefore still carries every automation asset for the scaffold command.
 *
 * Because stage 2 imports stage 1's output, stage 1 must build first. In watch
 * mode both stages are watched: editing an automation source rebuilds its
 * `.mjs`, which is an input of the plugin build and thus retriggers stage 2.
 *
 * Usage:
 *   node esbuild.config.mjs             # watch (dev)
 *   node esbuild.config.mjs production  # one-shot minified build
 */
import esbuild from 'esbuild';
import builtins from 'builtin-modules';

const production = process.argv[2] === 'production';

/**
 * Automation entry points (stage 1). Append future scripts here (e.g.
 * `validate.ts`, `issue-sync.ts`) — each becomes a `dist-automation/<name>.mjs`
 * that `src/scaffold/assets.ts` can embed.
 */
const AUTOMATION_ENTRYPOINTS = [
  'automation/src/check-large-files.ts',
  'automation/src/validate.ts',
  'automation/src/issue-sync.ts',
  // NOTE: issue-gate.ts / wiki-propose.ts (server-side AI, self-hosted runner)
  // are intentionally NOT built or scaffolded — the local AI agent (AGENTS.md
  // playbooks) covers those judgments. Sources remain for a future opt-in.
];

// --- Stage 1: automation scripts → dist-automation/*.mjs ---------------------
const automationCtx = await esbuild.context({
  entryPoints: AUTOMATION_ENTRYPOINTS,
  bundle: true,
  format: 'esm',
  target: 'node18',
  platform: 'node',
  logLevel: 'info',
  sourcemap: false,
  treeShaking: true,
  minify: production,
  outdir: 'dist-automation',
  outExtension: { '.js': '.mjs' },
  // Only Node built-ins stay external; @labnoteo/core and js-yaml are inlined so
  // the produced .mjs is zero-dependency.
  external: [...builtins],
});

/**
 * Embed the stage-1 automation output as strings WITHOUT a global `.mjs` text
 * loader — that would also catch dependency ESM (e.g. `js-yaml.mjs`) and load it
 * as text, breaking it. Scoping via `onLoad` keeps text-embedding to just the
 * `dist-automation/*.mjs` files `src/scaffold` imports.
 */
const embedAutomationMjs = {
  name: 'embed-automation-mjs',
  setup(build) {
    build.onLoad({ filter: /dist-automation[\\/].*\.mjs$/ }, async args => {
      const { readFile } = await import('node:fs/promises');
      return { contents: await readFile(args.path, 'utf8'), loader: 'text' };
    });
  },
};

// --- Stage 2: Obsidian plugin → main.js --------------------------------------
const pluginCtx = await esbuild.context({
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
  // Embed static templates as strings. The built automation `.mjs` is embedded
  // via the scoped `embedAutomationMjs` plugin instead of a global `.mjs` loader
  // (which would corrupt dependency ESM such as js-yaml).
  loader: {
    '.snippet': 'text',
    '.sh': 'text',
    '.md': 'text',
    '.yml': 'text',
    // `.jsonc` (schema templates) as text — a `.json` loader would corrupt the
    // catalog JSON that `@labnoteo/core` imports as parsed objects.
    '.jsonc': 'text',
  },
  plugins: [embedAutomationMjs],
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
  // Stage 1 must complete before stage 2 (which imports its output).
  await automationCtx.rebuild();
  await pluginCtx.rebuild();
  await automationCtx.dispose();
  await pluginCtx.dispose();
} else {
  // Build automation once so the plugin build has the .mjs to embed, then watch
  // both: an automation edit rebuilds its .mjs (a plugin input) → plugin rebuild.
  await automationCtx.rebuild();
  await automationCtx.watch();
  await pluginCtx.watch();
}
