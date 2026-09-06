// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import {
  getSeoulDateString,
  findDateFieldsInDocument,
  updateAllDateFields,
} from '../lib/dateUtils';

describe('getSeoulDateString', () => {
  it('formats an explicit date as YYYY-MM-DD', () => {
    // 2024-01-02T00:00:00Z is still 2024-01-02 in Asia/Seoul (UTC+9).
    expect(getSeoulDateString(new Date('2024-01-02T00:00:00Z'))).toBe('2024-01-02');
  });
});

describe('findDateFieldsInDocument', () => {
  it('does not double-match a field due to case-insensitive duplicates', () => {
    // Previously `end_date` and `End_date` were both listed with an `i` flag, so
    // one `end_date:` line produced two matches.
    const content = ['---', "end_date: '2024-01-01'", '---'].join('\n');
    const matches = findDateFieldsInDocument(content);
    expect(matches).toHaveLength(1);
    expect(matches[0].field.toLowerCase()).toBe('end_date');
  });

  it('finds each distinct front-matter date field once', () => {
    const content = [
      '---',
      "created_date: '2024-01-01'",
      "last_updated_date: '2024-01-02'",
      "end_date: '2024-01-03'",
      '---',
    ].join('\n');
    const fields = findDateFieldsInDocument(content).map(m => m.field.toLowerCase());
    expect(fields.sort()).toEqual(['created_date', 'end_date', 'last_updated_date']);
  });
});

describe('updateAllDateFields', () => {
  it('rewrites the field only inside the front matter block', () => {
    const content = [
      '---',
      "last_updated_date: '2024-01-01'",
      '---',
      '',
      '# Body',
      '',
      '```yaml',
      "last_updated_date: '2024-01-01'",
      '```',
    ].join('\n');
    const out = updateAllDateFields(content, 'last_updated_date', '2025-05-05');
    // Front matter updated…
    expect(out).toContain("last_updated_date: '2025-05-05'");
    // …but the code-block occurrence is untouched.
    expect(out).toContain("```yaml\nlast_updated_date: '2024-01-01'\n```");
  });

  it('leaves content unchanged when there is no front matter', () => {
    const content = ['# Body', '', "last_updated_date: '2024-01-01'"].join('\n');
    expect(updateAllDateFields(content, 'last_updated_date', '2025-05-05')).toBe(content);
  });
});
