/**
 * Workflow Structure - Functions for creating workflow files and managing workflow checklist
 */

import * as path from '../util/posixPath';
import { getSeoulDateString } from './dateUtils';
import { sanitizePathSegment } from './regexUtils';
import { parseFrontMatterYaml, serializeFrontMatterEntry } from '../sections/frontMatter';

/**
 * Workflow information for creating workflow files
 */
export interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Workflow checklist item parsed from README
 */
export interface WorkflowChecklistItem {
  fileName: string;
  title: string;
  done: boolean;
}

/**
 * Check if a file path is a valid workflow file in a labnote subfolder
 * Path should be: {workspace}/labnote/{###_ExperimentName}/{###_WX###_Name}.md
 */
export function isValidWorkflowPath(filePath: string): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');
  const baseName = path.basename(normalizedPath).toLowerCase();
  
  if (!normalizedPath.toLowerCase().endsWith('.labnote.md') || baseName === 'readme.labnote.md') {
    return false;
  }
  
  // Check if filename starts with 3-digit prefix
  const fileName = path.basename(normalizedPath);
  if (!/^\d{3}_/.test(fileName)) {
    return false;
  }
  
  try {
    const dirPath = path.dirname(normalizedPath);
    const experimentDirName = path.basename(dirPath);
    const labnoteDirPath = path.dirname(dirPath);
    const labnoteDirName = path.basename(labnoteDirPath).toLowerCase();
    
    // Check if parent folder is 'labnote' and experiment folder has 3-digit prefix
    return labnoteDirName === 'labnote' && /^\d{3}_/.test(experimentDirName);
  } catch {
    return false;
  }
}

/**
 * Get the next workflow number based on existing files
 * @param existingFiles Array of existing file names (e.g., ['001_WD010_Design.md'])
 * @returns Next number as 3-digit string (e.g., '002')
 */
export function getNextWorkflowNumber(existingFiles: string[]): string {
  const numbers = existingFiles
    .filter(file => /^\d{3}_.*\.labnote\.md$/i.test(file) && file.toLowerCase() !== 'readme.labnote.md')
    .map(file => {
      const match = file.match(/^(\d{3})_/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(maxNumber + 1).padStart(3, '0');
}

/**
 * Sanitize workflow name for use in filename
 * - Replaces spaces with underscores
 * - Removes punctuation/symbols but keeps Unicode letters (e.g. Korean),
 *   digits and underscores, so non-ASCII aliases survive in file names
 */
export function sanitizeWorkflowName(name: string): string {
  return sanitizePathSegment(name);
}

/**
 * Create workflow file content with YAML front matter
 * @param workflow Workflow information
 * @param experimenter Experimenter name (from README author field)
 */
export function createWorkflowContent(
  workflow: WorkflowInfo,
  experimenter: string,
  alias?: string
): string {
  const today = getSeoulDateString(new Date());
  // An optional per-instance alias is appended *after* the bracketed catalog
  // name (e.g. `[WT010 Nucleotide Sequencing] Genetic Circuit Sequencing`),
  // leaving the `[id name]` prefix intact for downstream parsing.
  const suffix = alias && alias.trim() ? ` ${alias.trim()}` : '';
  const title = `${workflow.id} ${workflow.name}${suffix}`;

  // Front matter goes through serializeFrontMatterEntry so a title/alias
  // containing a colon is emitted as valid, round-trippable YAML.
  const frontMatter = [
    serializeFrontMatterEntry('title', title),
    serializeFrontMatterEntry('experimenter', experimenter),
    serializeFrontMatterEntry('created_date', today),
    serializeFrontMatterEntry('last_updated_date', today),
    serializeFrontMatterEntry('end_date', ''),
  ].join('\n');

  return `---
${frontMatter}
---

## [${workflow.id} ${workflow.name}]${suffix}

> ${workflow.description}

## Related Unit Operations

> Unit operations are appended here automatically.
> Use F1 → "Labnote: Add Unit Operation" to add one.

## Conclusions and Discussion



`;
}

/**
 * Create workflow filename with .md extension
 * @param sequence 3-digit sequence number (e.g., '001')
 * @param workflow Workflow information
 */
export function createWorkflowFileName(
  sequence: string,
  workflow: WorkflowInfo,
  alias?: string
): string {
  const safeName = sanitizeWorkflowName(workflow.name);
  const safeAlias = alias && alias.trim() ? `_${sanitizeWorkflowName(alias)}` : '';

  return `${sequence}_${workflow.id}_${safeName}${safeAlias}.labnote.md`;
}

/**
 * Parse workflow checklist from README content
 * Looks for items in the "Related Workflows" section
 */
export function parseWorkflowChecklistFromReadme(readmeContent: string): WorkflowChecklistItem[] {
  const lines = readmeContent.split('\n');
  const headerIndex = lines.findIndex(line => /^##\s.*Related Workflows/i.test(line.trim()));
  
  if (headerIndex === -1) {
    return [];
  }
  
  const items: WorkflowChecklistItem[] = [];
  
  // Start from line after header
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop at next section
    if (line.startsWith('## ')) {
      break;
    }
    
    // Link pattern is permissive (optional `./`, any characters up to the
    // `.labnote.md` suffix) so it interprets a README the same way the Section
    // Editor parser does — including manually created links with non-ASCII file
    // names. Downstream commands still validate each name via
    // `parseWorkflowFileName`.
    const checkboxMatch = line.match(/^(?:-\s+)?\[([ x])\]\s*\[([^\]]+)\]\((?:\.\/)?([^)]+\.labnote\.md)\)/i);
    if (checkboxMatch) {
      items.push({
        done: checkboxMatch[1].toLowerCase() === 'x',
        title: checkboxMatch[2],
        fileName: checkboxMatch[3],
      });
    }
  }
  
  return items;
}

/**
 * Generate workflow checklist markdown
 * @param items Array of workflow checklist items
 */
export function generateWorkflowChecklist(items: WorkflowChecklistItem[]): string {
  if (items.length === 0) {
    return '';
  }
  
  return items
    .map(item => {
      const checkbox = item.done ? '[x]' : '[ ]';
      // Standard Markdown task-list item (`- [ ]`) so Obsidian renders an
      // interactive checkbox instead of literal `[ ]` text.
      return `- ${checkbox} [${item.title}](./${item.fileName})`;
    })
    .join('\n');
}

/**
 * Update Related Workflows section in README content
 * @param readmeContent Current README content
 * @param newChecklistContent New checklist content to insert
 * @returns Updated README content
 */
export function updateReadmeWorkflowSection(
  readmeContent: string,
  newChecklistContent: string
): string {
  const lines = readmeContent.split('\n');
  const headerIndex = lines.findIndex(line => /^##\s.*Related Workflows/i.test(line.trim()));
  
  if (headerIndex === -1) {
    return readmeContent;
  }
  
  // Find the section boundaries
  let insertStart = headerIndex + 1;
  
  // Skip empty lines after header
  while (insertStart < lines.length && lines[insertStart].trim() === '') {
    insertStart++;
  }
  
  // Skip blockquote lines (instructions)
  while (insertStart < lines.length && lines[insertStart].trim().startsWith('>')) {
    insertStart++;
  }
  
  // Skip empty lines after blockquote
  while (insertStart < lines.length && lines[insertStart].trim() === '') {
    insertStart++;
  }
  
  // Find end of checkbox section
  let blockEnd = insertStart;
  while (blockEnd < lines.length) {
    const trimmed = lines[blockEnd].trim();
    if (trimmed.startsWith('## ')) {
      break;
    }
    // Consume both legacy (`[ ]`/`[x]`) and standard (`- [ ]`/`- [x]`) checklist
    // lines plus blank lines so the whole existing block is replaced. Missing
    // the `- [ ]` form here would leave the old block above the new one,
    // duplicating README entries.
    if (/^(?:-\s+)?\[[ x]\]/i.test(trimmed) || trimmed === '') {
      blockEnd++;
      continue;
    }
    break;
  }
  
  // Build new content
  const before = lines.slice(0, insertStart);
  const after = lines.slice(blockEnd);
  
  const newLines = newChecklistContent ? [newChecklistContent, '', ''] : [''];
  
  return [...before, ...newLines, ...after].join('\n');
}

/**
 * Parsed components of a workflow filename `{sequence}_{id}_{safeName}.labnote.md`.
 * Used by the rename-workflow command (issue #19) to decompose a file before
 * computing the new on-disk path while keeping `sequence` and `id` immutable.
 */
export interface ParsedWorkflowFileName {
  sequence: string;
  id: string;
  safeName: string;
}

/**
 * Parse a workflow filename into its components, or return `null` when the
 * filename does not match the standard pattern enforced by
 * `createWorkflowFileName`. Accepts any `[A-Z]{2}\d{3}` id (including `WX` for
 * uncategorised entries).
 */
export function parseWorkflowFileName(fileName: string): ParsedWorkflowFileName | null {
  const match = fileName.match(/^(\d{3})_([A-Z]{2}\d{3})_(.+)\.labnote\.md$/);
  if (!match) return null;
  return { sequence: match[1], id: match[2], safeName: match[3] };
}

/**
 * A single old-to-new workflow filename remap captured from a vault rename
 * event. Both are plain basenames (e.g. `001_WD010_Design.labnote.md`).
 */
export interface WorkflowRename {
  from: string;
  to: string;
}

/** Result of {@link reconcileWorkflowChecklist}. */
export interface ReconcileChecklistResult {
  changed: boolean;
  content: string;
}

/**
 * Reorder the README "Related Workflows" checklist to match the on-disk `NNN`
 * order after workflow files were renamed in the file explorer.
 *
 * `renames` (old->new basenames captured from vault rename events) are applied
 * to each item's link first, so reordering is correct even when Obsidian's
 * "Automatically update internal links" setting is off. When that setting is
 * on, Obsidian has already rewritten the link and the remap is a harmless
 * no-op. Standard items are then sorted by the numeric `NNN` prefix of their
 * (remapped) filename (`001 < 010 < 100`, ties broken by name); non-standard or
 * manually authored links that `parseWorkflowFileName` cannot decode are kept,
 * in their original relative order, after the standard ones.
 *
 * This function ONLY reorders/relinks. It never drops an entry whose file is
 * missing on disk — deletion is handled separately (surgically) so a user's
 * manual order is not clobbered on delete. Returns `{changed:false}` when the
 * README has no "Related Workflows" section or the content is unaffected.
 */
export function reconcileWorkflowChecklist(
  readmeContent: string,
  renames: WorkflowRename[]
): ReconcileChecklistResult {
  const items = parseWorkflowChecklistFromReadme(readmeContent);
  if (items.length === 0) {
    return { changed: false, content: readmeContent };
  }

  // Remap each link by basename (a checklist link may carry a `./` or subpath).
  const remap = new Map<string, string>();
  for (const r of renames) {
    if (r.from && r.to) remap.set(r.from, r.to);
  }
  const baseName = (fileName: string): string => fileName.split('/').pop() ?? fileName;
  const remapped = items.map(item => {
    const to = remap.get(baseName(item.fileName));
    return to ? { ...item, fileName: to } : item;
  });

  // Stable sort: standard `NNN` items first (numeric), then unparseable ones in
  // their original relative order.
  const decorated = remapped.map((item, index) => {
    const parsed = parseWorkflowFileName(baseName(item.fileName));
    return {
      item,
      index,
      seq: parsed ? parseInt(parsed.sequence, 10) : Number.POSITIVE_INFINITY,
      name: parsed ? parsed.safeName : '',
    };
  });
  decorated.sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    if (a.seq === Number.POSITIVE_INFINITY) return a.index - b.index;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.index - b.index;
  });

  const reordered = decorated.map(d => d.item);
  const content = updateReadmeWorkflowSection(
    readmeContent,
    generateWorkflowChecklist(reordered)
  );
  return { changed: content !== readmeContent, content };
}

/**
 * Parse experimenter name from README YAML front matter
 */
export function parseExperimenterFromReadme(readmeContent: string): string {
  // Read `author:` through the shared YAML parser (single front-matter source of
  // truth) so a quoted author value is unquoted correctly. Issue #36 (an empty
  // author swallowing the next line) is handled structurally: an empty/missing
  // author parses to null/'' rather than the following key. Input is
  // CRLF-normalized for parsing only.
  const { frontMatter } = parseFrontMatterYaml(readmeContent.replace(/\r\n/g, '\n'));
  const author = frontMatter.author;
  return typeof author === 'string' ? author.trim() : '';
}
