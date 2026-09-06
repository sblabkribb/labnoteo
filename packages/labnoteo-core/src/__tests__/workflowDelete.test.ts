// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { removeWorkflowFromReadme } from '../lib/workflowDelete';

const README = [
  '# Experiment',
  '',
  '## Related Workflows',
  '',
  '> Instructions stay put.',
  '',
  '- [ ] [Design](./001_WD010_Design.labnote.md)',
  '- [x] [Assay](./002_WS010_Assay.labnote.md)',
  '',
  '## Notes',
  '',
  'body',
].join('\n');

describe('removeWorkflowFromReadme', () => {
  it('removes only the matching checklist entry, preserving order and siblings', () => {
    const res = removeWorkflowFromReadme(README, '001_WD010_Design.labnote.md');
    expect(res.changed).toBe(true);
    expect(res.content).not.toContain('001_WD010_Design.labnote.md');
    // The sibling entry, instruction blockquote and other sections are intact.
    expect(res.content).toContain('- [x] [Assay](./002_WS010_Assay.labnote.md)');
    expect(res.content).toContain('> Instructions stay put.');
    expect(res.content).toContain('## Notes');
  });

  it('returns changed:false when the file is not listed', () => {
    const res = removeWorkflowFromReadme(README, '999_WD999_Missing.labnote.md');
    expect(res.changed).toBe(false);
    expect(res.content).toBe(README);
  });

  it('matches a non-ASCII filename that the strict checklist parser would reject', () => {
    const md = ['## Related Workflows', '', '- [ ] [실험](./003_WD010_실험.labnote.md)'].join('\n');
    const res = removeWorkflowFromReadme(md, '003_WD010_실험.labnote.md');
    expect(res.changed).toBe(true);
    expect(res.content).not.toContain('003_WD010_실험.labnote.md');
  });
});
