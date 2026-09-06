// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { createTranslator, formatMessage } from '../i18n/translator';

describe('formatMessage', () => {
  it('substitutes positional placeholders', () => {
    expect(formatMessage('Inserted: {0} {1}', ['UHW010', 'Spin'])).toBe(
      'Inserted: UHW010 Spin'
    );
  });

  it('leaves unmatched placeholders intact', () => {
    expect(formatMessage('a {0} b {1}', ['x'])).toBe('a x b {1}');
  });

  it('returns the template unchanged with no args', () => {
    expect(formatMessage('plain', [])).toBe('plain');
  });
});

describe('createTranslator', () => {
  const t = createTranslator({
    'Yes': '예',
    'Unit operation inserted: {0} {1}': '단위 작업 삽입됨: {0} {1}',
  });

  it('translates known keys', () => {
    expect(t('Yes')).toBe('예');
  });

  it('translates and substitutes', () => {
    expect(t('Unit operation inserted: {0} {1}', 'UHW010', 'Spin')).toBe(
      '단위 작업 삽입됨: UHW010 Spin'
    );
  });

  it('falls through to the English key when untranslated', () => {
    expect(t('Some untranslated {0}', 42)).toBe('Some untranslated 42');
  });

  it('defaults to identity-with-substitution when no catalog given', () => {
    const en = createTranslator();
    expect(en('Hello {0}', 'world')).toBe('Hello world');
  });
});
