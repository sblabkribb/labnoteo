/**
 * Surgical, whitespace-preserving section edits.
 *
 * Like {@link appendUnitOpToWorkflowToc}, these helpers deliberately avoid the
 * full parse → {@link serializeWorkflowMd} round-trip (which normalises
 * unrecognised headings and blank lines). LLM tools and edit-adjacent commands
 * use them to touch exactly one section without disturbing the rest of the
 * document.
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

  const headingRe = new RegExp(`^(#{1,6})\\s+${escapeRegExp(heading)}\\s*$`);
  let headingIdx = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m) {
      headingIdx = i;
      level = m[1].length;
      break;
    }
  }
  if (headingIdx === -1) return { ok: false, md };

  // Body ends at the next heading of the same or higher level (#count <= level).
  let bodyEnd = lines.length;
  const boundaryRe = new RegExp(`^#{1,${level}}\\s`);
  for (let i = headingIdx + 1; i < lines.length; i++) {
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
