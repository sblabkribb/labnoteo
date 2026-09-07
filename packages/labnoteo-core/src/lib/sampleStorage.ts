/**
 * Sample Storage - Functions for extracting and storing sample information
 * Supports formats: ID;alias;description, ID;alias, ID: description, ID
 * Legacy formats (|, :) are also recognized for backward compatibility
 */

import * as path from '../util/posixPath';
import type { LabnoteFs } from '../fs/labnoteFs';
import { SAMPLE_TYPES, SampleType } from './sampleUtils';
import { escapeRegExp } from './regexUtils';

/**
 * Extracted sample information from document text
 */
export interface SampleInfo {
  id: string;
  type: SampleType;
  alias: string | null;
  description: string | null;
}

/**
 * Stored sample record in JSON file
 */
export interface SampleRecord {
  type: string;
  alias: string | null;
  descriptions: string[];
  sources: string[];
}

/**
 * Database structure: { TYPE: { ID: SampleRecord } }
 */
export type SampleDatabase = Record<string, Record<string, SampleRecord>>;

/**
 * A sample `type` is used verbatim as a `{type}.json` filename, so it must stay
 * a single path segment. Reject anything that could escape the labsamples
 * folder (path separators, `.`/`..`, empty). Custom non-ASCII type names are
 * still allowed — this is a denylist of dangerous shapes, not an allowlist.
 *
 * Reproduced attack: `type = '../../../../.obsidian/plugins/evil/main'` would
 * otherwise write outside the vault-relative labsamples folder.
 */
function assertSafeSampleType(type: string): void {
  if (!type || /[\\/]/.test(type) || type === '.' || type === '..') {
    throw new Error(`Invalid sample type (path traversal blocked): ${JSON.stringify(type)}`);
  }
}

/**
 * Coerce an untrusted on-disk record into a well-formed {@link SampleRecord},
 * tolerating older/partial shapes: a missing/`null` value, missing
 * `sources`/`descriptions`, or wrong element types. This is the SINGLE guard
 * that prevents `record.sources.length`-style TypeErrors on legacy `{Type}.json`
 * data (previously each loader open-coded its own `?? []` defaults, and some
 * paths had none). `fallbackType` is used only when the record omits `type`.
 */
function normalizeSampleRecord(rec: unknown, fallbackType: string): SampleRecord {
  const r = (rec && typeof rec === 'object' ? rec : {}) as Partial<SampleRecord>;
  return {
    type: typeof r.type === 'string' && r.type ? r.type : fallbackType,
    alias: typeof r.alias === 'string' ? r.alias : null,
    descriptions: Array.isArray(r.descriptions)
      ? r.descriptions.filter((d): d is string => typeof d === 'string')
      : [],
    sources: Array.isArray(r.sources)
      ? r.sources.filter((s): s is string => typeof s === 'string')
      : [],
  };
}

/**
 * Collapse `{Type}.json` keys that differ only in case into a single canonical
 * record (unioning `descriptions`/`sources`, keeping the first non-empty
 * `alias`). Returns `changed = true` when a collision was merged so the caller
 * can rewrite the file and converge historical data (Phase 1-3b migration).
 * Every record is passed through {@link normalizeSampleRecord} first.
 */
function mergeCaseCollidingIds(
  raw: Record<string, SampleRecord>
): { records: Record<string, SampleRecord>; changed: boolean } {
  const out: Record<string, SampleRecord> = {};
  const canonicalByLower = new Map<string, string>();
  let changed = false;

  for (const [id, rawRec] of Object.entries(raw)) {
    const rec = normalizeSampleRecord(rawRec, '');
    const lower = id.toLowerCase();
    const canonical = canonicalByLower.get(lower);
    if (canonical === undefined) {
      canonicalByLower.set(lower, id);
      out[id] = rec;
      continue;
    }

    changed = true;
    const target = out[canonical];
    for (const d of rec.descriptions) {
      if (!target.descriptions.includes(d)) target.descriptions.push(d);
    }
    for (const s of rec.sources) {
      if (!target.sources.includes(s)) target.sources.push(s);
    }
    if (!target.alias && rec.alias) target.alias = rec.alias;
  }

  return { records: out, changed };
}

/**
 * Parse the raw text of a `{Type}.json` into records, tolerating an empty/absent
 * file (`''` → `{}`) and malformed JSON (warns, returns `{}`), then applies the
 * Phase 1-3b case-collision merge so callers inside an atomic `fs.modify`
 * callback see the same normalized shape `loadSamplesByType` returns. Kept
 * synchronous so it can run inside `vault.process`'s sync callback.
 */
function parseSampleRecords(raw: string): Record<string, SampleRecord> {
  if (!raw || !raw.trim()) return {};
  let parsed: Record<string, SampleRecord>;
  try {
    parsed = JSON.parse(raw) as Record<string, SampleRecord>;
  } catch (error) {
    console.warn('[labnoteo] Failed to parse sample JSON during modify:', error);
    return {};
  }
  return mergeCaseCollidingIds(parsed).records;
}

/**
 * Build the sample-definition matcher for one `type`. Capture groups:
 *   [1] id (e.g. `DNA-12`; collision-resolved ids like `DNA-…-3` included)
 *   [2] alias (when `;`/`|` delimited)     [3] description (after the alias)
 *   [4] legacy `: description` form
 *
 * Shared by {@link extractSampleInfoFromText} and {@link findSampleDefinitionMatch}
 * so the two never drift. `type` is regex-escaped (custom types may in theory
 * contain metacharacters). The `gi` flags match the callers' stateful `exec`
 * loops, so each caller builds its own instance (never share `lastIndex`).
 */
function buildSampleDefinitionPattern(type: string): RegExp {
  const typeEsc = escapeRegExp(type);
  return new RegExp(
    `(?:@${typeEsc}[;:])?(${typeEsc}-\\d+(?:-\\d+)*)(?:[;|]([^;:\\n|]+)(?:[;:]([^\\n;|]+))?|:\\s*([^\\n;|]+))?`,
    'gi'
  );
}

/**
 * Extract sample information from document text
 * Supports formats (new ; delimiter + legacy |/: for backward compatibility):
 * - @type;ID;alias;description (definition format)
 * - @type;ID;alias (definition with alias only)
 * - @type;ID (definition with ID only)
 * - ID;alias;description (full format)
 * - ID;alias (alias only)
 * - ID: description (legacy format)
 * - ID (ID only)
 */
export function extractSampleInfoFromText(text: string, additionalTypes?: string[]): SampleInfo[] {
  // Collected in appearance order. `seenByLower` maps the case-normalized id to
  // its slot so `DNA-55` and `dna-55` collapse to one sample (the match regex is
  // case-insensitive but a case-sensitive Set would split them into two JSON
  // keys). Each slot tracks whether it came from a *definition* (an `@type;`
  // prefix or an explicit alias/description) so a real definition appearing
  // after a bare reference upgrades that slot instead of being dropped.
  const collected: Array<{ info: SampleInfo; index: number; isDef: boolean }> = [];
  const seenByLower = new Map<string, number>();

  const allTypes: string[] = [...SAMPLE_TYPES, ...(additionalTypes ?? []).filter(t => !(SAMPLE_TYPES as readonly string[]).includes(t))];
  for (const type of allTypes) {
    // Match sample ids with optional @type; prefix, alias and description.
    // ID segment uses (?:-\d+)* (same as buildSampleIdPattern) so collision-resolved
    // ids like DNA-1737000000000-3 are extracted. See buildSampleDefinitionPattern.
    const pattern = buildSampleDefinitionPattern(type);

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const id = match[1];

      let alias: string | null = null;
      let description: string | null = null;

      if (match[2]) {
        // Format: ID|alias or ID|alias:description
        alias = match[2].trim();
        if (match[3]) {
          description = match[3].trim();
        }
      } else if (match[4]) {
        // Legacy format: ID: description
        description = match[4].trim();
      }

      // A definition carries authoritative alias/description: it either uses the
      // `@type;` prefix (match[0] starts with '@') or supplies an alias/legacy
      // description. Bare references (`DNA-2`) do not.
      const isDef = match[0].startsWith('@') || match[2] != null || match[4] != null;
      const info: SampleInfo = { id, type: type as SampleType, alias, description };
      const key = id.toLowerCase();
      const slot = seenByLower.get(key);

      if (slot === undefined) {
        seenByLower.set(key, collected.length);
        collected.push({ info, index: match.index, isDef });
      } else if (isDef && !collected[slot].isDef) {
        // Upgrade an earlier bare reference to the definition (its casing is the
        // canonical JSON key), but keep the earliest position for ordering.
        collected[slot] = {
          info,
          index: Math.min(collected[slot].index, match.index),
          isDef: true,
        };
      }
    }
  }

  // Sort by first appearance in text (captured match index, not indexOf).
  collected.sort((a, b) => a.index - b.index);

  return collected.map(c => c.info);
}

/**
 * Build a sample database from extracted samples
 * Groups samples by type and stores with source file info
 */
export function buildSampleDatabase(
  samples: SampleInfo[],
  sourceFile: string
): SampleDatabase {
  const db: SampleDatabase = {};

  for (const sample of samples) {
    const { type, id, alias, description } = sample;

    if (!db[type]) {
      db[type] = {};
    }

    db[type][id] = {
      type,
      alias,
      descriptions: description ? [description] : [],
      sources: [sourceFile],
    };
  }

  return db;
}

/**
 * Merge two sample databases
 * New data overwrites alias, but descriptions and sources are combined
 */
export function mergeSampleDatabases(
  existing: SampleDatabase,
  newData: SampleDatabase
): SampleDatabase {
  const merged: SampleDatabase = JSON.parse(JSON.stringify(existing));

  for (const [type, samples] of Object.entries(newData)) {
    if (!merged[type]) {
      merged[type] = {};
    }

    for (const [id, record] of Object.entries(samples)) {
      if (merged[type][id]) {
        // Merge existing record
        const existingRecord = merged[type][id];
        
        // New alias overwrites (if provided)
        if (record.alias) {
          existingRecord.alias = record.alias;
        }

        // Put current document's descriptions first so sidebar shows latest (descriptions[0])
        const fromNew = record.descriptions || [];
        const fromExisting = (existingRecord.descriptions || []).filter(
          (d) => !fromNew.includes(d)
        );
        existingRecord.descriptions = [...fromNew, ...fromExisting];

        // Combine sources (unique)
        for (const source of record.sources) {
          if (!existingRecord.sources.includes(source)) {
            existingRecord.sources.push(source);
          }
        }
      } else {
        // Add new record
        merged[type][id] = { ...record };
      }
    }
  }

  return merged;
}

/**
 * Find the range of a sample definition in document text for replacement.
 * Returns { start, length } of the first matching definition, or null.
 * - General types: matches @type:ID with optional |alias:description (same pattern as extractSampleInfoFromText).
 * - Equip: if no match by id, tries @equip:|currentAlias with optional :description (definition without ID in text).
 */
export function findSampleDefinitionMatch(
  text: string,
  type: string,
  id: string,
  currentAlias?: string | null
): { start: number; length: number } | null {
  // 1) Match by @type;ID or @type:ID (supports ; and legacy |/: delimiters).
  //    Shared with extraction via buildSampleDefinitionPattern.
  const idPattern = buildSampleDefinitionPattern(type);
  let match = idPattern.exec(text);
  while (match) {
    if (match[1] === id) {
      return { start: match.index, length: match[0].length };
    }
    match = idPattern.exec(text);
  }

  // 2) Equip: match by @equip;|currentAlias when definition has no ID in text
  if ((type.toLowerCase() === 'equip') && currentAlias && currentAlias.trim()) {
    const aliasEsc = escapeRegExp(currentAlias);
    const equipAliasPattern = new RegExp(
      `@equip[;:][;|]${aliasEsc}(?:[;:]([^\\n;|]*))?`,
      'gi'
    );
    const equipMatch = equipAliasPattern.exec(text);
    if (equipMatch) {
      return { start: equipMatch.index, length: equipMatch[0].length };
    }
  }

  return null;
}

/**
 * Get the resources/labsamples folder path for a document.
 *
 * Pure path computation — no side effects. The folder is created lazily by the
 * `LabnoteFs` adapter's `write` (which makes parent directories on demand) when
 * a sample JSON is actually saved, so read-only callers (completion, product
 * picker) never touch disk just to derive this path.
 */
export function getLabsamplesFolder(documentPath: string): string {
  const documentDir = path.dirname(documentPath);
  return path.join(documentDir, 'resources', 'labsamples');
}

/**
 * Load sample database from JSON files for a specific type
 */
export async function loadSamplesByType(
  fs: LabnoteFs,
  labsamplesFolder: string,
  type: string
): Promise<Record<string, SampleRecord>> {
  assertSafeSampleType(type);
  const filePath = path.join(labsamplesFolder, `${type}.json`);

  if (!(await fs.exists(filePath))) {
    return {};
  }

  let raw: Record<string, SampleRecord>;
  try {
    raw = JSON.parse(await fs.read(filePath)) as Record<string, SampleRecord>;
  } catch (error) {
    console.warn(`[labnoteo] Failed to load ${filePath}:`, error);
    return {};
  }

  // Phase 1-3b: one-time in-memory migration for vaults written before the
  // case-normalized de-dup fix. If keys collided only by case, converge them
  // and write the merged result straight back so the file self-heals.
  const { records, changed } = mergeCaseCollidingIds(raw);
  if (changed) {
    try {
      await saveSamplesByType(fs, labsamplesFolder, type, records);
    } catch (error) {
      console.warn(`[labnoteo] Failed to rewrite migrated ${filePath}:`, error);
    }
  }
  return records;
}

/**
 * Load reference DB: all JSON files matching {type}_{suffix}.json in labsamples folder.
 * Used for Reagent/Labware product catalog (read-only). Same record format as loadSamplesByType.
 */
export async function loadReferenceSamplesByType(
  fs: LabnoteFs,
  labsamplesFolder: string,
  type: string
): Promise<Record<string, SampleRecord>> {
  const merged: Record<string, SampleRecord> = {};
  if (!(await fs.exists(labsamplesFolder))) {
    return merged;
  }
  const prefix = `${type}_`;
  const suffix = '.json';
  let names: string[];
  try {
    names = await fs.list(labsamplesFolder);
  } catch (err) {
    console.warn(`[labnoteo] Failed to readdir ${labsamplesFolder}:`, err);
    return merged;
  }
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
      continue;
    }
    const filePath = path.join(labsamplesFolder, name);
    try {
      const content = await fs.read(filePath);
      const data = JSON.parse(content) as Record<string, unknown>;
      for (const [id, record] of Object.entries(data)) {
        if (record && typeof record === 'object' && !merged[id]) {
          merged[id] = normalizeSampleRecord(record, type);
        }
      }
    } catch (err) {
      console.warn(`[labnoteo] Failed to load reference ${filePath}:`, err);
    }
  }
  return merged;
}

/**
 * Save sample database to JSON file for a specific type
 */
export async function saveSamplesByType(
  fs: LabnoteFs,
  labsamplesFolder: string,
  type: string,
  samples: Record<string, SampleRecord>
): Promise<void> {
  assertSafeSampleType(type);
  const filePath = path.join(labsamplesFolder, `${type}.json`);
  // The adapter creates parent directories on demand and owns atomicity.
  await fs.write(filePath, JSON.stringify(samples, null, 2));
}

/**
 * Atomically create-or-update a single sample record in `{Type}.json`.
 *
 * This is the shared "merge one record" primitive behind the sidebar's
 * create/edit actions and the MCP `create_sample` tool, which previously each
 * hand-rolled a `load → mutate → save` round-trip that a concurrent 800ms
 * sample-sync could clobber. Running the read-modify-write inside `fs.modify`
 * closes that lost-update window per `{Type}.json`.
 *
 * `sources` semantics:
 *  - omit `sources` to preserve whatever the existing record had (sidebar edit),
 *  - pass an explicit array to set them (tool create binds the note as source).
 * `alias`/`descriptions` are overwritten from the given fields.
 */
export async function upsertSampleRecord(
  fs: LabnoteFs,
  labsamplesFolder: string,
  type: string,
  id: string,
  fields: { alias: string | null; description: string | null; sources?: string[] }
): Promise<void> {
  assertSafeSampleType(type);
  const filePath = path.join(labsamplesFolder, `${type}.json`);
  await fs.modify(filePath, (raw) => {
    const records = parseSampleRecords(raw);
    records[id] = {
      type,
      alias: fields.alias,
      descriptions: fields.description ? [fields.description] : [],
      sources: fields.sources ?? records[id]?.sources ?? [],
    };
    return JSON.stringify(records, null, 2);
  });
}

/**
 * Atomically delete one sample record from `{Type}.json`.
 *
 * Counterpart to {@link upsertSampleRecord} for the sidebar's delete action,
 * which previously hand-rolled a `load → delete → save` round-trip that a
 * concurrent sample-sync could resurrect. Returns whether a record was actually
 * removed; a missing file or id is not an error, since the caller's intent
 * (the record is gone) already holds.
 */
export async function deleteSampleRecord(
  fs: LabnoteFs,
  labsamplesFolder: string,
  type: string,
  id: string
): Promise<boolean> {
  assertSafeSampleType(type);
  const filePath = path.join(labsamplesFolder, `${type}.json`);
  if (!(await fs.exists(filePath))) return false;

  let removed = false;
  await fs.modify(filePath, (raw) => {
    const records = parseSampleRecords(raw);
    if (!(id in records)) return raw;
    delete records[id];
    removed = true;
    return JSON.stringify(records, null, 2);
  });
  return removed;
}

/**
 * Atomically store one sample record **verbatim** into `{Type}.json`.
 *
 * Unlike {@link upsertSampleRecord} (which rebuilds the record from scalar
 * alias/description fields and so collapses `descriptions` to a single entry),
 * this writes the given {@link SampleRecord} as-is, preserving multiple
 * `descriptions` and all `sources`. It is the "write" half of a scope move
 * (Local <-> Global): the caller loads the source record, `putSampleRecord`s it
 * into the target, then `deleteSampleRecord`s it from the source. The
 * read-modify-write runs inside `fs.modify` so a concurrent sample-sync cannot
 * clobber sibling ids in the same file.
 */
export async function putSampleRecord(
  fs: LabnoteFs,
  labsamplesFolder: string,
  type: string,
  id: string,
  record: SampleRecord
): Promise<void> {
  assertSafeSampleType(type);
  const filePath = path.join(labsamplesFolder, `${type}.json`);
  await fs.modify(filePath, (raw) => {
    const records = parseSampleRecords(raw);
    records[id] = record;
    return JSON.stringify(records, null, 2);
  });
}

/**
 * Save samples extracted from a document to JSON files
 * Merges with existing data. Samples that exist in Global are not re-added to Local
 * (so after Move to Global, saving the document does not re-add the sample to Local).
 */
export async function saveSamplesFromDocument(
  fs: LabnoteFs,
  documentPath: string,
  documentText: string,
  globalLabsamplesFolder?: string,
  additionalTypes?: string[]
): Promise<void> {
  const labsamplesFolder = getLabsamplesFolder(documentPath);
  const sourceFile = path.basename(documentPath);

  // Extract samples from document
  const samples = extractSampleInfoFromText(documentText, additionalTypes);

  if (samples.length === 0) {
    return;
  }

  // Build new database from extracted samples
  const newDb = buildSampleDatabase(samples, sourceFile);

  const globalFolderResolved = globalLabsamplesFolder
    ? path.normalizeForCompare(globalLabsamplesFolder).toLowerCase()
    : '';
  const localFolderResolved = path.normalizeForCompare(labsamplesFolder).toLowerCase();
  const skipGlobalDedupe =
    Boolean(globalLabsamplesFolder) && globalFolderResolved === localFolderResolved;

  for (const type of Object.keys(newDb)) {
    assertSafeSampleType(type);

    // Do not keep in Local samples that exist in Global (avoid re-adding after Move to Global).
    // When workspace root is the experiment folder, local and global paths are the same — skip
    // or we would load the same JSON as "global" and delete every merged id.
    //
    // This global read is hoisted OUT of the atomic callback below: `fs.modify`'s
    // updater must be synchronous, so the cross-file lookup is awaited first and
    // its ids captured into a Set the pure callback can consult.
    let globalIds: Set<string> | null = null;
    if (globalLabsamplesFolder && !skipGlobalDedupe) {
      const globalSamples = await loadSamplesByType(fs, globalLabsamplesFolder, type);
      globalIds = new Set(Object.keys(globalSamples));
    }

    const filePath = path.join(labsamplesFolder, `${type}.json`);
    await fs.modify(filePath, (raw) => {
      const existing = parseSampleRecords(raw);
      const merged = mergeSampleDatabases({ [type]: existing }, { [type]: newDb[type] });
      if (globalIds) {
        for (const id of globalIds) {
          if (merged[type][id]) {
            delete merged[type][id];
          }
        }
      }
      return JSON.stringify(merged[type], null, 2);
    });
  }
}

/**
 * Identifies a record that was auto-removed from the sample tree by
 * `removeSourcesForDocument`. Returned to the caller so it can surface a
 * notification (e.g. "Removed from sample tree: DNA-001, RNA-002").
 */
export interface RemovedSampleRef {
  scope: 'local' | 'global';
  type: string;
  id: string;
}

/**
 * Reconcile a document's `@type;id;...` definitions against the on-disk
 * sample JSONs. For every record whose `sources` includes this document's
 * basename:
 *  - drop the basename if the document no longer defines (type, id),
 *  - if `sources` becomes empty as a result (and was non-empty before),
 *    delete the record entirely.
 *
 * Records that started with empty `sources` (e.g. user-created via the
 * tree's Add Sample command before they have been written into any
 * document) are NEVER touched here. That is what stops a freshly added
 * sample from disappearing as soon as the user saves an unrelated file.
 *
 * Both the document's local labsamples folder and the optional global
 * folder are processed; if both paths resolve to the same directory
 * (e.g. workspaceRoot is the experiment folder, mirroring
 * `saveSamplesFromDocument`'s `skipGlobalDedupe` guard) the global pass
 * is skipped so removed entries are not reported twice.
 *
 * Returns the records that were removed so the caller can surface a toast.
 */
export async function removeSourcesForDocument(
  fs: LabnoteFs,
  documentPath: string,
  documentText: string,
  globalLabsamplesFolder?: string,
  additionalTypes?: string[]
): Promise<RemovedSampleRef[]> {
  const localFolder = getLabsamplesFolder(documentPath);
  const documentBasename = path.basename(documentPath);

  // Set of "type|id" pairs still defined in the document. Anything *not*
  // in this set is a candidate for source removal in scopes whose existing
  // record has this document listed as a source.
  const liveDefs = new Set<string>();
  for (const sample of extractSampleInfoFromText(documentText, additionalTypes)) {
    liveDefs.add(`${sample.type}|${sample.id}`);
  }

  const allTypes: string[] = [
    ...SAMPLE_TYPES,
    ...(additionalTypes ?? []).filter(
      (t) => !(SAMPLE_TYPES as readonly string[]).includes(t)
    ),
  ];

  // Mirror saveSamplesFromDocument's skipGlobalDedupe logic so we don't
  // process the same folder twice and double-report removals.
  const localResolved = path.normalizeForCompare(localFolder).toLowerCase();
  const globalResolved = globalLabsamplesFolder
    ? path.normalizeForCompare(globalLabsamplesFolder).toLowerCase()
    : '';
  const scopes: Array<{ scope: 'local' | 'global'; folder: string }> = [
    { scope: 'local', folder: localFolder },
  ];
  if (globalLabsamplesFolder && globalResolved !== localResolved) {
    scopes.push({ scope: 'global', folder: globalLabsamplesFolder });
  }

  const removed: RemovedSampleRef[] = [];

  for (const { scope, folder } of scopes) {
    if (!(await fs.exists(folder))) continue;

    for (const type of allTypes) {
      assertSafeSampleType(type);
      const filePath = path.join(folder, `${type}.json`);
      // Skip types with no on-disk file so we never create an empty `{Type}.json`
      // just to scan it.
      if (!(await fs.exists(filePath))) continue;

      // Atomic read-modify-write per file: the whole scan-and-prune runs inside
      // the `fs.modify` callback so a concurrent sample-sync can't clobber it.
      await fs.modify(filePath, (raw) => {
        const samples = parseSampleRecords(raw);
        let mutated = false;

        for (const id of Object.keys(samples)) {
          const record = samples[id];
          // Guard: tree-created records (sources === []) are off-limits to
          // automatic cleanup. They only exist in the tree until a markdown
          // file defines them, and silently deleting them on save would
          // erase data the user explicitly entered through the UI.
          if (record.sources.length === 0) continue;
          if (!record.sources.includes(documentBasename)) continue;
          if (liveDefs.has(`${type}|${id}`)) continue;

          record.sources = record.sources.filter((s) => s !== documentBasename);
          mutated = true;

          if (record.sources.length === 0) {
            delete samples[id];
            removed.push({ scope, type, id });
          }
        }

        // Nothing changed → return the original bytes so we don't needlessly
        // rewrite/reformat a file we didn't touch.
        return mutated ? JSON.stringify(samples, null, 2) : raw;
      });
    }
  }

  return removed;
}

/**
 * Get the Global labsamples folder path (workspace root)
 */
export function getGlobalLabsamplesFolder(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'resources', 'labsamples');
}
