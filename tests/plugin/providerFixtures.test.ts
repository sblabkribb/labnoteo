/**
 * Replay recorded provider responses through the real `LlmProvider` code.
 *
 * `provider.test.ts` builds its payloads by hand, so it proves we handle the
 * shapes the docs describe. These fixtures are (or can be refreshed into) bodies
 * a real server actually sent — see `tests/fixtures/llm/README.md` for how to
 * re-record and how to read the `recordedFrom` provenance field.
 *
 * Assertions are structural rather than literal so a refreshed recording does
 * not churn the suite, while a genuine change in the wire format still fails.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLlmProvider, type ChatResult } from '../../src/llm/provider';
import { DEFAULT_SETTINGS, type LabnoteSettings } from '../../src/settings';
import { __setRequestUrlHandler } from '../stubs/obsidian';

interface Fixture {
  provider: 'ollama' | 'openai';
  case: 'plain' | 'tool-call' | 'parallel-tool-calls';
  recordedFrom: string;
  recordedAt?: string;
  body: unknown;
}

const FIXTURE_DIR = join(__dirname, '../fixtures/llm');

const fixtures: Fixture[] = readdirSync(FIXTURE_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as Fixture);

/** Feed a fixture body back as the HTTP response and run the provider on it. */
async function replay(fixture: Fixture): Promise<ChatResult> {
  __setRequestUrlHandler(() => ({
    status: 200,
    text: JSON.stringify(fixture.body),
    json: fixture.body,
    headers: {},
  }));
  const settings: LabnoteSettings = { ...DEFAULT_SETTINGS, llmProvider: fixture.provider };
  const provider = createLlmProvider(settings);
  return provider!.chat([{ role: 'user', content: 'recorded prompt' }], { temperature: 0 });
}

const find = (provider: string, name: string): Fixture => {
  const f = fixtures.find(x => x.provider === provider && x.case === name);
  if (!f) throw new Error(`missing fixture: ${provider}-${name}`);
  return f;
};

afterEach(() => {
  __setRequestUrlHandler(null);
});

describe('recorded provider responses', () => {
  it('covers both providers across all three cases', () => {
    const seen = fixtures.map(f => `${f.provider}-${f.case}`).sort();
    expect(seen).toEqual([
      'ollama-parallel-tool-calls',
      'ollama-plain',
      'ollama-tool-call',
      'openai-parallel-tool-calls',
      'openai-plain',
      'openai-tool-call',
    ]);
  });

  it.each(['ollama', 'openai'] as const)('%s: a plain reply yields text and no tool calls', async p => {
    const out = await replay(find(p, 'plain'));
    expect(out.content).toBe('hello');
    expect(out.toolCalls).toEqual([]);
  });

  it.each(['ollama', 'openai'] as const)('%s: a tool turn is normalized to one call', async p => {
    const out = await replay(find(p, 'tool-call'));

    expect(out.toolCalls).toHaveLength(1);
    expect(out.toolCalls[0].name).toBe('get_weather');
    expect(String(out.toolCalls[0].arguments.location).toLowerCase()).toContain('toronto');
    expect(out.toolCalls[0].id).toBeTruthy();
  });

  it.each(['ollama', 'openai'] as const)('%s: parallel calls keep distinct ids', async p => {
    const out = await replay(find(p, 'parallel-tool-calls'));

    expect(out.toolCalls.length).toBeGreaterThanOrEqual(2);
    // Ids pair results to calls; duplicates would silently mis-route a result.
    expect(new Set(out.toolCalls.map(c => c.id)).size).toBe(out.toolCalls.length);
    for (const c of out.toolCalls) expect(c.name).toBe('get_weather');
  });

  // The two provider-specific quirks that a hand-written test is most likely to
  // get wrong, pinned against recorded payloads.
  it('openai: content is null on a tool turn and becomes an empty string', async () => {
    const fixture = find('openai', 'tool-call');
    const message = (fixture.body as { choices: Array<{ message: { content: unknown } }> }).choices[0]
      .message;
    expect(message.content).toBeNull();

    expect((await replay(fixture)).content).toBe('');
  });

  it('ollama: ids are absent on the wire and synthesized by the normalizer', async () => {
    const fixture = find('ollama', 'parallel-tool-calls');
    const raw = (fixture.body as { message: { tool_calls: Array<{ id?: unknown }> } }).message
      .tool_calls;
    for (const call of raw) expect(call.id).toBeUndefined();

    const out = await replay(fixture);
    expect(out.toolCalls.map(c => c.id)).toEqual(['call_0', 'call_1']);
  });

  it('openai: real ids from the wire are preserved, not replaced', async () => {
    const out = await replay(find('openai', 'tool-call'));
    expect(out.toolCalls[0].id).toBe('call_9k2Lx8QvT1aBcDeF');
  });

  it('flags fixtures that are still documentation examples rather than recordings', () => {
    // Not a failure: it keeps the suite honest about what these prove. Refresh
    // with `node scripts/recordLlmFixtures.mjs` against a live server.
    const seeded = fixtures.filter(f => f.recordedFrom === 'documentation-example');
    if (seeded.length > 0) {
      console.warn(
        `[fixtures] ${seeded.length}/${fixtures.length} are documentation examples, not live recordings: ` +
          seeded.map(f => `${f.provider}-${f.case}`).join(', ')
      );
    }
    for (const f of fixtures) expect(f.recordedFrom).toBeTruthy();
  });
});
