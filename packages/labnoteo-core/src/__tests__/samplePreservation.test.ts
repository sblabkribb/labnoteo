import { describe, it, expect, vi } from 'vitest';
import { MemFileSystem } from '../fs/memFileSystem';
import { readSampleRegistry, readSamplesByType, saveSamplesFromDocument } from '../lib/sampleStorage';

const local = 'labnote/001_Test/resources/labsamples/DNA.json';
const global = 'resources/labsamples/DNA.json';
const note = 'labnote/001_Test/new.labnote.md';
const record = { type: 'DNA', alias: 'local', descriptions: ['keep'], sources: ['old.labnote.md'],
  location: 'A1', custom: { preserve: true }, aliasSources: { 'old.labnote.md': 'local' } };

describe('sample preservation (#598)', () => {
  it('keeps a local record shadowing Global, matches definitions ignoring case, and reports alias conflicts', async () => {
    const fs = new MemFileSystem({ [local]: JSON.stringify({ 'DNA-1': record }),
      [global]: JSON.stringify({ 'dna-1': { ...record, alias: 'global' } }) });
    const conflicts = await saveSamplesFromDocument(fs, note, '@DNA;dna-1;updated;new description', 'resources/labsamples');
    const saved = JSON.parse(await fs.read(local));
    expect(Object.keys(saved)).toEqual(['DNA-1']);
    expect(saved['DNA-1']).toMatchObject({ alias: 'updated', location: 'A1', custom: { preserve: true } });
    expect(conflicts).toHaveLength(1);
    expect(JSON.parse(await fs.read(global))['dna-1'].alias).toBe('global');
  });

  it('does not recreate a local definition after moving it to Global', async () => {
    const fs = new MemFileSystem({ [global]: JSON.stringify({ 'dna-1': record }) });
    await saveSamplesFromDocument(fs, note, '@DNA;DNA-1;local', 'resources/labsamples');
    expect(await fs.exists(local)).toBe(false);
  });

  it('reads case-colliding legacy records without writes', async () => {
    const raw = JSON.stringify({ 'DNA-1': record, 'dna-1': { alias: 'legacy' } });
    const fs = new MemFileSystem({ [local]: raw });
    const write = vi.spyOn(fs, 'write');
    expect(Object.keys(await readSamplesByType(fs, 'labnote/001_Test/resources/labsamples', 'DNA'))).toEqual(['DNA-1']);
    expect(write).not.toHaveBeenCalled();
    expect(await fs.read(local)).toBe(raw);
  });

  it.each(['', 'broken', '[]', 'null'])('distinguishes invalid ledger %j from a missing file', async raw => {
    const fs = new MemFileSystem({ [local]: raw });
    expect((await readSampleRegistry(fs, 'labnote/001_Test/resources/labsamples', 'DNA')).status).toBe('invalid');
    expect((await readSampleRegistry(fs, 'missing', 'DNA')).status).toBe('missing');
    expect(await fs.read(local)).toBe(raw);
  });

  it('preserves a broken local ledger and still saves another type', async () => {
    const fs = new MemFileSystem({ [local]: '{broken' });
    const errors = vi.fn();
    await saveSamplesFromDocument(fs, note, '@DNA;DNA-1;one\n@RNA;RNA-1;two', 'resources/labsamples', [], [], errors);
    expect(await fs.read(local)).toBe('{broken');
    expect(errors).toHaveBeenCalledTimes(1);
    expect(JSON.parse(await fs.read(local.replace('DNA.json', 'RNA.json')))).toHaveProperty('RNA-1');
  });
  it('does not create Local when the required Global registry cannot be read', async () => {
    const fs = new MemFileSystem({ [global]: 'null' });
    const errors = vi.fn();
    await saveSamplesFromDocument(fs, note, '@DNA;DNA-1;one', 'resources/labsamples', [], [], errors);
    expect(await fs.exists(local)).toBe(false);
    expect(await fs.read(global)).toBe('null');
    expect(errors).toHaveBeenCalledTimes(1);
  });
});
