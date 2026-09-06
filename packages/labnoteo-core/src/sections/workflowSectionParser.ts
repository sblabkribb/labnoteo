/**
 * Surgical, whitespace-preserving edits to a workflow's `## Related Unit
 * Operations` table of contents.
 *
 * The lossy full-document parser/serializer (`parseWorkflowMd` /
 * `serializeWorkflowMd`) was removed — it normalised unrecognised headings and
 * whitespace, which corrupted user edits. The Obsidian port instead inserts
 * unit-op blocks at the cursor and keeps the TOC in sync with these targeted
 * helpers.
 */

const UNIT_OP_HEADING_PATTERN = /^###\s+\[([A-Z]+\d+)\s+(.+?)\]\s*(.*)/;

/**
 * Build a single Related-Unit-Operations TOC line for a unit op.
 *
 * The slug is a GitHub-style anchor of the `### [opId opName]` heading. This is
 * the single source of truth shared by {@link appendUnitOpToWorkflowToc} and
 * {@link rebuildUnitOpToc}.
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
 * tripping through a full-document serializer (which would normalise
 * unrecognised headings/whitespace — the very lossiness that motivated dropping
 * the Section Editor). This helper performs a surgical, whitespace-preserving
 * edit:
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

  // Collect the individual entry-line indices in the section. We must NOT splice
  // the whole first→last span, because any non-entry lines interleaved between
  // entries (comments, blockquotes, stray blanks) would be deleted too. Instead
  // remove only the `- [..]` lines and reinsert the ordered list where the first
  // one began, leaving interleaved content untouched.
  const entryIdxs: number[] = [];
  for (let j = headingIdx + 1; j < tocEndIdx; j++) {
    if (/^\s*- \[/.test(lines[j])) entryIdxs.push(j);
  }

  if (entryIdxs.length > 0) {
    const firstEntry = entryIdxs[0];
    // Remove existing entry lines bottom-up so earlier indices stay valid.
    for (let k = entryIdxs.length - 1; k >= 0; k--) {
      lines.splice(entryIdxs[k], 1);
    }
    lines.splice(firstEntry, 0, ...newEntries);
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
