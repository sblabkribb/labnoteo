// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { findSampleReferenceAt } from '../sample/sampleSuggest';

const TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];

describe('findSampleReferenceAt', () => {
  it('returns the reference when the column is inside an id', () => {
    const line = 'used DNA-123;sampleA for the assembly';
    // "DNA-123" starts at index 5; pick a column inside it.
    const hit = findSampleReferenceAt(line, 8, TYPES);
    expect(hit).toEqual({ type: 'DNA', id: 'DNA-123', start: 5, end: 12 });
  });

  it('matches at the boundary column (end inclusive)', () => {
    const line = 'DNA-123 done';
    expect(findSampleReferenceAt(line, 0, TYPES)?.id).toBe('DNA-123');
    expect(findSampleReferenceAt(line, 7, TYPES)?.id).toBe('DNA-123');
  });

  it('returns null when the column is outside any id', () => {
    const line = 'used DNA-123 here';
    expect(findSampleReferenceAt(line, 2, TYPES)).toBeNull();
    expect(findSampleReferenceAt(line, 15, TYPES)).toBeNull();
  });

  it('picks the id under the cursor among multiple references', () => {
    const line = 'DNA-1 and RNA-2 and Plasmid-3';
    expect(findSampleReferenceAt(line, 11, TYPES)?.id).toBe('RNA-2');
    expect(findSampleReferenceAt(line, 22, TYPES)?.id).toBe('Plasmid-3');
  });
});
