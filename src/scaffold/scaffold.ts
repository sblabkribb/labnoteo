/**
 * "연구노트 자동화 설정" command — provisions the embedded automation assets
 * into the current vault via {@link LabnoteFs}.
 *
 * Thin Obsidian wiring over the {@link SCAFFOLD_ASSETS} registry: for each asset
 * it appends missing lines (merge `append-missing`, e.g. `.gitignore`), upserts
 * the labnoteo marker block (merge `managed-block`, e.g. `AGENTS.md`), or
 * writes the file, asking `host.confirm` before overwriting an existing file.
 * After writing it points researchers to `QUICKSTART.md` and admins to
 * `SETUP.md` (with the one-time hook-enable step). The scaffold never runs Git
 * or touches anything outside the registry.
 */
import type { LabnoteHost } from '@labnoteo/core';
import {
  MANAGED_BLOCK_BEGIN,
  MANAGED_BLOCK_END,
  QUICKSTART_DOC_PATH,
  SCAFFOLD_ASSETS,
  SETUP_DOC_PATH,
  type ScaffoldAsset,
} from './assets';

/**
 * Merge `snippet` into `existing`, appending only the (trimmed) lines that are
 * not already present. Pure so the reconciliation is predictable and testable;
 * comparison is whitespace-insensitive per line and blank lines are ignored.
 * Returns `existing` unchanged when nothing is missing.
 */
export function appendMissingLines(existing: string, snippet: string): string {
  const have = new Set(
    existing
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
  );
  const missing = snippet.split(/\r?\n/).filter(line => {
    const trimmed = line.trim();
    return trimmed !== '' && !have.has(trimmed);
  });
  if (missing.length === 0) return existing;
  const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
  return `${existing}${separator}\n${missing.join('\n')}\n`;
}

/** Escape a literal string for use inside a RegExp (markers contain `(`,`)`,`-`). */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Insert or refresh the labnoteo-managed marker block inside `existing`.
 * Pure so the reconciliation is predictable and testable:
 *  - block present → replace only the marker span (everything else preserved);
 *  - block absent → append it at the end;
 *  - empty file → the block becomes the whole content.
 * Applying the same `inner` twice yields the same output (idempotent).
 */
export function upsertManagedBlock(
  existing: string,
  inner: string,
  markers: { begin: string; end: string } = { begin: MANAGED_BLOCK_BEGIN, end: MANAGED_BLOCK_END }
): string {
  const wrapped = `${markers.begin}\n${inner.trim()}\n${markers.end}`;
  const span = new RegExp(`${escapeRegExp(markers.begin)}[\\s\\S]*?${escapeRegExp(markers.end)}`);
  if (span.test(existing)) return existing.replace(span, wrapped);
  const separator = existing === '' ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${separator}${wrapped}\n`;
}

/** Outcome tallies for the completion notice. */
interface ScaffoldResult {
  written: number;
  merged: number;
  skipped: number;
}

/** Apply a single asset, returning which tally to bump. */
async function applyAsset(
  host: LabnoteHost,
  asset: ScaffoldAsset
): Promise<keyof ScaffoldResult | undefined> {
  const exists = await host.fs.exists(asset.vaultPath);

  if (asset.merge === 'managed-block') {
    const current = exists ? await host.fs.read(asset.vaultPath) : '';
    const updated = upsertManagedBlock(current, asset.content);
    if (updated === current) return undefined; // block already up to date
    await host.fs.write(asset.vaultPath, updated);
    return exists ? 'merged' : 'written';
  }

  if (asset.merge === 'append-missing' && exists) {
    const current = await host.fs.read(asset.vaultPath);
    const updated = appendMissingLines(current, asset.content);
    if (updated === current) return undefined; // already complete
    await host.fs.write(asset.vaultPath, updated);
    return 'merged';
  }

  if (exists) {
    const ok = await host.confirm(host.t('Overwrite {0}?', asset.vaultPath), {
      confirmLabel: host.t('Overwrite'),
    });
    if (!ok) return 'skipped';
  }

  await host.fs.write(asset.vaultPath, asset.content);
  return 'written';
}

/**
 * Iterate the scaffold registry and provision each asset into the vault.
 */
export async function setupResearchAutomationCommand(host: LabnoteHost): Promise<void> {
  const result: ScaffoldResult = { written: 0, merged: 0, skipped: 0 };

  for (const asset of SCAFFOLD_ASSETS) {
    const tally = await applyAsset(host, asset);
    if (tally) result[tally] += 1;
  }

  host.notify(
    'info',
    host.t(
      'Research automation set up ({0} written, {1} merged, {2} skipped). Researchers: see {3}. Admin setup: {4} (run `git config core.hooksPath .githooks`).',
      String(result.written),
      String(result.merged),
      String(result.skipped),
      QUICKSTART_DOC_PATH,
      SETUP_DOC_PATH
    )
  );
}
