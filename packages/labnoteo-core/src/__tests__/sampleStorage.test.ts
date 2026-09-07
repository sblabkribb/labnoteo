// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
//
// Phase 0 regression safety net for `lib/sampleStorage.ts` (643 lines, 0 direct
// tests before this file). Correct behaviour is locked in with plain `it(...)`.
// Reproduced bugs are pinned with `it.fails(...)`, which passes now *because*
// the assertion throws against current behaviour; Phase 1-1/1-3 will fix them
// and flip these to normal `it(...)`.
import {
  extractSampleInfoFromText,
  mergeSampleDatabases,
  buildSampleDatabase,
  saveSamplesFromDocument,
  loadSamplesByType,
  saveSamplesByType,
  upsertSampleRecord,
  deleteSampleRecord,
  type SampleDatabase,
} from '../lib/sampleStorage';
import { MemFileSystem } from '../fs/memFileSystem';

describe('extractSampleInfoFromText', () => {
  it('extracts a full @type;id;alias;description definition', () => {
    const out = extractSampleInfoFromText('@DNA;DNA-1;pUC19;my plasmid');
    expect(out).toEqual([
      { id: 'DNA-1', type: 'DNA', alias: 'pUC19', description: 'my plasmid' },
    ]);
  });

  it('extracts a bare id reference with no alias/description', () => {
    const out = extractSampleInfoFromText('see DNA-2 in the fridge');
    expect(out).toEqual([{ id: 'DNA-2', type: 'DNA', alias: null, description: null }]);
  });

  it('extracts multiple types from one document', () => {
    const out = extractSampleInfoFromText('@DNA;DNA-1;a\n@RNA;RNA-9;b');
    const ids = out.map(s => s.id).sort();
    expect(ids).toEqual(['DNA-1', 'RNA-9']);
  });

  // Fixed in Phase 1-3: a definition (with alias/desc) now upgrades an earlier
  // bare reference to the same id instead of being dropped by "first match
  // wins".
  it('prefers the definition over an earlier bare reference', () => {
    const out = extractSampleInfoFromText('See DNA-100 later.\n\n@DNA;DNA-100;pUC19;my plasmid\n');
    expect(out).toHaveLength(1);
    expect(out[0].alias).toBe('pUC19');
    expect(out[0].description).toBe('my plasmid');
  });

  // Fixed in Phase 1-3: the dedup key is now case-normalized, so `DNA-55` and
  // `dna-55` collapse to a single logical sample.
  it('treats ids that differ only in case as one sample', () => {
    const out = extractSampleInfoFromText('@DNA;DNA-55;a\n@DNA;dna-55;b');
    expect(out).toHaveLength(1);
  });
});

describe('buildSampleDatabase', () => {
  it('groups extracted samples by type and records the source file', () => {
    const samples = extractSampleInfoFromText('@DNA;DNA-1;a;desc');
    const db = buildSampleDatabase(samples, 'note.labnote.md');
    expect(db).toEqual({
      DNA: {
        'DNA-1': {
          type: 'DNA',
          alias: 'a',
          descriptions: ['desc'],
          sources: ['note.labnote.md'],
        },
      },
    });
  });
});

describe('mergeSampleDatabases', () => {
  it('overwrites alias, unions sources, and puts new descriptions first', () => {
    const existing: SampleDatabase = {
      DNA: { 'DNA-1': { type: 'DNA', alias: 'old', descriptions: ['d1'], sources: ['fileA'] } },
    };
    const incoming: SampleDatabase = {
      DNA: { 'DNA-1': { type: 'DNA', alias: 'new', descriptions: ['d2'], sources: ['fileB'] } },
    };
    const merged = mergeSampleDatabases(existing, incoming);
    expect(merged.DNA['DNA-1'].alias).toBe('new');
    expect(merged.DNA['DNA-1'].descriptions).toEqual(['d2', 'd1']);
    expect(merged.DNA['DNA-1'].sources).toEqual(['fileA', 'fileB']);
  });

  it('does not mutate the existing database', () => {
    const existing: SampleDatabase = {
      DNA: { 'DNA-1': { type: 'DNA', alias: 'old', descriptions: ['d1'], sources: ['fileA'] } },
    };
    mergeSampleDatabases(existing, {
      DNA: { 'DNA-1': { type: 'DNA', alias: 'new', descriptions: [], sources: ['fileB'] } },
    });
    expect(existing.DNA['DNA-1'].alias).toBe('old');
    expect(existing.DNA['DNA-1'].sources).toEqual(['fileA']);
  });
});

describe('saveSamplesFromDocument + loadSamplesByType (MemFileSystem round-trip)', () => {
  const DOC = 'labnote/001_Exp/note.labnote.md';
  const FOLDER = 'labnote/001_Exp/resources/labsamples';

  it('persists extracted samples to {Type}.json and loads them back', async () => {
    const fs = new MemFileSystem();
    await saveSamplesFromDocument(fs, DOC, '@DNA;DNA-1;pUC19;my plasmid');

    const records = await loadSamplesByType(fs, FOLDER, 'DNA');
    expect(records['DNA-1']).toEqual({
      type: 'DNA',
      alias: 'pUC19',
      descriptions: ['my plasmid'],
      sources: ['note.labnote.md'],
    });
  });

  it('merges a second document into the same {Type}.json', async () => {
    const fs = new MemFileSystem();
    await saveSamplesFromDocument(fs, DOC, '@DNA;DNA-1;a');
    await saveSamplesFromDocument(fs, 'labnote/001_Exp/other.labnote.md', '@DNA;DNA-2;b');

    const records = await loadSamplesByType(fs, FOLDER, 'DNA');
    expect(Object.keys(records).sort()).toEqual(['DNA-1', 'DNA-2']);
  });

  it('returns an empty object when the type file does not exist', async () => {
    const fs = new MemFileSystem();
    expect(await loadSamplesByType(fs, FOLDER, 'DNA')).toEqual({});
  });

  it('normalizes legacy records missing sources/descriptions without throwing', async () => {
    // A pre-normalization record with no `sources`/`descriptions` used to cause
    // `record.sources.length` TypeErrors downstream. Phase 7 normalizes on load.
    const fs = new MemFileSystem();
    await fs.write(
      `${FOLDER}/DNA.json`,
      JSON.stringify({ 'DNA-9': { type: 'DNA', alias: 'legacy' } })
    );
    const records = await loadSamplesByType(fs, FOLDER, 'DNA');
    expect(records['DNA-9']).toEqual({
      type: 'DNA',
      alias: 'legacy',
      descriptions: [],
      sources: [],
    });
  });
});

describe('saveSamplesByType type validation', () => {
  // Fixed in Phase 1-1: `type` is validated before use, so a traversal payload
  // (path separators / `..`) is rejected before any write.
  it('rejects a traversal payload in the sample type', async () => {
    const fs = new MemFileSystem();
    await expect(
      saveSamplesByType(fs, 'labnote/001_Exp/resources/labsamples', '../../../../evil', {})
    ).rejects.toThrow();
  });
});

describe('upsertSampleRecord (Phase 3 atomic merge)', () => {
  const FOLDER = 'labnote/001_Exp/resources/labsamples';

  it('creates a record when the file is absent', async () => {
    const fs = new MemFileSystem();
    await upsertSampleRecord(fs, FOLDER, 'DNA', 'DNA-1', {
      alias: 'pUC19',
      description: 'my plasmid',
      sources: ['note.labnote.md'],
    });
    const records = await loadSamplesByType(fs, FOLDER, 'DNA');
    expect(records['DNA-1']).toEqual({
      type: 'DNA',
      alias: 'pUC19',
      descriptions: ['my plasmid'],
      sources: ['note.labnote.md'],
    });
  });

  it('preserves existing sources when `sources` is omitted (sidebar edit)', async () => {
    const fs = new MemFileSystem();
    await upsertSampleRecord(fs, FOLDER, 'DNA', 'DNA-1', {
      alias: 'a',
      description: null,
      sources: ['note.labnote.md'],
    });
    await upsertSampleRecord(fs, FOLDER, 'DNA', 'DNA-1', { alias: 'b', description: 'new desc' });

    const records = await loadSamplesByType(fs, FOLDER, 'DNA');
    expect(records['DNA-1'].alias).toBe('b');
    expect(records['DNA-1'].descriptions).toEqual(['new desc']);
    expect(records['DNA-1'].sources).toEqual(['note.labnote.md']);
  });

  it('does not drop concurrent upserts of different ids into one file', async () => {
    const fs = new MemFileSystem();
    await Promise.all([
      upsertSampleRecord(fs, FOLDER, 'DNA', 'DNA-1', { alias: 'a', description: null }),
      upsertSampleRecord(fs, FOLDER, 'DNA', 'DNA-2', { alias: 'b', description: null }),
      upsertSampleRecord(fs, FOLDER, 'DNA', 'DNA-3', { alias: 'c', description: null }),
    ]);
    const records = await loadSamplesByType(fs, FOLDER, 'DNA');
    expect(Object.keys(records).sort()).toEqual(['DNA-1', 'DNA-2', 'DNA-3']);
  });
});

describe('deleteSampleRecord', () => {
  const FOLDER = 'labnote/001_Exp/resources/labsamples';

  const seed = async (fs: MemFileSystem, ids: string[]): Promise<void> => {
    for (const id of ids) {
      await upsertSampleRecord(fs, FOLDER, 'DNA', id, { alias: id, description: null });
    }
  };

  it('removes only the requested id', async () => {
    const fs = new MemFileSystem();
    await seed(fs, ['DNA-1', 'DNA-2']);

    expect(await deleteSampleRecord(fs, FOLDER, 'DNA', 'DNA-1')).toBe(true);
    expect(Object.keys(await loadSamplesByType(fs, FOLDER, 'DNA'))).toEqual(['DNA-2']);
  });

  it('reports false for an unknown id and leaves the file untouched', async () => {
    const fs = new MemFileSystem();
    await seed(fs, ['DNA-1']);
    const before = fs.snapshot();

    expect(await deleteSampleRecord(fs, FOLDER, 'DNA', 'DNA-9')).toBe(false);
    expect(fs.snapshot()).toEqual(before);
  });

  it('reports false when the file does not exist', async () => {
    const fs = new MemFileSystem();
    expect(await deleteSampleRecord(fs, FOLDER, 'DNA', 'DNA-1')).toBe(false);
    // Must not create an empty `{Type}.json` just to find nothing in it.
    expect(fs.snapshot()).toEqual({});
  });

  it('does not clobber a concurrent upsert of a different id', async () => {
    const fs = new MemFileSystem();
    await seed(fs, ['DNA-1', 'DNA-2']);

    await Promise.all([
      deleteSampleRecord(fs, FOLDER, 'DNA', 'DNA-1'),
      upsertSampleRecord(fs, FOLDER, 'DNA', 'DNA-3', { alias: 'c', description: null }),
    ]);

    const records = await loadSamplesByType(fs, FOLDER, 'DNA');
    expect(Object.keys(records).sort()).toEqual(['DNA-2', 'DNA-3']);
  });

  it('rejects a traversal payload in the sample type', async () => {
    const fs = new MemFileSystem();
    await expect(deleteSampleRecord(fs, FOLDER, '../../evil', 'x')).rejects.toThrow();
  });
});
