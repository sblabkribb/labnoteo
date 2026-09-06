/**
 * Extracts GFM pipe tables from a Markdown body and converts them to CSV.
 * Pure functions, no `vscode` import.
 */

export interface CsvTable {
  /** 0-based index of the table within the source document (0 = first table). */
  index: number;
  /** Rows including the header row (the `---` separator row is dropped). */
  rows: string[][];
}

const SEPARATOR_ROW_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

function stripEdgePipes(line: string): string {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s;
}

/** Splits a single pipe-table row into cells, honoring `\|` as an escaped literal pipe. */
function splitTableRow(line: string): string[] {
  const stripped = stripEdgePipes(line);
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '\\' && stripped[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Finds every GFM pipe table in `markdown` (header row + `---` separator +
 * zero or more data rows). Tables are matched in document order.
 */
export function extractMarkdownTables(markdown: string): CsvTable[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const tables: CsvTable[] = [];

  let i = 0;
  while (i < lines.length) {
    const isHeaderLine = lines[i].trim().startsWith('|');
    const nextIsSeparator = i + 1 < lines.length && SEPARATOR_ROW_RE.test(lines[i + 1]);
    if (isHeaderLine && nextIsSeparator) {
      const rows: string[][] = [splitTableRow(lines[i])];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      tables.push({ index: tables.length, rows });
      continue;
    }
    i++;
  }

  return tables;
}

function escapeCsvCell(cell: string): string {
  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function tableToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n') + '\n';
}
