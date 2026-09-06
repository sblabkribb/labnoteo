/**
 * Workflow Structure - Functions for creating workflow files and managing workflow checklist
 */

import * as path from '../util/posixPath';
import { getSeoulDateString } from './dateUtils';

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
 * Check if a file path is a valid README.md in a labnote subfolder
 * Path should be: {workspace}/labnote/{###_ExperimentName}/README.md
 */
export function isValidReadmePath(filePath: string): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');
  const baseName = path.basename(normalizedPath).toLowerCase();
  
  if (baseName !== 'readme.labnote.md') {
    return false;
  }
  
  try {
    const dirPath = path.dirname(normalizedPath);
    const experimentDirName = path.basename(dirPath);
    const labnoteDirPath = path.dirname(dirPath);
    const labnoteDirName = path.basename(labnoteDirPath).toLowerCase();
    
    // Check if parent folder is 'labnote' and experiment folder has 3-digit prefix
    const isLabnoteDir = labnoteDirName === 'labnote';
    const hasCorrectPrefix = /^\d{3}_/.test(experimentDirName);
    
    return isLabnoteDir && hasCorrectPrefix;
  } catch {
    return false;
  }
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
  return name
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_]/gu, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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
  
  return `---
title: ${title}
experimenter: ${experimenter}
created_date: ${today}
last_updated_date: ${today}
end_date: ''
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
 * Extract the human-readable workflow name from a workflow document body.
 *
 * Primary source: the front matter `title:` line in the form `<id> <name>`.
 * Fallback: the first `## [<id> <name>]` H2 heading in the body.
 *
 * Returns `null` when neither source carries the requested `id`. This guards
 * the rename command against matching a stale title that belongs to a
 * different workflow (e.g. when the user manually edited the file).
 */
export function extractWorkflowName(content: string, id: string): string | null {
  const idEsc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(new RegExp(`^title:\\s*${idEsc}\\s+(.+?)\\s*$`, 'm'));
    if (titleMatch) return titleMatch[1];
  }
  const h2Match = content.match(new RegExp(`^## \\[${idEsc}\\s+([^\\]]+)\\]\\s*$`, 'm'));
  if (h2Match) return h2Match[1].trim();
  return null;
}

/**
 * Parse experimenter name from README YAML front matter
 */
export function parseExperimenterFromReadme(readmeContent: string): string {
  const match = readmeContent.match(/^---[\s\S]+?---/);
  if (!match) {
    return '';
  }
  
  // Issue #36: anchor the key to the line start and only consume same-line
  // spaces/tabs. A bare `/author:\s*(.+)/` lets `\s*` cross the newline when
  // the author value is empty, capturing the next line (e.g.
  // `experiment_type: labnote`) as the experimenter.
  const authorMatch = match[0].match(/^author:[ \t]*(.*)$/im);
  return authorMatch ? authorMatch[1].trim() : '';
}
