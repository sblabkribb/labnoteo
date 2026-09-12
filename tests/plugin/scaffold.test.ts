/**
 * Pure reconciliation logic of the "Setup research automation" scaffold.
 *
 * `upsertManagedBlock` guards the one file the plugin shares with the user
 * (`AGENTS.md`): re-running the command must refresh ONLY the labnoteo marker
 * block and never clobber rules the user wrote around it. `appendMissingLines`
 * guards `.gitignore`/`CLAUDE.md` merges the same way.
 */
import { describe, it, expect } from 'vitest';
import { appendMissingLines, upsertManagedBlock } from '../../src/scaffold/scaffold';
import { MANAGED_BLOCK_BEGIN, MANAGED_BLOCK_END, SCAFFOLD_ASSETS } from '../../src/scaffold/assets';

const MARKERS = { begin: MANAGED_BLOCK_BEGIN, end: MANAGED_BLOCK_END };

describe('upsertManagedBlock', () => {
  it('creates the block as the whole content for a new/empty file', () => {
    const out = upsertManagedBlock('', 'rule A\nrule B', MARKERS);
    expect(out).toBe(`${MANAGED_BLOCK_BEGIN}\nrule A\nrule B\n${MANAGED_BLOCK_END}\n`);
  });

  it('appends the block to an existing file without markers, preserving content', () => {
    const existing = '# My own agent rules\n\n- never touch secrets\n';
    const out = upsertManagedBlock(existing, 'labnoteo rules', MARKERS);
    expect(out.startsWith(existing)).toBe(true);
    expect(out).toContain(`${MANAGED_BLOCK_BEGIN}\nlabnoteo rules\n${MANAGED_BLOCK_END}`);
  });

  it('replaces only the marker span, preserving text before and after', () => {
    const existing = [
      'user intro',
      MANAGED_BLOCK_BEGIN,
      'old rules',
      MANAGED_BLOCK_END,
      'user outro',
    ].join('\n');
    const out = upsertManagedBlock(existing, 'new rules', MARKERS);
    expect(out).toBe(
      ['user intro', MANAGED_BLOCK_BEGIN, 'new rules', MANAGED_BLOCK_END, 'user outro'].join('\n')
    );
  });

  it('is idempotent: applying the same inner content twice changes nothing', () => {
    const once = upsertManagedBlock('# mine\n', 'stable rules', MARKERS);
    const twice = upsertManagedBlock(once, 'stable rules', MARKERS);
    expect(twice).toBe(once);
  });

  it('handles regex special characters in the markers (parentheses, dashes)', () => {
    // The default markers contain `(`/`)`; replacement must still match them.
    const seeded = upsertManagedBlock('', 'v1', MARKERS);
    const updated = upsertManagedBlock(seeded, 'v2', MARKERS);
    expect(updated).toContain('v2');
    expect(updated).not.toContain('v1');
  });
});

describe('appendMissingLines', () => {
  it('appends only lines the file does not already contain', () => {
    const out = appendMissingLines('a\nb\n', 'b\nc\n');
    expect(out).toBe('a\nb\n\nc\n');
  });

  it('does not duplicate the CLAUDE.md @AGENTS.md import on re-run', () => {
    const existing = '# my claude notes\n@AGENTS.md\n';
    expect(appendMissingLines(existing, '@AGENTS.md\n')).toBe(existing);
  });

  it('creates the import when the user file lacks it', () => {
    const out = appendMissingLines('# my claude notes\n', '@AGENTS.md\n');
    expect(out).toContain('@AGENTS.md');
  });
});

describe('SCAFFOLD_ASSETS registry', () => {
  const byPath = new Map(SCAFFOLD_ASSETS.map(a => [a.vaultPath, a]));

  it('installs AGENTS.md as a managed block and CLAUDE.md as an append-only pointer', () => {
    expect(byPath.get('AGENTS.md')?.merge).toBe('managed-block');
    expect(byPath.get('CLAUDE.md')?.merge).toBe('append-missing');
    expect(byPath.get('CLAUDE.md')?.content).toBe('@AGENTS.md\n');
  });

  it('no longer ships the server-side AI gate assets (local agent replaces them)', () => {
    for (const gone of [
      'scripts/issue-gate.mjs',
      'scripts/wiki-propose.mjs',
      'ai/prompts/issue-gate.md',
      'ai/prompts/wiki-propose.md',
      'ai/schemas/issue-gate.schema.json',
      'ai/schemas/wiki-propose.schema.json',
    ]) {
      expect(byPath.has(gone)).toBe(false);
    }
  });

  it('keeps the deterministic server-side pipeline', () => {
    for (const kept of [
      'scripts/validate.mjs',
      'scripts/issue-sync.mjs',
      '.github/workflows/validate.yml',
      '.github/workflows/experiment-issues.yml',
      '.github/workflows/wiki-sync.yml',
    ]) {
      expect(byPath.has(kept)).toBe(true);
    }
  });
});
