/**
 * Shared, interactive sample create/edit/delete actions for the Obsidian
 * plugin. Used by both the editor autocomplete "create" flow
 * ([sampleSuggest.ts](./sampleSuggest.ts)) and the Samples sidebar context menu
 * ([views/sampleView.ts](./views/sampleView.ts)).
 *
 * Pure formatting/ID logic lives in `@labnoteo/core`; this module only wires
 * the modals, persists JSON via the vault fs, and surfaces notices.
 */
import { App, Notice } from 'obsidian';
import type { PickItem } from '@labnoteo/core';
import {
  generateSampleId,
  buildSampleIdPattern,
  buildSampleDefinitionText,
  buildSampleReferenceText,
  isCatalogSampleType,
} from '@labnoteo/core/lib/sampleUtils';
import {
  loadSamplesByType,
  loadReferenceSamplesByType,
  upsertSampleRecord,
  deleteSampleRecord,
  getLabsamplesFolder,
  findSampleDefinitionMatch,
  type SampleRecord,
} from '@labnoteo/core/lib/sampleStorage';
import type LabnotePlugin from './main';
import { promptModal, confirmModal, pickModal } from './modals';

export type SampleScope = 'local' | 'global';

/**
 * Resolve the vault-relative labsamples folder for a scope. Local is the active
 * note's `resources/labsamples`; when no note is active it falls back to the
 * vault-global folder (same rule the sidebar `refresh()` uses).
 */
export function resolveScopeFolder(plugin: LabnotePlugin, scope: SampleScope): string {
  if (scope === 'global') return plugin.settings.globalSampleFolder;
  const active = plugin.activeNotePath();
  return active ? getLabsamplesFolder(active) : plugin.settings.globalSampleFolder;
}

/** Trim to a non-empty string or null. */
function clean(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

export interface CreatedSample {
  id: string;
  alias: string | null;
  description: string | null;
  /** `@type;id;alias;desc` — optional, for the "insert definition" action. */
  definitionText: string;
  /** `id;alias` (or bare `id`) — the registry-first document insert form. */
  referenceText: string;
}

/**
 * Interactively create a sample (generate a new id or enter one manually),
 * persist it, and return the created record + its `@type;id;...` definition
 * text. Returns undefined only when the ID step is cancelled; alias/description
 * are optional (blank allowed).
 */
export async function createSampleInteractive(
  app: App,
  plugin: LabnotePlugin,
  opts: { type: string; folder: string; mode: 'generate' | 'manual' }
): Promise<CreatedSample | undefined> {
  const { type, folder, mode } = opts;

  let id: string;
  if (mode === 'generate') {
    id = generateSampleId(type);
  } else {
    const entered = await promptModal(app, {
      title: plugin.t('Enter the {0} sample ID', type),
      value: `${type}-`,
      placeholder: plugin.t('e.g. {0}-12345', type),
      validate: v =>
        buildSampleIdPattern(type).test(v.trim())
          ? null
          : plugin.t('Invalid ID. Expected {0}-<number>.', type),
    });
    if (entered === undefined) return undefined;
    id = entered.trim();
  }

  const aliasRaw = await promptModal(app, {
    title: plugin.t('Enter an alias for the new {0} sample', type),
    placeholder: plugin.t('e.g. Sample-A'),
  });
  const descRaw = await promptModal(app, {
    title: plugin.t('Enter a description (optional)'),
    placeholder: plugin.t('e.g. Sample used in experiment 1'),
  });
  const alias = clean(aliasRaw);
  const description = clean(descRaw);

  // `sources` is omitted so the record keeps whatever documents already
  // reference it; a tree-created sample legitimately starts with none.
  await upsertSampleRecord(plugin.fs, folder, type, id, { alias, description });
  plugin.refreshSampleViews();
  new Notice(plugin.t('Sample added: {0}', id));

  return {
    id,
    alias,
    description,
    definitionText: buildSampleDefinitionText(type, id, alias, description),
    referenceText: buildSampleReferenceText(id, alias),
  };
}

/**
 * Search the read-only product catalog (`{Type}_*.json`) for a catalog type
 * (Reagent/Labware/Equip) and return the chosen entry's reference text
 * (`id;alias`). Merges the document's local catalog with the vault-global one
 * (local wins). When no catalog exists, guides the user and falls back to
 * manually registering a sample (returning its reference).
 */
export async function pickCatalogReference(
  app: App,
  plugin: LabnotePlugin,
  opts: { type: string; docPath: string }
): Promise<string | undefined> {
  const { type, docPath } = opts;
  const localFolder = getLabsamplesFolder(docPath);
  const globalFolder = plugin.settings.globalSampleFolder;

  const local = await loadReferenceSamplesByType(plugin.fs, localFolder, type);
  const global = globalFolder
    ? await loadReferenceSamplesByType(plugin.fs, globalFolder, type)
    : {};
  const merged: Record<string, SampleRecord> = { ...global, ...local };

  const items: PickItem<string>[] = Object.entries(merged).map(([id, rec]) => ({
    label: rec.alias ? `${id} — ${rec.alias}` : id,
    value: id,
    description: rec.descriptions?.[0],
  }));

  if (items.length === 0) {
    new Notice(
      plugin.t('No {0} catalog found. Add resources/labsamples/{0}_*.json.', type)
    );
    // Fallback: register a custom sample manually, then reference it.
    const created = await createSampleInteractive(app, plugin, {
      type,
      folder: localFolder,
      mode: 'manual',
    });
    return created?.referenceText;
  }

  const chosen = await pickModal(app, items, {
    title: plugin.t('Search {0} catalog', type),
    placeholder: plugin.t('Search catalog'),
  });
  if (chosen === undefined) return undefined;
  return buildSampleReferenceText(chosen, merged[chosen]?.alias);
}

/**
 * Interactively edit a sample's alias/description (prefilled), persist to JSON,
 * and best-effort update the definition in the active note if present so the
 * document and JSON do not diverge. Returns false when cancelled.
 */
export async function editSampleInteractive(
  app: App,
  plugin: LabnotePlugin,
  opts: { folder: string; type: string; id: string; record: SampleRecord }
): Promise<boolean> {
  const { folder, type, id, record } = opts;

  const aliasRaw = await promptModal(app, {
    title: plugin.t('Enter a new alias'),
    value: record.alias ?? '',
    placeholder: plugin.t('e.g. Sample-A'),
  });
  if (aliasRaw === undefined) return false;
  const descRaw = await promptModal(app, {
    title: plugin.t('Enter a new description'),
    value: record.descriptions?.[0] ?? '',
    placeholder: plugin.t('e.g. Sample used in experiment 1'),
  });
  if (descRaw === undefined) return false;

  const alias = clean(aliasRaw);
  const description = clean(descRaw);
  await upsertSampleRecord(plugin.fs, folder, type, id, { alias, description });
  plugin.refreshSampleViews();

  // Best-effort: keep the active note's definition in sync (single file only).
  const target = plugin.host.editTarget();
  if (target) {
    const text = await target.getText();
    const match = findSampleDefinitionMatch(text, type, id, record.alias ?? null);
    if (match) {
      await target.replaceRange(
        match.start,
        match.start + match.length,
        buildSampleDefinitionText(type, id, alias, description)
      );
    }
  }

  new Notice(plugin.t('Sample updated: {0}', id));
  return true;
}

/** A sample definition located in a JSON registry (or read-only catalog). */
export interface ResolvedSampleDefinition {
  scope: 'local' | 'global' | 'catalog';
  folder: string;
  record: SampleRecord;
}

/**
 * Resolve a `(type, id)` reference to its definition record: local `{Type}.json`
 * first, then the vault-global one, then (for catalog types) the read-only
 * `{Type}_*.json` product catalog. Returns undefined when nothing matches.
 */
export async function resolveSampleDefinition(
  plugin: LabnotePlugin,
  opts: { type: string; id: string; docPath: string }
): Promise<ResolvedSampleDefinition | undefined> {
  const { type, id, docPath } = opts;
  const localFolder = getLabsamplesFolder(docPath);
  const globalFolder = plugin.settings.globalSampleFolder;

  const localDb = await loadSamplesByType(plugin.fs, localFolder, type);
  if (localDb[id]) return { scope: 'local', folder: localFolder, record: localDb[id] };

  if (globalFolder) {
    const globalDb = await loadSamplesByType(plugin.fs, globalFolder, type);
    if (globalDb[id]) return { scope: 'global', folder: globalFolder, record: globalDb[id] };
  }

  if (isCatalogSampleType(type)) {
    const localCat = await loadReferenceSamplesByType(plugin.fs, localFolder, type);
    if (localCat[id]) return { scope: 'catalog', folder: localFolder, record: localCat[id] };
    if (globalFolder) {
      const globalCat = await loadReferenceSamplesByType(plugin.fs, globalFolder, type);
      if (globalCat[id]) return { scope: 'catalog', folder: globalFolder, record: globalCat[id] };
    }
  }

  return undefined;
}

/** Confirm + delete a sample from its `{Type}.json`. Returns false when cancelled. */
export async function deleteSampleInteractive(
  app: App,
  plugin: LabnotePlugin,
  opts: { folder: string; type: string; id: string }
): Promise<boolean> {
  const { folder, type, id } = opts;
  const ok = await confirmModal(
    app,
    plugin.t('Are you sure you want to delete {0}?', id),
    plugin.t('Delete')
  );
  if (!ok) return false;

  await deleteSampleRecord(plugin.fs, folder, type, id);
  plugin.refreshSampleViews();
  new Notice(plugin.t('Sample deleted: {0}', id));
  return true;
}
