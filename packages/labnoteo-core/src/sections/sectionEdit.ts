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

/** An open code fence: which character opened it, and how long the run was. */
interface OpenFence {
  char: string;
  length: number;
}

/** A fence line: up to 3 leading spaces, then a run of 3+ backticks or tildes. */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Advance code-fence state across one line.
 *
 * Per CommonMark a fence is closed only by a run of the SAME character that is
 * at least as long as the opener, and a closing fence carries no info string.
 * Tracking that matters: a plain boolean toggle read the ``` inside a `~~~`
 * block as a close, then read the real `~~~` as an open — and from there every
 * heading in the rest of the document looked like it was inside code, so the
 * section body ran to EOF and replacing it deleted every following section.
 * Showing fenced Markdown inside a fenced example is a normal thing to write in
 * a protocol note.
 */
function stepFence(line: string, open: OpenFence | null): OpenFence | null {
  const match = line.match(FENCE_RE);
  if (!match) return open;

  const run = match[1];
  if (open === null) return { char: run[0], length: run.length };

  const afterRun = line.slice(line.indexOf(run) + run.length);
  const closes = run[0] === open.char && run.length >= open.length && afterRun.trim() === '';
  return closes ? null : open;
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

  // A fenced code block can contain lines that look like ATX headings; those
  // must NOT be treated as real headings.
  const headingRe = new RegExp(`^(#{1,6})\\s+${escapeRegExp(heading)}\\s*$`);
  let headingIdx = -1;
  let level = 0;
  let fence: OpenFence | null = null;
  for (let i = 0; i < lines.length; i++) {
    const next = stepFence(lines[i], fence);
    if (next !== fence) {
      fence = next;
      continue;
    }
    if (fence) continue;
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
  let bodyFence: OpenFence | null = null;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const next = stepFence(lines[i], bodyFence);
    if (next !== bodyFence) {
      bodyFence = next;
      continue;
    }
    if (bodyFence) continue;
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
