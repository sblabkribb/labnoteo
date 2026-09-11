// Globals convention (no `import ... from 'vitest'`) — matches the core tests.
//
// Pins the pure JSON extraction of the thin chat client (tolerant of fences /
// surrounding prose from small local models).
import { extractJson } from './chat';

describe('extractJson', () => {
  it('parses a bare JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses JSON inside a ```json fence', () => {
    expect(extractJson('```json\n{"needs_issue":true}\n```')).toEqual({ needs_issue: true });
  });
  it('parses JSON surrounded by prose', () => {
    expect(extractJson('Sure! {"reason":"ok"} done')).toEqual({ reason: 'ok' });
  });
  it('returns undefined when nothing parseable is present', () => {
    expect(extractJson('no json here')).toBeUndefined();
    expect(extractJson('{ broken')).toBeUndefined();
  });
});
