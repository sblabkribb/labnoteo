// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import {
  parseSampleTrigger,
  buildSampleCompletionEntries,
  findSampleIdRanges,
} from '../sample/sampleSuggest';

const TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];

describe('parseSampleTrigger', () => {
  it('detects a specific type prefix at end of line', () => {
    const t = parseSampleTrigger('@dna:', TYPES);
    expect(t).toBeDefined();
    expect(t!.typesToSearch).toEqual(['DNA']);
    expect(t!.searchTerm).toBe('');
    expect(t!.startCol).toBe(0);
  });

  it('captures the search term and is case-insensitive', () => {
    const t = parseSampleTrigger('@DNA:abc', TYPES);
    expect(t!.typesToSearch).toEqual(['DNA']);
    expect(t!.searchTerm).toBe('abc');
  });

  it('treats @sample as all types', () => {
    const t = parseSampleTrigger('@sample:', TYPES);
    expect(t!.typesToSearch).toEqual(TYPES);
  });

  it('maps @item to Labware', () => {
    const t = parseSampleTrigger('@item:', TYPES);
    expect(t!.typesToSearch).toEqual(['Labware']);
  });

  it('matches without a delimiter (trigger before ; or :)', () => {
    const t = parseSampleTrigger('@rna', TYPES);
    expect(t!.typesToSearch).toEqual(['RNA']);
  });

  it('reports the start column when text precedes the trigger', () => {
    const t = parseSampleTrigger('note @rna;', TYPES);
    expect(t!.startCol).toBe(5);
  });

  it('returns undefined without an @', () => {
    expect(parseSampleTrigger('no trigger', TYPES)).toBeUndefined();
  });

  it('returns undefined for an unknown prefix', () => {
    expect(parseSampleTrigger('@unknown:', TYPES)).toBeUndefined();
  });

  it('honours custom types passed in', () => {
    const t = parseSampleTrigger('@cellline:', [...TYPES, 'CellLine']);
    expect(t!.typesToSearch).toEqual(['CellLine']);
  });
});

describe('buildSampleCompletionEntries', () => {
  it('formats label and insert text with alias + description', () => {
    const trigger = parseSampleTrigger('@dna:', TYPES)!;
    const entries = buildSampleCompletionEntries(trigger, {
      DNA: [{ id: 'DNA-1', alias: 'plasmidA', description: 'first' }],
    });
    expect(entries).toEqual([
      { type: 'DNA', id: 'DNA-1', label: 'DNA-1 (plasmidA) - first', insertText: 'DNA-1;plasmidA' },
    ]);
  });

  it('omits alias/description when absent', () => {
    const trigger = parseSampleTrigger('@dna:', TYPES)!;
    const entries = buildSampleCompletionEntries(trigger, {
      DNA: [{ id: 'DNA-9', alias: null }],
    });
    expect(entries[0]).toEqual({
      type: 'DNA',
      id: 'DNA-9',
      label: 'DNA-9',
      insertText: 'DNA-9',
    });
  });

  it('filters by the (case-insensitive) search term against the label', () => {
    const trigger = parseSampleTrigger('@dna:plasmid', TYPES)!;
    const entries = buildSampleCompletionEntries(trigger, {
      DNA: [
        { id: 'DNA-1', alias: 'plasmidA' },
        { id: 'DNA-2', alias: 'primerX' },
      ],
    });
    expect(entries.map(e => e.id)).toEqual(['DNA-1']);
  });
});

describe('findSampleIdRanges', () => {
  it('locates sample IDs for the given types with correct offsets', () => {
    const text = 'see DNA-12 and RNA-3 here';
    const ranges = findSampleIdRanges(text, ['DNA', 'RNA']);
    expect(ranges).toEqual([
      { start: 4, end: 10, type: 'DNA' },
      { start: 15, end: 20, type: 'RNA' },
    ]);
  });

  it('matches collision-resolved IDs (DNA-1-2)', () => {
    const ranges = findSampleIdRanges('x DNA-1-2 y', ['DNA']);
    expect(ranges).toEqual([{ start: 2, end: 9, type: 'DNA' }]);
  });

  it('returns empty when no IDs present', () => {
    expect(findSampleIdRanges('nothing here', ['DNA'])).toEqual([]);
  });
});
