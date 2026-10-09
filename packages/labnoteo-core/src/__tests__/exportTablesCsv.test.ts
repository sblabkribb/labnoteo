// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { extractMarkdownTables, tableToCsv, UTF8_BOM } from '../lib/exportTablesCsv';

describe('tableToCsv', () => {
  const rows = [
    ['조성', '탄소원', 'OD600'],
    ['M1', '포도당', '1.82'],
  ];

  it('emits plain UTF-8 CSV by default', () => {
    expect(tableToCsv(rows)).toBe('조성,탄소원,OD600\nM1,포도당,1.82\n');
  });

  // #24: Korean Windows Excel reads BOM-less UTF-8 as CP949 and garbles Hangul.
  it('prefixes a UTF-8 BOM when asked, leaving the body unchanged', () => {
    const csv = tableToCsv(rows, { bom: true });
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv.slice(UTF8_BOM.length)).toBe(tableToCsv(rows));
    expect(new TextEncoder().encode(csv).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
  });

  it('quotes cells containing commas, quotes, or newlines', () => {
    expect(tableToCsv([['a,b', 'say "hi"', 'plain']])).toBe('"a,b","say ""hi""",plain\n');
  });
});

describe('extractMarkdownTables', () => {
  it('finds a pipe table and drops the separator row', () => {
    const md = '| 조성 | 비고 |\n|---|---|\n| M1 | ok |\n';
    expect(extractMarkdownTables(md)).toEqual([{ index: 0, rows: [['조성', '비고'], ['M1', 'ok']] }]);
  });
});
