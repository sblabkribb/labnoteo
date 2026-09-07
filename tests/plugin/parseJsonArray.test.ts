/**
 * `parseJsonArray` is the only thing standing between a model's free-form reply
 * and `create_sample` writing to the vault. Models routinely ignore "respond
 * with ONLY JSON", so the messy shapes below are the realistic inputs, not
 * edge cases.
 */
import { describe, it, expect } from 'vitest';
import { parseJsonArray } from '../../src/llm/commands';

describe('parseJsonArray', () => {
  it('parses a bare JSON array', () => {
    expect(parseJsonArray('[{"type":"DNA","id":"DNA-1"}]')).toEqual([{ type: 'DNA', id: 'DNA-1' }]);
  });

  it('parses an empty array', () => {
    expect(parseJsonArray('[]')).toEqual([]);
  });

  it('strips a ```json fence', () => {
    expect(parseJsonArray('```json\n[{"type":"RNA"}]\n```')).toEqual([{ type: 'RNA' }]);
  });

  it('strips a bare ``` fence', () => {
    expect(parseJsonArray('```\n[{"type":"RNA"}]\n```')).toEqual([{ type: 'RNA' }]);
  });

  it('finds the array inside surrounding prose', () => {
    const raw = 'Sure! Here are the samples I found:\n[{"type":"Plasmid","id":"P-1"}]\nLet me know.';
    expect(parseJsonArray(raw)).toEqual([{ type: 'Plasmid', id: 'P-1' }]);
  });

  it('keeps every field the extractor cares about', () => {
    expect(
      parseJsonArray('[{"type":"DNA","id":"DNA-1","alias":"pUC19","description":"a plasmid"}]')
    ).toEqual([{ type: 'DNA', id: 'DNA-1', alias: 'pUC19', description: 'a plasmid' }]);
  });

  it('handles nested objects without truncating at the first bracket', () => {
    const raw = '[{"type":"DNA","description":"contains [brackets] inside"}]';
    expect(parseJsonArray(raw)).toEqual([
      { type: 'DNA', description: 'contains [brackets] inside' },
    ]);
  });

  it('returns empty for prose with no array at all', () => {
    expect(parseJsonArray('I could not find any samples in this note.')).toEqual([]);
  });

  it('returns empty for malformed JSON rather than throwing', () => {
    expect(parseJsonArray('[{"type":"DNA",]')).toEqual([]);
    expect(parseJsonArray('[{"type": "DNA"')).toEqual([]);
  });

  it('returns empty for a JSON object that is not an array', () => {
    expect(parseJsonArray('{"type":"DNA"}')).toEqual([]);
  });

  it('returns empty for an empty or whitespace reply', () => {
    expect(parseJsonArray('')).toEqual([]);
    expect(parseJsonArray('   \n  ')).toEqual([]);
  });
});
