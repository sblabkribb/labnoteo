/**
 * Ambient declarations for esbuild's `text` loader imports (see
 * `esbuild.config.mjs`). These let `src/scaffold/assets.ts` import the built
 * automation `.mjs` and static template files as plain strings, which esbuild
 * inlines into `main.js`. TypeScript only needs to know each import is a string.
 */
declare module '*.snippet' {
  const content: string;
  export default content;
}

declare module '*.sh' {
  const content: string;
  export default content;
}

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.mjs' {
  const content: string;
  export default content;
}

declare module '*.yml' {
  const content: string;
  export default content;
}

declare module '*.jsonc' {
  const content: string;
  export default content;
}
