import { describe, it, expect } from 'vitest';
import {
  fixOutlineDropNesting,
  simulateOutlineHeadingMove,
  type OutlineHeading,
} from '../sections/outlineMove';
import { findUnitOpInsertOffset, rebuildUnitOpToc } from '../sections/workflowSectionParser';
import { createWorkflowContent } from '../lib/workflowStructure';
import { buildHwUnitOpMarkdown } from '../lib/unitOpTemplate';

const HW_SUBSECTIONS = [
  'Meta', 'Input', 'Reagent', 'Labware and Consumables',
  'Equipment', 'Method', 'Output', 'Results & Discussions',
];

function buildNote(order: string[]): string {
  let md = createWorkflowContent({ id: 'WD010', name: 'Design', description: 'desc' }, 'Dr. Kim');
  for (const opId of order) {
    const block = buildHwUnitOpMarkdown(
      { opId, opName: `Op ${opId}`, opDescription: 'step' },
      { experimenter: 'Dr. Kim', dateTime: '2026-10-09 10:00' }
    );
    const off = findUnitOpInsertOffset(md);
    md = rebuildUnitOpToc(md.slice(0, off) + block + md.slice(off));
  }
  return md;
}

/** ATX headings outside code fences, like Obsidian's heading cache. */
function headingsOf(md: string): (OutlineHeading & { text: string })[] {
  const out: (OutlineHeading & { text: string })[] = [];
  let offset = 0;
  let fenced = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = !fenced && line.match(/^(#{1,6})\s+(.*)$/);
    if (m) out.push({ level: m[1].length, start: offset, text: line });
    offset += line.length + 1;
  }
  return out;
}

/** Index of the `nth` heading whose line starts with `prefix`. */
function idx(headings: { text: string }[], prefix: string, nth = 0): number {
  const hits = headings.map((h, i) => (h.text.startsWith(prefix) ? i : -1)).filter(i => i >= 0);
  if (hits[nth] === undefined) throw new Error(`heading not found: ${prefix}`);
  return hits[nth];
}

/** Obsidian's Outline drop of heading `moved` in front of heading `target` (`-1` = end). */
function outlineDrop(md: string, moved: number, target: number) {
  const headings = headingsOf(md);
  const level = headings[moved].level;
  let next = moved + 1;
  while (next < headings.length && headings[next].level > level) next++;
  const to = next < headings.length ? headings[next].start : -1;
  const insertAt = target === -1 ? -1 : headings[target].start;
  return { headings, after: simulateOutlineHeadingMove(md, headings[moved].start, to, insertAt) };
}

/** Each unit op with the `####` subsections that follow it, in document order. */
function blocks(md: string): [string, string[]][] {
  const result: [string, string[]][] = [];
  for (const h of headingsOf(md)) {
    const op = h.text.match(/^### \[(\w+)/);
    if (op) result.push([op[1], []]);
    else if (h.level === 4 && result.length) result[result.length - 1][1].push(h.text.slice(5).trim());
  }
  return result;
}

describe('simulateOutlineHeadingMove', () => {
  const md = '# A\n\n## B\nb\n## C\nc\n';
  const b = md.indexOf('## B');
  const c = md.indexOf('## C');

  it('returns the text unchanged for a drop inside or right after the moved section', () => {
    expect(simulateOutlineHeadingMove(md, b, c, b)).toBe(md);
    expect(simulateOutlineHeadingMove(md, b, c, c)).toBe(md);
    expect(simulateOutlineHeadingMove(md, c, -1, -1)).toBe(md);
  });

  it('pads the spliced pieces with a blank line like Obsidian', () => {
    expect(simulateOutlineHeadingMove(md, c, -1, b)).toBe('# A\n\n## C\nc\n\n## B\nb\n');
    expect(simulateOutlineHeadingMove(md, b, c, -1)).toBe('# A\n\n## C\nc\n\n## B\nb\n\n');
  });
});

describe('fixOutlineDropNesting', () => {
  const note = buildNote(['UHW010', 'UHW020', 'UHW030']);
  const hs = headingsOf(note);
  const uo = (id: string) => idx(hs, `### [${id}`);
  const fullBlocks = (order: string[]) => order.map(id => [id, HW_SUBSECTIONS]);

  // #22: a drop "after" a unit op lands on its first `#### Meta`.
  it('moves a block dropped onto a unit op to the end of that unit op', () => {
    const { headings, after } = outlineDrop(note, uo('UHW030'), uo('UHW010') + 1);
    expect(blocks(after)[0]).toEqual(['UHW010', []]);

    const fixed = fixOutlineDropNesting(note, after, headings, uo('UHW030'));
    expect(fixed).toBe(outlineDrop(note, uo('UHW030'), uo('UHW020')).after);
    expect(blocks(fixed!)).toEqual(fullBlocks(['UHW010', 'UHW030', 'UHW020']));
  });

  it('also fixes a downward drop in the middle of the last unit op', () => {
    const method = idx(hs, '#### Method', 2);
    const { headings, after } = outlineDrop(note, uo('UHW010'), method);
    const fixed = fixOutlineDropNesting(note, after, headings, uo('UHW010'));
    expect(fixed).toBe(outlineDrop(note, uo('UHW010'), idx(hs, '## Conclusions')).after);
    expect(blocks(fixed!)).toEqual(fullBlocks(['UHW020', 'UHW030', 'UHW010']));
  });

  it('leaves drops between blocks and at the end alone', () => {
    const between = outlineDrop(note, uo('UHW030'), uo('UHW010'));
    expect(fixOutlineDropNesting(note, between.after, between.headings, uo('UHW030'))).toBe(between.after);

    const atEnd = outlineDrop(note, uo('UHW010'), -1);
    expect(fixOutlineDropNesting(note, atEnd.after, atEnd.headings, uo('UHW010'))).toBe(atEnd.after);
  });

  it('keeps a subsection moved between subsections of another unit op', () => {
    const method = idx(hs, '#### Method', 0);
    const output = idx(hs, '#### Output', 1);
    const { headings, after } = outlineDrop(note, method, output);
    expect(fixOutlineDropNesting(note, after, headings, method)).toBe(after);
  });

  it('returns the text unchanged when nothing moved', () => {
    expect(fixOutlineDropNesting(note, note, hs, uo('UHW010'))).toBe(note);
  });

  it('returns null when the new text is not an Outline move of that block', () => {
    const edited = note.replace('Op UHW020', 'Op UHW020 edited');
    expect(fixOutlineDropNesting(note, edited, hs, uo('UHW030'))).toBeNull();
    expect(fixOutlineDropNesting(note, edited, hs, 999)).toBeNull();
  });
});
