/**
 * The Outline-drop tidy must rewrite the file only for the first `modify` after
 * a drop on the Outline pane, and never for other writes (editor saves, git
 * pulls, the save that follows an undo).
 */
import { describe, it, expect } from 'vitest';
import { findUnitOpInsertOffset, rebuildUnitOpToc } from '@labnoteo/core';
import { createWorkflowContent } from '@labnoteo/core/lib/workflowStructure';
import { buildHwUnitOpMarkdown } from '@labnoteo/core/lib/unitOpTemplate';
import { createOutlineDropTidy, OUTLINE_DROP_ARM_MS } from '../../src/outlineDropTidy';

const WORKFLOW_PATH = 'labnote/001_Exp/001_WD010_Design.labnote.md';

function buildNote(order: string[]): string {
  let md = createWorkflowContent({ id: 'WD010', name: 'Design', description: 'desc' }, 'Dr. Kim');
  for (const opId of order) {
    const block = buildHwUnitOpMarkdown(
      { opId, opName: `Op ${opId}`, opDescription: 'step' },
      { experimenter: 'Dr. Kim', dateTime: '2026-09-29 10:00' }
    );
    const off = findUnitOpInsertOffset(md);
    md = rebuildUnitOpToc(md.slice(0, off) + block + md.slice(off));
  }
  return md;
}

/** Obsidian's Outline drop: move the `from` section before the `before` heading. */
function outlineDrag(v: string, from: string, before: string): string {
  const ensureBlank = (s: string) => (s.endsWith('\n\n') ? s : s.endsWith('\n') ? s + '\n' : s + '\n\n');
  const c = v.indexOf(from);
  const bodyStart = v.indexOf('\n', c) + 1;
  const u = bodyStart + v.slice(bodyStart).search(/^#{1,3} /m);
  const h = v.indexOf(before);
  const moved = ensureBlank(v.substring(c, u));
  return ensureBlank(v.substring(0, h)) + moved + v.substring(h, c) + v.substring(u);
}

function setup(opts: { enabled?: boolean } = {}) {
  let clock = 1000;
  const files = new Map<string, string>();
  const processed: string[] = [];
  const tidy = createOutlineDropTidy({
    isEnabled: () => opts.enabled ?? true,
    now: () => clock,
    process: async (path, fn) => {
      processed.push(path);
      files.set(path, fn(files.get(path) ?? ''));
    },
  });
  return { tidy, files, processed, advance: (ms: number) => (clock += ms) };
}

const dragged = () => outlineDrag(buildNote(['UHW010', 'UHW020', 'UHW030']), '### [UHW030', '### [UHW010');
const normBlank = (s: string) => s.replace(/\n{3,}/g, '\n\n');

describe('createOutlineDropTidy', () => {
  it('tidies the TOC and separators on the first modify after a drop', async () => {
    const { tidy, files, processed } = setup();
    files.set(WORKFLOW_PATH, dragged());
    tidy.arm(WORKFLOW_PATH);
    await tidy.onModify(WORKFLOW_PATH);

    expect(processed).toEqual([WORKFLOW_PATH]);
    expect(normBlank(files.get(WORKFLOW_PATH)!)).toBe(normBlank(buildNote(['UHW030', 'UHW010', 'UHW020'])));
  });

  it('handles only one modify per drop', async () => {
    const { tidy, files, processed } = setup();
    files.set(WORKFLOW_PATH, dragged());
    tidy.arm(WORKFLOW_PATH);
    await tidy.onModify(WORKFLOW_PATH);
    await tidy.onModify(WORKFLOW_PATH);
    expect(processed).toHaveLength(1);
  });

  it('ignores modifies without a drop, after expiry, when disabled or for non-workflow notes', async () => {
    const plain = setup();
    await plain.tidy.onModify(WORKFLOW_PATH);
    expect(plain.processed).toEqual([]);

    const expired = setup();
    expired.tidy.arm(WORKFLOW_PATH);
    expired.advance(OUTLINE_DROP_ARM_MS + 1);
    await expired.tidy.onModify(WORKFLOW_PATH);
    expect(expired.processed).toEqual([]);

    const off = setup({ enabled: false });
    off.tidy.arm(WORKFLOW_PATH);
    await off.tidy.onModify(WORKFLOW_PATH);
    expect(off.processed).toEqual([]);

    const readme = setup();
    readme.tidy.arm('labnote/001_Exp/README.labnote.md');
    await readme.tidy.onModify('labnote/001_Exp/README.labnote.md');
    expect(readme.processed).toEqual([]);
  });

  it('leaves an already tidy note unchanged', async () => {
    const { tidy, files } = setup();
    const note = buildNote(['UHW010', 'UHW020']);
    files.set(WORKFLOW_PATH, note);
    tidy.arm(WORKFLOW_PATH);
    await tidy.onModify(WORKFLOW_PATH);
    expect(files.get(WORKFLOW_PATH)).toBe(note);
  });
});
