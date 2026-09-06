#!/usr/bin/env node
/**
 * Single source of truth for the release version.
 *
 * Reads the version from the root `package.json` and propagates it to every
 * place that must agree for a release to be valid:
 *
 *   - packages/labnoteo-core/package.json
 *   - packages/labnoteo/package.json
 *   - packages/labnoteo/manifest.json          (Obsidian plugin version)
 *   - packages/labnoteo/versions.json          ({version: minAppVersion})
 *
 * Run via `npm run sync:versions` (the auto-versioning workflow calls this after
 * bumping the root version). Idempotent: safe to run repeatedly.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

const rootPkgPath = join(root, 'package.json');
const version = readJson(rootPkgPath).version;
if (!version) {
  console.error('[sync:versions] root package.json has no version');
  process.exit(1);
}

const targets = [
  join(root, 'packages/labnoteo-core/package.json'),
  join(root, 'packages/labnoteo/package.json'),
];
for (const path of targets) {
  const pkg = readJson(path);
  pkg.version = version;
  writeJson(path, pkg);
}

// Obsidian manifest.
const manifestPath = join(root, 'packages/labnoteo/manifest.json');
const manifest = readJson(manifestPath);
manifest.version = version;
writeJson(manifestPath, manifest);

// Obsidian versions.json ({ pluginVersion: minAppVersion }).
const versionsPath = join(root, 'packages/labnoteo/versions.json');
let versions = {};
try {
  versions = readJson(versionsPath);
} catch {
  versions = {};
}
versions[version] = manifest.minAppVersion;
writeJson(versionsPath, versions);

console.log(`[sync:versions] synced all packages to v${version} (minAppVersion ${manifest.minAppVersion})`);
