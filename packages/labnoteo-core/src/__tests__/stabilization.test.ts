import { describe, it, expect } from 'vitest';
import { planDateInsertion } from '../sections/frontMatter';
import { planIssueMarkerInsertion, parseIssueMarkers } from '../lib/issueMarker';
import { scanMarkdownTableRanges } from '../lib/exportTablesCsv';
import { damagedUnitOpHeadings } from '../sections/unitOpDiagnosis';
import { diagnoseExperimentPath } from '../lib/labnoteStructure';
import { diagnoseStatus } from '../lib/experimentStatus';
import { buildExperimentTree } from '../tree/treeModel';

describe('stabilization regressions', () => {
  const unit = '### [UHW010 Spin] one\n#### Meta\n- Start_date: today\n#### Input\n- sample\n#### Method\nspin';
  it('protects Meta properties, including selections starting before Meta', () => {
    const to = unit.indexOf('today') + 2;
    expect(planIssueMarkerInsertion(unit, unit.indexOf('Start_date'), to, 'ISS-test')).toEqual({ reason: 'meta' });
    expect(planIssueMarkerInsertion(unit, 0, to, 'ISS-test')).toEqual({ reason: 'meta' });
    expect(planIssueMarkerInsertion('Start_date: discuss this', 0, 0, 'ISS-test', 'topic')).not.toHaveProperty('reason');
  });
  it('keeps selected prose and multiple lines when inserting a date', () => {
    expect(planDateInsertion('keep\nthis text', 0, 14, '2026-11-13')).toEqual({ from: 14, to: 14, text: ' 2026-11-13' });
  });
  it('diagnoses damaged template headings, excluding examples', () => {
    expect(damagedUnitOpHeadings(unit)).toEqual([]);
    const broken = unit.replace('[UHW010 Spin]', 'Spin');
    expect(damagedUnitOpHeadings(broken)).toEqual([{ line: 0, title: 'Spin one' }]);
    expect(damagedUnitOpHeadings(`~~~md\n${broken}\n~~~`)).toEqual([]);
    expect(damagedUnitOpHeadings(`<!--\n${broken}\n-->`)).toEqual([]);
  });
  it('diagnoses a nested folder without changing the scope of its files', () => {
    const path = 'labnote/001_A/images/002_B';
    expect(diagnoseExperimentPath(path, { isFolder: true })).toEqual({ kind: 'nested', folder: path });
    expect(diagnoseExperimentPath(`${path}/note.md`)).toEqual({ kind: 'ok', folder: 'labnote/001_A' });
  });
  it.each(['\n', '\r\n'])('uses the same table ranges and marker policy with newline %j', newline => {
    const table = ['Name | Value', '--- | ---', 'A | 1 @issue;ISS-test;check **value**', ''].join(newline);
    expect(scanMarkdownTableRanges(table)).toEqual([{ startLine: 0, endLine: 3, kind: 'table' }]);
    const scan = parseIssueMarkers(table.replace(/\r\n/g, '\n'));
    expect(scan.markers).toEqual([]); expect(scan.malformed[0]).toMatchObject({ line: 3, reason: 'table' });
    expect(planIssueMarkerInsertion(table, 0, 0, 'ISS-next', 'topic')).toEqual({ reason: 'table' });
  });
  it.each([[undefined, 'missing'], [null, 'non-string'], [['in-progress'], 'non-string'], ['', 'empty'], ['Completed', 'invalid'], ['completed', 'valid']])('distinguishes status %j', (value, expected) => {
    expect(diagnoseStatus(value)).toBe(expected);
  });
  it('keeps non-text and empty status groups separate from missing status in the workflow tree', () => {
    const tree = buildExperimentTree([
      { folder: 'labnote/001_A', statusProblem: 'non-string' },
      { folder: 'labnote/002_B', statusProblem: 'empty', status: '' },
      { folder: 'labnote/003_C' },
    ]);
    expect(tree.children).toHaveLength(3);
    expect(tree.children!.map(group => group.label).join('\n')).toContain('(status must be text)');
    expect(tree.children!.find(group => group.label.includes('status must be text'))!.children![0].tooltip).toContain('status must be text');
  });
});
