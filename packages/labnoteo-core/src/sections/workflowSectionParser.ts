import type {
  WorkflowDocument,
  WorkflowFrontMatter,
  UnitOperationBlock,
  UnitOpSection,
} from './sectionTypes';
import { parseFrontMatterYaml, serializeFrontMatterEntry } from './frontMatter';
import { normalizeWorkflowUnitSectionHeading } from './unitOpHeading';

function parseFrontMatter(md: string): { frontMatter: Record<string, unknown>; body: string } {
  return parseFrontMatterYaml(md);
}

function serializeFrontMatter(fm: WorkflowFrontMatter): string {
  const lines: string[] = ['---'];
  const knownKeys = ['title', 'experimenter', 'created_date', 'last_updated_date', 'end_date'];
  for (const key of knownKeys) {
    const val = fm[key];
    if (key === 'end_date' && !val) {
      lines.push(`${key}: ''`);
    } else {
      lines.push(`${key}: ${val ?? ''}`);
    }
  }
  for (const [key, val] of Object.entries(fm)) {
    if (!knownKeys.includes(key)) {
      lines.push(serializeFrontMatterEntry(key, val));
    }
  }
  lines.push('---');
  return lines.join('\n');
}

const H2_PATTERN = /^##\s+/;
const H4_PATTERN = /^####\s+/;
const HR_PATTERN = /^---\s*$/;
const UNIT_OP_HEADING_PATTERN = /^###\s+\[([A-Z]+\d+)\s+(.+?)\]\s*(.*)/;
const BLOCKQUOTE_PATTERN = /^>\s*(.*)/;

/** Catalog ids use UHW/USW (see workflowDataLoader); legacy markdown may use HW/SW prefixes. */
function detectOpType(opId: string): 'hw' | 'sw' {
  const u = opId.toUpperCase();
  if (u.startsWith('USW')) return 'sw';
  if (u.startsWith('UHW')) return 'hw';
  if (u.startsWith('SW')) return 'sw';
  if (u.startsWith('HW')) return 'hw';
  return 'hw';
}

export function parseWorkflowMd(md: string): WorkflowDocument {
  // Normalize CRLF up front so front matter and body line splitting behave
  // identically for Windows-saved files (serialization always emits LF).
  const { frontMatter: rawFm, body } = parseFrontMatter(md.replace(/\r\n/g, '\n'));

  const fm: WorkflowFrontMatter = {
    title: String(rawFm.title ?? ''),
    experimenter: String(rawFm.experimenter ?? ''),
    created_date: String(rawFm.created_date ?? ''),
    last_updated_date: String(rawFm.last_updated_date ?? ''),
    end_date: String(rawFm.end_date ?? ''),
  };
  for (const [k, v] of Object.entries(rawFm)) {
    if (!(k in fm)) {
      fm[k] = v;
    }
  }

  const lines = body.split('\n');
  let workflowHeader = '';
  let workflowDescription = '';
  const unitOperations: UnitOperationBlock[] = [];

  let i = 0;

  // Parse workflow header (first ## heading with [...])
  while (i < lines.length) {
    const h2Match = lines[i].match(/^##\s+(\[.+?\].*)/);
    if (h2Match) {
      workflowHeader = h2Match[1].trim();
      i++;
      // Next non-empty line could be blockquote description
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i < lines.length) {
        const bqMatch = lines[i].match(BLOCKQUOTE_PATTERN);
        if (bqMatch) {
          workflowDescription = bqMatch[1].trim();
          i++;
        }
      }
      break;
    }
    i++;
  }

  // Skip to unit operations (past "Related Unit Operations" section)
  while (i < lines.length) {
    if (HR_PATTERN.test(lines[i].trim()) || UNIT_OP_HEADING_PATTERN.test(lines[i])) {
      break;
    }
    if (H2_PATTERN.test(lines[i]) && !/Related Unit Operations/i.test(lines[i])) {
      break;
    }
    i++;
  }

  // Parse unit operations
  let opCounter = 0;
  while (i < lines.length) {
    // Skip HR separators
    if (HR_PATTERN.test(lines[i].trim())) {
      i++;
      while (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }

    // Check for tail section (## heading that is NOT a unit op heading and NOT "Related Unit Operations")
    if (H2_PATTERN.test(lines[i]) && !UNIT_OP_HEADING_PATTERN.test(lines[i])) {
      const headingText = lines[i].replace(/^##\s+/, '').trim();
      if (!/Related Unit Operations/i.test(headingText)) {
        break;
      }
    }

    const opMatch = lines[i].match(UNIT_OP_HEADING_PATTERN);
    if (opMatch) {
      opCounter++;
      const opId = opMatch[1];
      const opName = opMatch[2].trim();
      const alias = opMatch[3]?.trim() || undefined;
      i++;

      // Get description from blockquote
      let opDescription = '';
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i < lines.length) {
        const bqMatch = lines[i].match(BLOCKQUOTE_PATTERN);
        if (bqMatch) {
          opDescription = bqMatch[1].trim();
          i++;
        }
      }

      // Parse #### sections until next --- or ### or ## or EOF
      const sections: UnitOpSection[] = [];
      while (i < lines.length) {
        if (HR_PATTERN.test(lines[i].trim()) || UNIT_OP_HEADING_PATTERN.test(lines[i])) {
          break;
        }
        if (H2_PATTERN.test(lines[i]) && !/Related Unit Operations/i.test(lines[i])) {
          break;
        }

        const h4Match = lines[i].match(/^####\s+(.*)/);
        if (h4Match) {
          const heading = normalizeWorkflowUnitSectionHeading(h4Match[1].trim());
          i++;
          const contentLines: string[] = [];
          while (i < lines.length) {
            if (H4_PATTERN.test(lines[i]) || HR_PATTERN.test(lines[i].trim()) || UNIT_OP_HEADING_PATTERN.test(lines[i])) {
              break;
            }
            if (H2_PATTERN.test(lines[i]) && !/Related Unit Operations/i.test(lines[i])) {
              break;
            }
            contentLines.push(lines[i]);
            i++;
          }
          sections.push({
            heading,
            content: contentLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, ''),
          });
          continue;
        }

        i++;
      }

      unitOperations.push({
        id: `unitop-${opCounter}`,
        opId,
        opName,
        opDescription,
        opType: detectOpType(opId),
        alias,
        sections,
      });
      continue;
    }

    i++;
  }

  // Parse tail content (everything from the current position onwards)
  // Strip the "## Conclusions and Discussion" heading since the UI renders it separately
  let tailContent = '';
  if (i < lines.length) {
    const raw = lines.slice(i).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    tailContent = raw.replace(/^##\s+Conclusions and Discussion\s*\n?/, '').replace(/^\n+/, '');
  }

  return { frontMatter: fm, workflowHeader, workflowDescription, unitOperations, tailContent };
}

export function serializeWorkflowMd(doc: WorkflowDocument): string {
  const parts: string[] = [serializeFrontMatter(doc.frontMatter), ''];

  // Workflow header
  parts.push(`## ${doc.workflowHeader}`);
  parts.push('');
  if (doc.workflowDescription) {
    parts.push(`> ${doc.workflowDescription}`);
    parts.push('');
  }

  // Related Unit Operations section marker with TOC
  parts.push('## Related Unit Operations');
  parts.push('');
  if (doc.unitOperations.length > 0) {
    for (const op of doc.unitOperations) {
      parts.push(buildUnitOpTocLine(op.opId, op.opName, op.alias));
    }
    parts.push('');
  }

  // Unit operations
  for (const op of doc.unitOperations) {
    parts.push('---');
    parts.push('');
    parts.push(`### [${op.opId} ${op.opName}]${op.alias ? ' ' + op.alias : ''}`);
    parts.push('');
    if (op.opDescription) {
      parts.push(`> ${op.opDescription}`);
      parts.push('');
    }
    for (const section of op.sections) {
      parts.push(`#### ${section.heading}`);
      parts.push(section.content);
      parts.push('');
    }
  }

  // Tail section (always write the heading; content may be empty)
  parts.push('## Conclusions and Discussion');
  parts.push('');
  if (doc.tailContent) {
    parts.push(doc.tailContent);
    parts.push('');
  }
  parts.push('');

  return parts.join('\n');
}

export function validateWorkflowDocument(doc: WorkflowDocument): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!doc.frontMatter.title) {
    errors.push('title is required in front matter');
  }
  if (!doc.frontMatter.experimenter) {
    errors.push('experimenter is required in front matter');
  }
  if (!doc.frontMatter.created_date) {
    errors.push('created_date is required in front matter');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Build a single Related-Unit-Operations TOC line for a unit op.
 *
 * The slug is a GitHub-style anchor of the `### [opId opName]` heading. This is
 * the single source of truth shared by {@link serializeWorkflowMd} and the
 * non-lossy {@link appendUnitOpToWorkflowToc}.
 */
export function buildUnitOpTocLine(opId: string, opName: string, alias?: string): string {
  const label = `${opId} ${opName}${alias ? ' | ' + alias : ''}`;
  const headingText = `[${opId} ${opName}]${alias ? ' ' + alias : ''}`;
  const slug = headingText
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `- [${label}](#${slug})`;
}

/**
 * Append one unit-op entry to the `## Related Unit Operations` TOC **without
 * re-serializing the whole document**.
 *
 * The Obsidian port inserts unit-op blocks at the cursor rather than round-
 * tripping through {@link serializeWorkflowMd} (which normalises unrecognised
 * headings/whitespace — the very lossiness that motivated dropping the Section
 * Editor). This helper performs a surgical, whitespace-preserving edit:
 *
 * - Appends after the last existing `- [...]` entry in the section, if any.
 * - Otherwise inserts right after the heading's blank line, keeping a blank
 *   separator before any following prose (e.g. the template hint blockquotes).
 * - Returns the input unchanged when the section is absent.
 *
 * CRLF vs LF line endings are detected and preserved.
 */
export function appendUnitOpToWorkflowToc(
  md: string,
  opId: string,
  opName: string,
  alias?: string
): string {
  const newline = md.includes('\r\n') ? '\r\n' : '\n';
  const lines = md.split(/\r?\n/);

  const headingIdx = lines.findIndex(l => l.trim() === '## Related Unit Operations');
  if (headingIdx === -1) return md;

  // Section spans until the next `## ` heading or a thematic break `---`.
  let endIdx = lines.length;
  for (let j = headingIdx + 1; j < lines.length; j++) {
    if (/^##\s/.test(lines[j]) || lines[j].trim() === '---') {
      endIdx = j;
      break;
    }
  }

  const entryLine = buildUnitOpTocLine(opId, opName, alias);

  let lastEntry = -1;
  for (let j = headingIdx + 1; j < endIdx; j++) {
    if (/^\s*- \[/.test(lines[j])) lastEntry = j;
  }

  if (lastEntry !== -1) {
    lines.splice(lastEntry + 1, 0, entryLine);
  } else {
    let insertAt = headingIdx + 1;
    // Skip the single blank line that follows the heading.
    if (lines[insertAt] !== undefined && lines[insertAt].trim() === '') insertAt++;
    const toInsert = [entryLine];
    // Keep a blank separator before following non-blank prose.
    if (lines[insertAt] !== undefined && lines[insertAt].trim() !== '') toInsert.push('');
    lines.splice(insertAt, 0, ...toInsert);
  }

  return lines.join(newline);
}

/**
 * Regenerate the entire `## Related Unit Operations` TOC so its entries match
 * the **document order** of the `### [opId opName]` unit-op headings.
 *
 * Unlike {@link appendUnitOpToWorkflowToc} (which always appends), this scans
 * the body for the actual headings and rewrites the entry list in that order.
 * This keeps the TOC correct even when a unit op is inserted at an arbitrary
 * cursor position, and self-heals any previously mis-ordered list.
 *
 * The edit is confined to the entry lines inside the section (heading → first
 * `## ` heading or `---`); surrounding blanks and the template hint blockquotes
 * are preserved. Returns the input unchanged when the section is absent.
 * CRLF vs LF line endings are detected and preserved.
 */
export function rebuildUnitOpToc(md: string): string {
  const newline = md.includes('\r\n') ? '\r\n' : '\n';
  const lines = md.split(/\r?\n/);

  const headingIdx = lines.findIndex(l => l.trim() === '## Related Unit Operations');
  if (headingIdx === -1) return md;

  // The entry region ends at the next `## ` heading or the first `---` break.
  let tocEndIdx = lines.length;
  for (let j = headingIdx + 1; j < lines.length; j++) {
    if (/^##\s/.test(lines[j]) || lines[j].trim() === '---') {
      tocEndIdx = j;
      break;
    }
  }

  // Collect unit-op headings across the body, in document order. TOC lines start
  // with `- [`, so they never match the `### [` heading pattern.
  const newEntries: string[] = [];
  for (let j = headingIdx + 1; j < lines.length; j++) {
    const m = lines[j].match(UNIT_OP_HEADING_PATTERN);
    if (m) newEntries.push(buildUnitOpTocLine(m[1], m[2].trim(), m[3]?.trim() || undefined));
  }

  // Replace the existing contiguous run of entry lines with the new ordered list.
  let firstEntry = -1;
  let lastEntry = -1;
  for (let j = headingIdx + 1; j < tocEndIdx; j++) {
    if (/^\s*- \[/.test(lines[j])) {
      if (firstEntry === -1) firstEntry = j;
      lastEntry = j;
    }
  }

  if (firstEntry !== -1) {
    lines.splice(firstEntry, lastEntry - firstEntry + 1, ...newEntries);
  } else if (newEntries.length > 0) {
    let insertAt = headingIdx + 1;
    if (lines[insertAt] !== undefined && lines[insertAt].trim() === '') insertAt++;
    const toInsert = [...newEntries];
    if (lines[insertAt] !== undefined && lines[insertAt].trim() !== '') toInsert.push('');
    lines.splice(insertAt, 0, ...toInsert);
  }

  return lines.join(newline);
}

/**
 * Given the post-insert markdown, the pre-insert cursor offset, and the
 * TOC-rebuilt markdown, return the character offset of the just-inserted
 * `### [..]` unit-op heading within the rebuilt text (or -1 if none).
 *
 * The inserted block sits at `cursorBefore`, so the first `### [` at/after that
 * offset is ours. Since {@link rebuildUnitOpToc} only rewrites `- [..]` lines
 * (never `### [..]`), the heading keeps its ordinal index among all headings;
 * we map by that index into the rebuilt text.
 */
export function locateInsertedUnitOpHeading(
  mdAfterInsert: string,
  cursorBefore: number,
  rebuiltMd: string
): number {
  const HEAD = '### [';
  const headingInMd = mdAfterInsert.indexOf(HEAD, Math.max(0, cursorBefore));
  if (headingInMd === -1) return -1;

  // Ordinal (0-based) index of our heading among all headings in mdAfterInsert.
  let idx = 0;
  for (
    let p = mdAfterInsert.indexOf(HEAD);
    p !== -1 && p < headingInMd;
    p = mdAfterInsert.indexOf(HEAD, p + 1)
  ) {
    idx++;
  }

  // Find the idx-th heading in the rebuilt text.
  let p = rebuiltMd.indexOf(HEAD);
  for (let c = 0; c < idx && p !== -1; c++) p = rebuiltMd.indexOf(HEAD, p + 1);
  return p;
}
