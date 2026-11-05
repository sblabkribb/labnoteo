import { describe, it, expect } from 'vitest';
import { LastUpdatedTracker, type DocChange } from '../../src/lastUpdatedTracker';

const P = 'labnote/001_Exp/001_WD010_Design.labnote.md';
const typed: DocChange = { userEdit: true, dateEdited: false, fromHistory: false };
const reload: DocChange = { userEdit: false, dateEdited: false, fromHistory: false };
const undo: DocChange = { userEdit: false, dateEdited: false, fromHistory: true };
const dateTyped: DocChange = { userEdit: true, dateEdited: true, fromHistory: false };

describe('LastUpdatedTracker', () => {
  it('stamps after a user edit, once per burst', () => {
    const t = new LastUpdatedTracker();
    t.record(P, typed);
    t.record(P, reload);
    expect(t.consume(P)).toBe('stamp');
    expect(t.consume(P)).toBe('skip');
  });

  it('does not stamp without a user edit or without any record', () => {
    const t = new LastUpdatedTracker();
    t.record(P, reload);
    expect(t.consume(P)).toBe('skip');
    expect(t.consume('labnote/001_Exp/README.labnote.md')).toBe('skip');
  });

  it('does not stamp when the last change was undo/redo', () => {
    const t = new LastUpdatedTracker();
    t.record(P, typed);
    t.record(P, undo);
    expect(t.consume(P)).toBe('skip');
  });

  // #202
  it('keeps a hand-set date for that day, reports it once, and stamps again the next day', () => {
    let day = '2026-10-20';
    const t = new LastUpdatedTracker(() => day);
    t.record(P, dateTyped);
    expect(t.consume(P)).toBe('handSet');
    t.record(P, typed);
    expect(t.consume(P)).toBe('skip');
    day = '2026-10-21';
    t.record(P, typed);
    expect(t.consume(P)).toBe('stamp');
    t.record(P, typed);
    expect(t.consume(P)).toBe('stamp');
  });

  it('forgets hand-set dates on clear (the setting was toggled)', () => {
    const t = new LastUpdatedTracker(() => '2026-10-20');
    t.record(P, dateTyped);
    expect(t.consume(P)).toBe('handSet');
    t.clear();
    t.record(P, typed);
    expect(t.consume(P)).toBe('stamp');
  });

  it('tracks notes independently', () => {
    const t = new LastUpdatedTracker();
    const other = 'labnote/002_Other/README.labnote.md';
    t.record(P, dateTyped);
    t.record(other, typed);
    expect(t.consume(other)).toBe('stamp');
  });

  // #363: a workflow note's edit stamps its README too, unless set by hand today.
  it('says a note set by hand today keeps its date, until the next day', () => {
    let day = '2026-10-25';
    const t = new LastUpdatedTracker(() => day);
    const readme = 'labnote/001_Exp/README.labnote.md';
    expect(t.keepsHandSet(readme)).toBe(false);
    t.record(readme, dateTyped);
    expect(t.keepsHandSet(readme)).toBe(true);
    expect(t.keepsHandSet(P)).toBe(false);
    day = '2026-10-26';
    expect(t.keepsHandSet(readme)).toBe(false);
  });

  // #466: a deleted line read as "kept the date you set by hand".
  it('reports a deleted last_updated_date line once, and forgets it when a date is typed back', () => {
    const t = new LastUpdatedTracker(() => '2026-10-27');
    t.record(P, { ...typed, dateRemoved: true });
    expect(t.consume(P)).toBe('removed');
    t.record(P, typed);
    expect(t.consume(P)).toBe('stamp');
    t.record(P, dateTyped);
    t.record(P, { ...typed, dateRemoved: true });
    expect(t.consume(P)).toBe('removed');
  });

  // #545: every stamp that is left out can say so, but the user hears it once.
  describe('claimHandSetNotice', () => {
    it('is given out once a day, and again the next day', () => {
      let day = '2026-10-28';
      const t = new LastUpdatedTracker(() => day);
      t.record(P, dateTyped);
      expect(t.claimHandSetNotice(P)).toBe(true);
      expect(t.claimHandSetNotice(P)).toBe(false);
      day = '2026-10-29';
      expect(t.claimHandSetNotice(P)).toBe(false); // the date is no longer kept
      t.record(P, dateTyped);
      expect(t.claimHandSetNotice(P)).toBe(true);
    });

    it('is refused for a note whose date was never set by hand', () => {
      const t = new LastUpdatedTracker(() => '2026-10-28');
      t.record(P, typed);
      expect(t.claimHandSetNotice(P)).toBe(false);
    });

    it('shares the one notice with the debounced stamp, either way round', () => {
      const t = new LastUpdatedTracker(() => '2026-10-28');
      t.record(P, dateTyped);
      expect(t.claimHandSetNotice(P)).toBe(true);
      expect(t.consume(P)).toBe('skip');

      const u = new LastUpdatedTracker(() => '2026-10-28');
      u.record(P, dateTyped);
      expect(u.consume(P)).toBe('handSet');
      expect(u.claimHandSetNotice(P)).toBe(false);
    });
  });

  // #466: an emptied value read as a hand-set date, so it stayed empty all day.
  it('stamps an emptied date again, whatever was held against the note', () => {
    const cleared: DocChange = { ...typed, dateCleared: true };
    const t = new LastUpdatedTracker(() => '2026-10-27');
    t.record(P, dateTyped);
    t.record(P, cleared);
    expect(t.keepsHandSet(P)).toBe(false);
    expect(t.consume(P)).toBe('stamp');
    // Emptying the value is also how a deleted line is asked back (#466).
    t.record(P, { ...typed, dateRemoved: true });
    t.record(P, cleared);
    expect(t.consume(P)).toBe('stamp');
  });
});
