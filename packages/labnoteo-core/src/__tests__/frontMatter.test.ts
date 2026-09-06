// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
//
// Phase 0 regression safety net for the front-matter primitives in
// `sections/frontMatter.ts`. This is a NEW file, deliberately separate from
// `frontMatterYaml.test.ts` (which exercises the lossy parseWorkflowMd /
// serializeWorkflowMd removed in Phase 2). Here we only touch
// `parseFrontMatterYaml` / `serializeFrontMatterEntry`.
//
// Correct behaviour is locked in with plain `it(...)`. Reproduced data-loss
// bugs are pinned with `it.fails(...)`: they pass now *because* the assertion
// throws against current behaviour, and Phase 1-2 (yaml.dump for scalars +
// line-anchored closing fence) will flip them to normal `it(...)`.
import { parseFrontMatterYaml, serializeFrontMatterEntry } from '../sections/frontMatter';

describe('parseFrontMatterYaml', () => {
  it('parses a simple block and strips it from the body', () => {
    const { frontMatter, body } = parseFrontMatterYaml('---\ntitle: X\nn: 3\n---\nBody line\n');
    expect(frontMatter).toEqual({ title: 'X', n: 3 });
    expect(body).toBe('Body line\n');
  });

  it('returns an empty object and the full body when there is no front matter', () => {
    const md = 'No front matter here.\n';
    const { frontMatter, body } = parseFrontMatterYaml(md);
    expect(frontMatter).toEqual({});
    expect(body).toBe(md);
  });

  it('keeps ISO dates as plain strings (CORE_SCHEMA)', () => {
    const { frontMatter } = parseFrontMatterYaml('---\ncreated_date: 2026-01-15\n---\n');
    expect(frontMatter.created_date).toBe('2026-01-15');
  });

  // Fixed in Phase 1-2: the closing-fence regex is now line-anchored, so a
  // `----` (4-dash) line is NOT a valid closing fence — there is no front
  // matter and the body is left intact.
  it('does not treat a ---- (4-dash) line as the closing fence', () => {
    const { frontMatter, body } = parseFrontMatterYaml('---\na: 1\n----\nbody text\n');
    expect(frontMatter).toEqual({});
    expect(body).toContain('a: 1');
  });
});

describe('serializeFrontMatterEntry', () => {
  it('emits a compact one-liner for a scalar', () => {
    expect(serializeFrontMatterEntry('title', 'Protein Folding')).toBe('title: Protein Folding');
  });

  it('emits proper YAML for a list and round-trips it', () => {
    const line = serializeFrontMatterEntry('tags', ['pcr', 'failed']);
    const { frontMatter } = parseFrontMatterYaml(`---\n${line}\n---\n`);
    expect(frontMatter.tags).toEqual(['pcr', 'failed']);
  });

  it('emits an empty value for null/undefined', () => {
    expect(serializeFrontMatterEntry('end_date', null)).toBe('end_date: ');
    expect(serializeFrontMatterEntry('end_date', undefined)).toBe('end_date: ');
  });

  // Fixed in Phase 1-2: a scalar value containing a colon is now routed through
  // yaml.dump, so it is quoted (`title: 'Exp: run 1'`) and survives a
  // serialize -> parse round-trip instead of resetting the block to {}.
  it('round-trips a scalar value that contains a colon', () => {
    const line = serializeFrontMatterEntry('title', 'Exp: run 1');
    const { frontMatter } = parseFrontMatterYaml(`---\n${line}\n---\nbody`);
    expect(frontMatter.title).toBe('Exp: run 1');
  });
});
