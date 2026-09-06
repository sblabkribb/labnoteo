import {
  buildUnitOpTocLine,
  appendUnitOpToWorkflowToc,
  rebuildUnitOpToc,
  locateInsertedUnitOpHeading,
} from '../sections/workflowSectionParser';
import { createWorkflowContent } from '../lib/workflowStructure';

describe('buildUnitOpTocLine', () => {
  it('matches the serializeWorkflowMd slug/label format', () => {
    expect(buildUnitOpTocLine('UHW010', 'Centrifugation')).toBe(
      '- [UHW010 Centrifugation](#uhw010-centrifugation)'
    );
  });

  it('includes the alias in label and slug', () => {
    expect(buildUnitOpTocLine('USW010', 'Read Mapping', 'BWA')).toBe(
      '- [USW010 Read Mapping | BWA](#usw010-read-mapping-bwa)'
    );
  });

  it('strips punctuation from the slug', () => {
    expect(buildUnitOpTocLine('UHW020', 'PCR (95C)')).toBe(
      '- [UHW020 PCR (95C)](#uhw020-pcr-95c)'
    );
  });
});

describe('appendUnitOpToWorkflowToc', () => {
  const fresh = createWorkflowContent(
    { id: 'WD010', name: 'Design', description: 'desc' },
    'Dr. Kim'
  );

  it('inserts an entry into the fresh template section, preserving hints and other sections', () => {
    const out = appendUnitOpToWorkflowToc(fresh, 'UHW010', 'Centrifugation');
    expect(out).toContain('- [UHW010 Centrifugation](#uhw010-centrifugation)');
    // Hints preserved.
    expect(out).toContain('> Unit operations are appended here automatically.');
    // Other sections untouched.
    expect(out).toContain('## Conclusions and Discussion');
    // Entry sits inside the Related Unit Operations section (before Conclusions).
    expect(out.indexOf('#uhw010-centrifugation')).toBeLessThan(
      out.indexOf('## Conclusions and Discussion')
    );
  });

  it('accumulates multiple entries (grouped, in order)', () => {
    let out = appendUnitOpToWorkflowToc(fresh, 'UHW010', 'Spin');
    out = appendUnitOpToWorkflowToc(out, 'USW020', 'Align', 'BWA');
    const first = out.indexOf('- [UHW010 Spin]');
    const second = out.indexOf('- [USW020 Align | BWA]');
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it('appends after existing serialize-style entries', () => {
    const md = [
      '## Related Unit Operations',
      '',
      '- [UHW010 A](#uhw010-a)',
      '',
      '---',
      '',
      '### [UHW010 A]',
      '',
    ].join('\n');
    const out = appendUnitOpToWorkflowToc(md, 'USW020', 'B');
    const lines = out.split('\n');
    // New entry directly after the last existing entry, before the blank+---.
    expect(lines[2]).toBe('- [UHW010 A](#uhw010-a)');
    expect(lines[3]).toBe('- [USW020 B](#usw020-b)');
    expect(lines[4]).toBe('');
    expect(lines[5]).toBe('---');
  });

  it('returns the document unchanged when the section is absent', () => {
    const md = '# Just a note\n\nNo TOC here.\n';
    expect(appendUnitOpToWorkflowToc(md, 'UHW010', 'X')).toBe(md);
  });

  it('preserves CRLF line endings', () => {
    const md = '## Related Unit Operations\r\n\r\n## Conclusions and Discussion\r\n';
    const out = appendUnitOpToWorkflowToc(md, 'UHW010', 'X');
    expect(out).toContain('\r\n');
    expect(out).toContain('- [UHW010 X](#uhw010-x)');
  });
});

describe('rebuildUnitOpToc', () => {
  it('reorders the TOC to match document heading order (A, C, B)', () => {
    const md = [
      '## Related Unit Operations',
      '',
      '- [UHW010 A](#uhw010-a)',
      '- [USW020 B](#usw020-b)',
      '',
      '---',
      '',
      '### [UHW010 A]',
      '',
      '> d',
      '',
      '---',
      '',
      '### [UHW030 C]',
      '',
      '> d',
      '',
      '---',
      '',
      '### [USW020 B]',
      '',
      '> d',
      '',
      '## Conclusions and Discussion',
      '',
    ].join('\n');

    const out = rebuildUnitOpToc(md);
    const a = out.indexOf('- [UHW010 A](#uhw010-a)');
    const c = out.indexOf('- [UHW030 C](#uhw030-c)');
    const b = out.indexOf('- [USW020 B](#usw020-b)');
    expect(a).toBeGreaterThan(-1);
    expect(c).toBeGreaterThan(a);
    expect(b).toBeGreaterThan(c);
    // The reordered entries stay inside the section (before Conclusions).
    expect(b).toBeLessThan(out.indexOf('## Conclusions and Discussion'));
  });

  it('reflects reversed document order (B, A)', () => {
    const md = [
      '## Related Unit Operations',
      '',
      '- [UHW010 A](#uhw010-a)',
      '- [USW020 B](#usw020-b)',
      '',
      '---',
      '### [USW020 B]',
      '---',
      '### [UHW010 A]',
    ].join('\n');

    const out = rebuildUnitOpToc(md);
    expect(out.indexOf('- [USW020 B]')).toBeLessThan(out.indexOf('- [UHW010 A]'));
  });

  it('includes the alias from an aliased heading', () => {
    const md = [
      '## Related Unit Operations',
      '',
      '- [USW010 Read Mapping](#usw010-read-mapping)',
      '',
      '---',
      '### [USW010 Read Mapping] BWA',
    ].join('\n');

    const out = rebuildUnitOpToc(md);
    expect(out).toContain('- [USW010 Read Mapping | BWA](#usw010-read-mapping-bwa)');
  });

  it('leaves a fresh template unchanged (no headings, hints preserved)', () => {
    const fresh = createWorkflowContent({ id: 'WD010', name: 'Design', description: 'desc' }, 'Dr. Kim');
    const out = rebuildUnitOpToc(fresh);
    expect(out).toBe(fresh);
    expect(out).toContain('> Unit operations are appended here automatically.');
  });

  it('returns the document unchanged when the section is absent', () => {
    const md = '# Just a note\n\nNo TOC here.\n';
    expect(rebuildUnitOpToc(md)).toBe(md);
  });

  it('preserves CRLF line endings', () => {
    const md = [
      '## Related Unit Operations',
      '',
      '- [UHW010 A](#uhw010-a)',
      '',
      '---',
      '### [UHW010 A]',
    ].join('\r\n');
    const out = rebuildUnitOpToc(md);
    expect(out).toContain('\r\n');
    expect(out).toContain('- [UHW010 A](#uhw010-a)');
  });
});

describe('locateInsertedUnitOpHeading', () => {
  it('maps the inserted heading offset into the rebuilt text', () => {
    const head = [
      '## Related Unit Operations',
      '',
      '- [UHW010 A](#uhw010-a)',
      '',
      '---',
      '',
      '### [UHW010 A]',
      '',
      '> first',
      '',
    ].join('\n');
    const inserted = ['', '---', '', '### [USW020 B]', '', '> second', ''].join('\n');
    const tail = ['', '## Conclusions and Discussion', ''].join('\n');
    const mdAfterInsert = head + inserted + tail;
    const cursorBefore = head.length;

    const rebuilt = rebuildUnitOpToc(mdAfterInsert);
    const off = locateInsertedUnitOpHeading(mdAfterInsert, cursorBefore, rebuilt);

    expect(off).toBeGreaterThan(-1);
    expect(rebuilt.slice(off)).toMatch(/^### \[USW020 B\]/);
    // TOC grew by one entry, yet the mapped offset still lands on the heading.
    expect(rebuilt).toContain('- [USW020 B](#usw020-b)');
  });

  it('picks the inserted duplicate (by cursor), not the pre-existing one', () => {
    const head = [
      '## Related Unit Operations',
      '',
      '- [UHW010 A](#uhw010-a)',
      '',
      '---',
      '',
      '### [UHW010 A]',
      '',
      '> first',
      '',
    ].join('\n');
    const inserted = ['', '---', '', '### [UHW010 A]', '', '> second', ''].join('\n');
    const mdAfterInsert = head + inserted + '\n## Conclusions and Discussion\n';
    const cursorBefore = head.length;

    const rebuilt = rebuildUnitOpToc(mdAfterInsert);
    const off = locateInsertedUnitOpHeading(mdAfterInsert, cursorBefore, rebuilt);
    const firstOcc = rebuilt.indexOf('### [UHW010 A]');

    expect(off).toBeGreaterThan(firstOcc);
    expect(rebuilt.slice(off)).toMatch(/^### \[UHW010 A\][\s\S]*second/);
  });

  it('returns -1 when no heading exists at/after the cursor', () => {
    const md = '## Related Unit Operations\n\n> hint\n\n## Conclusions and Discussion\n';
    expect(locateInsertedUnitOpHeading(md, 0, md)).toBe(-1);
  });
});
