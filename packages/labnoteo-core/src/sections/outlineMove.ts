/**
 * Obsidian Outline heading moves, reproduced and corrected.
 *
 * The Outline view moves a heading section by splicing the file text: the
 * section runs from the dragged heading to the next heading of the same or a
 * higher level, and it is inserted at the start of a target heading. A drop
 * "after" a heading targets the NEXT heading in the flat heading list, which for
 * a unit op (`### [..]`) is its own first `#### Meta`. The moved block then sits
 * between that unit op's title and its subsections, and those subsections end
 * up under the moved block. Levels are never changed by the move, so inserting
 * a level-L block in front of a deeper heading is never the intended result.
 */

/** A heading as the Outline sees it (Obsidian `HeadingCache`, reduced). */
export interface OutlineHeading {
  level: number;
  /** Character offset of the heading line in the file. */
  start: number;
}

/** Obsidian's spacing rule for the pieces it splices: end with a blank line. */
function endWithBlankLine(text: string): string {
  if (!text.endsWith('\n')) return text + '\n\n';
  return text.charAt(text.length - 2) === '\n' ? text : text + '\n';
}

/**
 * The text Obsidian's Outline writes when it moves the section `[from, to)` to
 * `insertAt`. `to` / `insertAt` of `-1` mean the end of the file, exactly as in
 * Obsidian, including the case where the drop lands inside or right after the
 * moved section and nothing changes.
 */
export function simulateOutlineHeadingMove(
  md: string,
  from: number,
  to: number,
  insertAt: number
): string {
  const past = Math.max(from, to, insertAt) + 1;
  const sectionEnd = to === -1 ? past : to;
  const dropAt = insertAt === -1 ? past : insertAt;
  if (dropAt >= from && dropAt <= sectionEnd) return md;

  const end = to === -1 ? md.length : to;
  const at = insertAt === -1 ? md.length : insertAt;
  const block = endWithBlankLine(md.substring(from, end));
  return at < from
    ? endWithBlankLine(md.substring(0, at)) + block + md.substring(at, from) + md.substring(end)
    : md.substring(0, from) + endWithBlankLine(md.substring(end, at)) + block + md.substring(at);
}

/** Start of the next heading at `level` or higher after `idx`, or `-1` for the end of the file. */
function nextHeadingStart(headings: readonly OutlineHeading[], idx: number, level: number): number {
  for (let j = idx + 1; j < headings.length; j++) {
    if (headings[j].level <= level) return headings[j].start;
  }
  return -1;
}

/**
 * Undo the nesting side effect of an Outline drop.
 *
 * `before` is the file as Obsidian read it, `headings` its heading list at drop
 * time and `movedIdx` the dragged heading. When `after` is exactly what the
 * Outline produces for a drop in front of a heading deeper than the dragged one,
 * the block is moved to the end of the enclosing section instead (where a drop
 * between the blocks would have put it). Any other valid move returns `after`
 * unchanged; `null` means `after` is not an Outline move of that section, so the
 * caller must leave the file alone.
 */
export function fixOutlineDropNesting(
  before: string,
  after: string,
  headings: readonly OutlineHeading[],
  movedIdx: number
): string | null {
  if (before === after) return after;
  const moved = headings[movedIdx];
  if (!moved) return null;
  const from = moved.start;
  const to = nextHeadingStart(headings, movedIdx, moved.level);

  for (let i = -1; i < headings.length; i++) {
    const insertAt = i === -1 ? -1 : headings[i].start;
    if (simulateOutlineHeadingMove(before, from, to, insertAt) !== after) continue;
    if (i === -1 || headings[i].level <= moved.level) return after;
    const target = nextHeadingStart(headings, i, moved.level);
    return simulateOutlineHeadingMove(before, from, to, target);
  }
  return null;
}
