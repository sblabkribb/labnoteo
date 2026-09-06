// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { replaceSectionBody } from '../sections/sectionEdit';

const doc = [
  '## [WD010 Design]',
  '',
  '## Related Unit Operations',
  '',
  '---',
  '',
  '### [UHW010 Spin]',
  '',
  '#### Method',
  '',
  'old method text',
  'second line',
  '',
  '#### Results',
  '',
  'old results',
  '',
  '## Conclusions and Discussion',
  '',
].join('\n');

describe('replaceSectionBody', () => {
  it('replaces the body of a #### section, stopping at the next heading', () => {
    const { ok, md } = replaceSectionBody(doc, 'Method', 'NEW method');
    expect(ok).toBe(true);
    expect(md).toContain('#### Method\n\nNEW method\n');
    // Did not swallow the following section.
    expect(md).toContain('#### Results');
    expect(md).toContain('old results');
    // Old body gone.
    expect(md).not.toContain('old method text');
    expect(md).not.toContain('second line');
  });

  it('replaces the last section up to EOF', () => {
    const { ok, md } = replaceSectionBody(doc, 'Results', 'NEW results');
    expect(ok).toBe(true);
    expect(md).toContain('#### Results\n\nNEW results\n');
    expect(md).not.toContain('old results');
    // Earlier sections untouched.
    expect(md).toContain('old method text');
  });

  it('stops a ## section at the next same-or-higher heading (keeps nested ###)', () => {
    const md = ['## A', '', 'body', '', '### sub', '', 'subbody', '', '## B', '', 'bbody', ''].join(
      '\n'
    );
    const out = replaceSectionBody(md, 'A', 'NEW');
    expect(out.ok).toBe(true);
    // Everything from A up to (but not including) `## B` replaced.
    expect(out.md).toContain('## A\n\nNEW\n');
    expect(out.md).not.toContain('### sub');
    expect(out.md).toContain('## B');
    expect(out.md).toContain('bbody');
  });

  it('returns ok=false when the heading is absent', () => {
    const out = replaceSectionBody(doc, 'Nonexistent', 'x');
    expect(out.ok).toBe(false);
    expect(out.md).toBe(doc);
  });

  it('preserves CRLF line endings', () => {
    const md = '#### Method\r\n\r\nold\r\n\r\n#### Next\r\n';
    const out = replaceSectionBody(md, 'Method', 'new');
    expect(out.ok).toBe(true);
    expect(out.md).toContain('\r\n');
    expect(out.md).toContain('new');
    expect(out.md).not.toContain('old');
  });

  it('ignores ATX headings inside fenced code blocks', () => {
    // A heading-looking line inside a code fence must neither be picked as the
    // section start nor treated as the section boundary.
    const md = [
      '## Real',
      '',
      'before',
      '',
      '```md',
      '## Fake heading in code',
      '```',
      '',
      'after',
      '',
      '## End',
      '',
    ].join('\n');
    const out = replaceSectionBody(md, 'Real', 'NEW');
    expect(out.ok).toBe(true);
    // Body spans past the fenced fake heading, up to the real `## End`.
    expect(out.md).toContain('## Real\n\nNEW\n');
    expect(out.md).toContain('## End');
    // The fenced content is gone (it was inside the replaced body) but was never
    // mistaken for a boundary; the real end heading survived.
    expect(out.md).not.toContain('before');
    expect(out.md).not.toContain('after');
  });

  it('does not select a heading that only appears inside a code fence', () => {
    const md = ['# Doc', '', '```', '## Method', 'x', '```', ''].join('\n');
    const out = replaceSectionBody(md, 'Method', 'NEW');
    expect(out.ok).toBe(false);
    expect(out.md).toBe(md);
  });
});
