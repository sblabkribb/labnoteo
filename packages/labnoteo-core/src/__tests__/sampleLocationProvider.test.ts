// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { LocalSampleLocationProvider } from '../sample/sampleLocationProvider';
import type { SampleRecord } from '../lib/sampleStorage';

function rec(location: string | null | undefined): SampleRecord {
  return { type: 'DNA', alias: null, descriptions: [], sources: [], location };
}

describe('LocalSampleLocationProvider', () => {
  const provider = new LocalSampleLocationProvider();

  it("returns the record's location when set", async () => {
    const loc = await provider.getLocation({ type: 'DNA', id: 'DNA-1', record: rec('Freezer-2 / Box-3') });
    expect(loc).toBe('Freezer-2 / Box-3');
  });

  it('returns null when the location is empty, whitespace, null, or missing', async () => {
    expect(await provider.getLocation({ type: 'DNA', id: 'DNA-1', record: rec(null) })).toBeNull();
    expect(await provider.getLocation({ type: 'DNA', id: 'DNA-1', record: rec('   ') })).toBeNull();
    expect(await provider.getLocation({ type: 'DNA', id: 'DNA-1', record: rec(undefined) })).toBeNull();
    expect(await provider.getLocation({ type: 'DNA', id: 'DNA-1' })).toBeNull();
  });
});
