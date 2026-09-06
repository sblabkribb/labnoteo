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
  const samples: SampleInfo[] = [];
  const foundIds = new Set<string>();

  const allTypes: string[] = [...SAMPLE_TYPES, ...(additionalTypes ?? []).filter(t => !(SAMPLE_TYPES as readonly string[]).includes(t))];
  for (const type of allTypes) {
    // Pattern to match sample ID with optional @type; prefix, alias and description.
    // ID segment uses (?:-\d+)* (same as buildSampleIdPattern) so collision-resolved
    // ids like DNA-1737000000000-3 are extracted. The type is escaped because custom
    // types may contain regex metachars in theory (defense-in-depth).
    const typeEsc = escapeRegExp(type);
    const pattern = new RegExp(
      `(?:@${typeEsc}[;:])?(${typeEsc}-\\d+(?:-\\d+)*)(?:[;|]([^;:\\n|]+)(?:[;:]([^\\n;|]+))?|:\\s*([^\\n;|]+))?`,
      'gi'
    );

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const id = match[1];
      
      // Skip if already found (avoid duplicates)
      if (foundIds.has(id)) continue;
      foundIds.add(id);

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

      samples.push({
        id,
        type: type as SampleType,
        alias,
        description,
      });
    }
  }

  // Sort by order of appearance in text
  samples.sort((a, b) => text.indexOf(a.id) - text.indexOf(b.id));

  return samples;
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
 * Strict variant of {@link findSampleDefinitionMatch} that only matches an
 * `@type;ID...` / `@type:ID...` definition (or, for Equip, an `@equip;;Alias`
 * alias-only definition). Bare ID references like `DNA-123` are NOT matched.
 *
 * Used by Move to Definition flows where landing on the first body reference
 * instead of the actual definition would be incorrect.
 */
export function findSampleDefinitionOnlyMatch(
  text: string,
  type: string,
  id: string,
  currentAlias?: string | null
): { start: number; length: number } | null {
  const typeEsc = escapeRegExp(type);

  if (id && id.trim()) {
    const defPattern = new RegExp(
      `@${typeEsc}[;:](${typeEsc}-\\d+(?:-\\d+)*)(?:[;|]([^;:\\n|]+)(?:[;:]([^\\n;|]+))?|:\\s*([^\\n;|]+))?`,
      'gi'
    );
    let match = defPattern.exec(text);
    while (match) {
      if (match[1] === id) {
        return { start: match.index, length: match[0].length };
      }
      match = defPattern.exec(text);
    }
  }

  if (type.toLowerCase() === 'equip' && currentAlias && currentAlias.trim()) {
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
  const typeEsc = escapeRegExp(type);

  // 1) Match by @type;ID or @type:ID (supports ; and legacy |/: delimiters).
  //    ID segment uses (?:-\d+)* for parity with buildSampleIdPattern.
  const idPattern = new RegExp(
    `(?:@${typeEsc}[;:])?(${typeEsc}-\\d+(?:-\\d+)*)(?:[;|]([^;:\\n|]+)(?:[;:]([^\\n;|]+))?|:\\s*([^\\n;|]+))?`,
    'gi'
  );
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
  const filePath = path.join(labsamplesFolder, `${type}.json`);

  if (!(await fs.exists(filePath))) {
    return {};
  }

  try {
    const content = await fs.read(filePath);
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[labnoteo] Failed to load ${filePath}:`, error);
    return {};
  }
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
      const data = JSON.parse(content) as Record<string, SampleRecord>;
      for (const [id, record] of Object.entries(data)) {
        if (record && typeof record === 'object' && !merged[id]) {
          merged[id] = {
            type: record.type ?? type,
            alias: record.alias ?? null,
            descriptions: record.descriptions ?? [],
            sources: record.sources ?? [],
          };
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
  const filePath = path.join(labsamplesFolder, `${type}.json`);
  // The adapter creates parent directories on demand and owns atomicity.
  await fs.write(filePath, JSON.stringify(samples, null, 2));
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
    const existing = await loadSamplesByType(fs, labsamplesFolder, type);
    const merged = mergeSampleDatabases({ [type]: existing }, { [type]: newDb[type] });

    // Do not keep in Local samples that exist in Global (avoid re-adding after Move to Global).
    // When workspace root is the experiment folder, local and global paths are the same — skip
    // or we would load the same JSON as "global" and delete every merged id.
    if (globalLabsamplesFolder && !skipGlobalDedupe) {
      const globalSamples = await loadSamplesByType(fs, globalLabsamplesFolder, type);
      for (const id of Object.keys(globalSamples)) {
        if (merged[type][id]) {
          delete merged[type][id];
        }
      }
    }

    await saveSamplesByType(fs, labsamplesFolder, type, merged[type]);
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
      const samples = await loadSamplesByType(fs, folder, type);
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

      if (mutated) {
        await saveSamplesByType(fs, folder, type, samples);
      }
    }
  }

  return removed;
}

/**
 * Parse YAML front matter and check if Sample Tracking is enabled
 * Supports key formats: "Sample Tracking", "sampleTracking", "sample-tracking"
 * Supports values: Yes/No, true/false, on/off, 1/0 (case-insensitive)
 */
export function parseSampleTracking(text: string): boolean {
  // Extract YAML front matter (between --- markers)
  const yamlMatch = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!yamlMatch) {
    return false;
  }

  const yamlContent = yamlMatch[1];

  // Match different key formats: "Sample Tracking", "sampleTracking", "sample-tracking"
  // Pattern is case-insensitive for the value
  const patterns = [
    /^Sample\s+Tracking\s*:\s*(.+)$/im,
    /^sampleTracking\s*:\s*(.+)$/im,
    /^sample-tracking\s*:\s*(.+)$/im,
  ];

  for (const pattern of patterns) {
    const match = yamlContent.match(pattern);
    if (match) {
      const value = match[1].trim().toLowerCase();
      // Check for truthy values
      return ['yes', 'true', 'on', '1'].includes(value);
    }
  }

  return false;
}

/**
 * Get the Global labsamples folder path (workspace root)
 */
export function getGlobalLabsamplesFolder(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'resources', 'labsamples');
}

/**
 * Sample location type
 */
export type SampleLocationResult = 'local' | 'global' | 'both' | 'none';

/**
 * Check where a sample is located (local, global, both, or none)
 */
export function getSampleLocation(
  sampleId: string,
  type: string,
  localDb: SampleDatabase,
  globalDb: SampleDatabase
): SampleLocationResult {
  const inLocal = localDb[type]?.[sampleId] !== undefined;
  const inGlobal = globalDb[type]?.[sampleId] !== undefined;

  if (inLocal && inGlobal) {
    return 'both';
  } else if (inLocal) {
    return 'local';
  } else if (inGlobal) {
    return 'global';
  } else {
    return 'none';
  }
}

/**
 * Move a sample from local to global database
 * Returns new copies of both databases
 */
export function moveSampleToGlobal(
  sampleId: string,
  type: string,
  localDb: SampleDatabase,
  globalDb: SampleDatabase
): { newLocalDb: SampleDatabase; newGlobalDb: SampleDatabase } {
  const newLocalDb: SampleDatabase = JSON.parse(JSON.stringify(localDb));
  const newGlobalDb: SampleDatabase = JSON.parse(JSON.stringify(globalDb));

  // Ensure type exists in both databases
  if (!newGlobalDb[type]) {
    newGlobalDb[type] = {};
  }

  // Move sample data
  if (newLocalDb[type]?.[sampleId]) {
    newGlobalDb[type][sampleId] = newLocalDb[type][sampleId];
    delete newLocalDb[type][sampleId];
  }

  return { newLocalDb, newGlobalDb };
}

/**
 * Move a sample from global to local database
 * Returns new copies of both databases
 */
export function moveSampleToLocal(
  sampleId: string,
  type: string,
  localDb: SampleDatabase,
  globalDb: SampleDatabase
): { newLocalDb: SampleDatabase; newGlobalDb: SampleDatabase } {
  const newLocalDb: SampleDatabase = JSON.parse(JSON.stringify(localDb));
  const newGlobalDb: SampleDatabase = JSON.parse(JSON.stringify(globalDb));

  // Ensure type exists in both databases
  if (!newLocalDb[type]) {
    newLocalDb[type] = {};
  }

  // Move sample data
  if (newGlobalDb[type]?.[sampleId]) {
    newLocalDb[type][sampleId] = newGlobalDb[type][sampleId];
    delete newGlobalDb[type][sampleId];
  }

  return { newLocalDb, newGlobalDb };
}
