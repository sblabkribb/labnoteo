/**
 * Surgical, whitespace-preserving section edits.
 *
 * Like {@link appendUnitOpToWorkflowToc}, these helpers deliberately avoid a
 * full parse → re-serialize round-trip (which would normalise unrecognised
 * headings and blank lines). LLM tools and edit-adjacent commands use them to
 * touch exactly one section without disturbing the rest of the document.
 */

import { escapeRegExp } from '../lib/regexUtils';

export interface SectionEditResult {
  ok: boolean;
  md: string;
}

/**
 * Replace the body of the Markdown section whose heading text is `heading`
 * (matched at any level `#`..`######`) with `newBody`.
 *
 * The section body runs from just after the heading line up to — but not
 * including — the next heading of the **same or higher** level (so nested
 * sub-headings are treated as part of the body). The heading line itself is
 * preserved; the new body is framed by exactly one blank line on each side.
 *
 * Returns `{ ok: false, md }` unchanged when the heading is not found. CRLF vs
 * LF endings are detected and preserved.
 */
export function replaceSectionBody(
  md: string,
  heading: string,
  newBody: string
): SectionEditResult {
  const newline = md.includes('\r\n') ? '\r\n' : '\n';
  const lines = md.split(/\r?\n/);

  // A fenced code block (``` or ~~~, up to 3 leading spaces) can contain lines
  // that look like ATX headings; those must NOT be treated as real headings.
  const fenceRe = /^\s{0,3}(`{3,}|~{3,})/;

  const headingRe = new RegExp(`^(#{1,6})\\s+${escapeRegExp(heading)}\\s*$`);
  let headingIdx = -1;
  let level = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (fenceRe.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = lines[i].match(headingRe);
    if (m) {
      headingIdx = i;
      level = m[1].length;
      break;
    }
  }
  if (headingIdx === -1) return { ok: false, md };

  // Body ends at the next heading of the same or higher level (#count <= level).
  // The heading was matched outside any fence, so restart fence tracking here;
  // a `#` line inside a code block after the heading is not a real boundary.
  let bodyEnd = lines.length;
  const boundaryRe = new RegExp(`^#{1,${level}}\\s`);
  let inFenceBody = false;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (fenceRe.test(lines[i])) {
      inFenceBody = !inFenceBody;
      continue;
    }
    if (inFenceBody) continue;
    if (boundaryRe.test(lines[i])) {
      bodyEnd = i;
      break;
    }
  }

  const bodyLines = newBody === '' ? [''] : ['', ...newBody.split('\n'), ''];
  const next: string[] = [
    ...lines.slice(0, headingIdx + 1),
    ...bodyLines,
    ...lines.slice(bodyEnd),
  ];

  return { ok: true, md: next.join(newline) };
}
