// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import {
  getSeoulDateString,
  findDateFieldsInDocument,
  findMetaDateFieldInLine,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
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

describe('findMetaDateFieldInLine', () => {
  it('locates the value inside the quotes', () => {
    const line = "- Start_date: '2026-09-06 23:31'";
    const m = findMetaDateFieldInLine(line);
    expect(m).not.toBeNull();
    expect(m!.field).toBe('Start_date');
    expect(m!.value).toBe('2026-09-06 23:31');
    expect(m!.quote).toBe("'");
    expect(line.slice(m!.valueStart, m!.valueEnd)).toBe('2026-09-06 23:31');
  });

  it('returns an empty range between the quotes of an unset field', () => {
    const line = "- End_date: ''";
    const m = findMetaDateFieldInLine(line)!;
    expect(m.field).toBe('End_date');
    expect(m.value).toBe('');
    expect(m.valueStart).toBe(m.valueEnd);
    expect(line.slice(0, m.valueStart)).toBe("- End_date: '");
  });

  it('handles an unquoted value and trailing whitespace', () => {
    const m = findMetaDateFieldInLine('  - end_date: 2026-09-06   ')!;
    expect(m.field).toBe('End_date');
    expect(m.value).toBe('2026-09-06');
    expect(m.quote).toBeNull();
  });

  it('ignores lines that are not Meta date bullets', () => {
    expect(findMetaDateFieldInLine('- Experimenter: Haseong')).toBeNull();
    expect(findMetaDateFieldInLine("start_date: '2026-09-06'")).toBeNull();
    expect(findMetaDateFieldInLine('The Start_date: is set later')).toBeNull();
  });
});

describe('datetime-local conversions', () => {
  it('round-trips a stored value', () => {
    expect(toDateTimeLocalValue('2026-09-06 23:31')).toBe('2026-09-06T23:31');
    expect(fromDateTimeLocalValue('2026-09-06T23:31')).toBe('2026-09-06 23:31');
  });

  it('defaults a date-only value to midnight', () => {
    expect(toDateTimeLocalValue('2026-09-06')).toBe('2026-09-06T00:00');
  });

  it('returns an empty string for unusable input', () => {
    expect(toDateTimeLocalValue('')).toBe('');
    expect(toDateTimeLocalValue('not a date')).toBe('');
    expect(fromDateTimeLocalValue('2026-09-06')).toBe('');
  });
});
