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
});
