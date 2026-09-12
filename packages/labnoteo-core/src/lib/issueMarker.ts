/**
 * `@issue` markers — "open a GitHub Issue about THIS spot in the note".
 *
 * Discussion comes up anywhere in a note, but Markdown has no thread to hold a
 * question, so the marker promotes one line to an Issue. The grammar extends
 * the sample-reference convention researchers already use
 * (`@type;ID;content`), so there is nothing new to learn:
 *
 *   3차 시도에서만 수율 40%. @issue;ISS-mkd8x3k;시드 배양 시간 차이 때문인지 논의 필요
 *
 * A marker runs from `@issue` to END OF LINE, so there is at most one per line.
 * Being an explicit token it carries no false-positive risk, which is why the
 * automation may act on it deterministically while free-text scanning stays
 * banned.
 *
 * The ID is what makes the Issue stable: the topic sentence can be reworded
 * without orphaning the discussion it opened.
 *
 * Domain-only (no Obsidian/Node APIs) because three callers must agree on the
 * grammar — the plugin command that writes markers, `issue-sync` that promotes
 * them, and `validate` that reports broken ones.
 */

/** Marker keyword, without the delimiter. */
export const ISSUE_MARKER_KEYWORD = '@issue';

/** Prefix of every generated marker ID. */
export const ISSUE_MARKER_ID_PREFIX = 'ISS';

/** A well-formed marker found in a note. */
export interface IssueMarker {
  /** Stable ID, e.g. `ISS-mkd8x3k`. */
  id: string;
  /** Topic sentence; becomes the Issue title. */
  title: string;
  /** 1-based line within the scanned text. */
  line: number;
}

/** A marker that was recognised but cannot be promoted. */
export interface MalformedIssueMarker {
  /** 1-based line within the scanned text. */
  line: number;
  /** The offending text, from `@issue` to end of line. */
  text: string;
  reason: 'missing-id' | 'missing-title';
}

/** Result of scanning a note for markers. */
export interface IssueMarkerScan {
  markers: IssueMarker[];
  malformed: MalformedIssueMarker[];
}

/**
 * `@issue` followed by a delimiter, an ID, and optionally a delimiter plus the
 * topic sentence. `;` is canonical; `:` is accepted for the same reason sample
 * references accept it. The ID charset excludes the delimiters so a topic
 * sentence written without an ID fails to match and is reported instead of
 * being silently mistaken for one.
 */
const MARKER_RE = /^@issue[;:]([A-Za-z0-9-]+)(?:[;:](.*))?$/i;

/** Opening/closing fence of a code block (up to 3 leading spaces, per CommonMark). */
const FENCE_RE = /^ {0,3}(?:`{3,}|~{3,})/;

/**
 * Find every `@issue` marker in `md`.
 *
 * Fenced code blocks are skipped: a note that documents the marker syntax by
 * example must not open issues for its own examples.
 *
 * Expects LF-normalised text, like the other parsers here.
 */
export function parseIssueMarkers(md: string): IssueMarkerScan {
  const markers: IssueMarker[] = [];
  const malformed: MalformedIssueMarker[] = [];
  let inFence = false;

  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // `\b` after the keyword keeps `@issues` from matching. Only the FIRST
    // occurrence matters: the marker owns the rest of the line.
    const at = line.search(/@issue\b/i);
    if (at === -1) continue;

    const text = line.slice(at);
    const lineNo = i + 1;
    const m = text.match(MARKER_RE);
    if (!m) {
      malformed.push({ line: lineNo, text, reason: 'missing-id' });
      continue;
    }
    const title = (m[2] ?? '').trim();
    if (!title) {
      malformed.push({ line: lineNo, text, reason: 'missing-title' });
      continue;
    }
    markers.push({ id: m[1], title, line: lineNo });
  }

  return { markers, malformed };
}

/** Character span of a marker within the scanned text. */
export interface IssueMarkerRange {
  start: number;
  end: number;
}

/**
 * Character ranges of the WELL-FORMED markers in `text`, for editor
 * highlighting.
 *
 * Only valid markers are returned, which makes the highlight itself the
 * feedback: a marker that stays unstyled is one that will not open an issue.
 *
 * Unlike {@link parseIssueMarkers} this does not track code fences — the editor
 * hands over arbitrary slices of the document, where a fence may have opened
 * outside the slice. Reading mode filters code by DOM instead, and a stray
 * highlight inside a code block is cosmetic.
 */
export function findIssueMarkerRanges(text: string): IssueMarkerRange[] {
  const ranges: IssueMarkerRange[] = [];
  let offset = 0;
  for (const line of text.split('\n')) {
    const at = line.search(/@issue\b/i);
    if (at !== -1) {
      const m = line.slice(at).match(MARKER_RE);
      if (m && (m[2] ?? '').trim()) {
        ranges.push({ start: offset + at, end: offset + line.length });
      }
    }
    offset += line.length + 1; // + the newline consumed by split
  }
  return ranges;
}

// Same-millisecond guard, mirroring `generateSampleId`: two markers inserted in
// one burst must not collide.
let idCounter = 0;
let lastTimestamp = 0;

/**
 * Generate a marker ID: `ISS-` plus the current timestamp in base36, with a
 * `-N` suffix when called twice within one millisecond.
 *
 * Base36 rather than the sample IDs' decimal milliseconds because this string
 * shows up in the note body AND in the Issue title, where length is felt.
 */
export function generateIssueMarkerId(): string {
  const timestamp = Date.now();
  if (timestamp === lastTimestamp) {
    idCounter++;
  } else {
    idCounter = 0;
    lastTimestamp = timestamp;
  }
  const suffix = idCounter > 0 ? `-${idCounter}` : '';
  return `${ISSUE_MARKER_ID_PREFIX}-${timestamp.toString(36)}${suffix}`;
}

/** Reset the ID counter (tests only). */
export function resetIssueMarkerIdCounter(): void {
  idCounter = 0;
  lastTimestamp = 0;
}

/** The canonical text of a marker, as the insert command writes it. */
export function renderIssueMarker(marker: { id: string; title: string }): string {
  return `${ISSUE_MARKER_KEYWORD};${marker.id};${marker.title}`;
}

/**
 * Text of the nearest Markdown heading at or above `line` (1-based), or
 * undefined when the marker sits before any heading. Gives the Issue the
 * section it came from (`Results` vs `Methods`) without copying the note.
 *
 * Headings inside fenced code are ignored, for the same reason markers are.
 */
export function findEnclosingHeading(md: string, line: number): string | undefined {
  const lines = md.split('\n');
  const fenced = new Set<number>();
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      inFence = !inFence;
      fenced.add(i);
      continue;
    }
    if (inFence) fenced.add(i);
  }

  for (let i = Math.min(line, lines.length) - 1; i >= 0; i--) {
    if (fenced.has(i)) continue;
    const m = lines[i].match(/^#{1,6}\s+(.*?)\s*$/);
    if (m && m[1]) return m[1];
  }
  return undefined;
}
