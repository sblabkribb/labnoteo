#!/usr/bin/env node
/**
 * Single source of truth for the release version.
 *
 * Reads the version from the root `package.json` and propagates it to every
 * place that must agree for a release to be valid:
 *
 *   - packages/labnoteo-core/package.json
 *   - manifest.json                            (Obsidian plugin version)
 *   - versions.json                            ({version: minAppVersion})
 *   - README.md / README.ko.md                 (the version badge line)
 *
 * The root `package.json` is itself the plugin package, so it needs no copy.
 *
 * Run via `npm run sync:versions` (the auto-versioning workflow calls this after
 * bumping the root version). Idempotent: safe to run repeatedly.
 *
 * `--check` writes nothing and exits non-zero if anything is out of date. CI
 * runs it that way so a version bump that skipped this script fails the build
 * rather than shipping a README advertising the previous release.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function serializeJson(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

const rootPkgPath = join(root, 'package.json');
const version = readJson(rootPkgPath).version;
if (!version) {
  console.error('[sync:versions] root package.json has no version');
  process.exit(1);
}

const manifestPath = join(root, 'manifest.json');
const manifest = readJson(manifestPath);
const { minAppVersion } = manifest;

/**
 * Rewrite the `**Version x.y.z**` badge on its own line. Anchored to the line
 * start so a version number mentioned in prose is left alone; the label differs
 * per translation.
 */
function replaceReadmeBadge(content, label) {
  const pattern = new RegExp(`^\\*\\*${label} [^*]+\\*\\*$`, 'm');
  if (!pattern.test(content)) {
    console.error(`[sync:versions] no "**${label} x.y.z**" line found — badge format changed?`);
    process.exit(1);
  }
  return content.replace(pattern, `**${label} ${version}**`);
}

/** Every file to keep in step, as {path, next} where `next` is the desired content. */
const targets = [
  {
    path: join(root, 'packages/labnoteo-core/package.json'),
    next: serializeJson({ ...readJson(join(root, 'packages/labnoteo-core/package.json')), version }),
  },
  { path: manifestPath, next: serializeJson({ ...manifest, version }) },
  {
    path: join(root, 'versions.json'),
    next: (() => {
      let versions = {};
      try {
        versions = readJson(join(root, 'versions.json'));
      } catch {
        versions = {};
      }
      return serializeJson({ ...versions, [version]: minAppVersion });
    })(),
  },
  {
    path: join(root, 'README.md'),
    next: replaceReadmeBadge(readFileSync(join(root, 'README.md'), 'utf8'), 'Version'),
  },
  {
    path: join(root, 'README.ko.md'),
    next: replaceReadmeBadge(readFileSync(join(root, 'README.ko.md'), 'utf8'), '버전'),
  },
];

const stale = targets.filter(t => readFileSync(t.path, 'utf8') !== t.next);

if (checkOnly) {
  if (stale.length > 0) {
    console.error(`[sync:versions] out of sync with root package.json v${version}:`);
    for (const t of stale) console.error(`  - ${relative(root, t.path)}`);
    console.error('Run `npm run sync:versions` and commit the result.');
    process.exit(1);
  }
  console.log(`[sync:versions] all targets match v${version}`);
  process.exit(0);
}

for (const t of stale) writeFileSync(t.path, t.next);

console.log(
  `[sync:versions] synced all packages to v${version} (minAppVersion ${minAppVersion}), ` +
    `${stale.length} file(s) updated`
);
