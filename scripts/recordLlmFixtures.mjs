#!/usr/bin/env node
/**
 * Record real LLM responses into `tests/fixtures/llm/`.
 *
 * The provider tests replay these bodies through the actual `LlmProvider` code.
 * Recording them from a live server is what makes those tests evidence about
 * the providers rather than about our reading of their documentation.
 *
 * Not run by CI: it needs a live Ollama and/or an OpenAI key, and model output
 * is non-deterministic. Run it by hand when adding a provider or when a payload
 * looks like it may have changed.
 *
 *   OLLAMA_MODEL=qwen3 node scripts/recordLlmFixtures.mjs ollama
 *   OPENAI_API_KEY=sk-... node scripts/recordLlmFixtures.mjs openai
 *   node scripts/recordLlmFixtures.mjs            # both
 *
 * Env: OLLAMA_URL (default http://localhost:11434), OLLAMA_MODEL (default qwen3),
 *      OPENAI_URL (default https://api.openai.com), OPENAI_MODEL (default gpt-4o-mini),
 *      OPENAI_API_KEY (required for the openai target).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests/fixtures/llm');

/**
 * Fixed across recordings so a refreshed fixture stays comparable to the one it
 * replaces. Changing these means the tests' structural assertions need to
 * change too.
 */
const TOOL = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get the current weather for a location.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name, e.g. Toronto.' },
        format: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['location', 'format'],
    },
  },
};

const CASES = [
  { name: 'plain', prompt: 'Reply with exactly: hello', tools: false },
  {
    name: 'tool-call',
    prompt: 'What is the weather in Toronto in celsius? Use the tool.',
    tools: true,
  },
  {
    name: 'parallel-tool-calls',
    prompt: 'What is the weather in Toronto and in Paris, in celsius? Use the tool for each city.',
    tools: true,
  },
];

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function recordOllama() {
  const base = (process.env.OLLAMA_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
  const model = process.env.OLLAMA_MODEL ?? 'qwen3';

  for (const c of CASES) {
    const body = await postJson(`${base}/api/chat`, {
      model,
      messages: [{ role: 'user', content: c.prompt }],
      stream: false,
      ...(c.tools ? { tools: [TOOL] } : {}),
      options: { temperature: 0 },
    });
    write('ollama', c.name, `ollama ${model} @ ${base}`, body);
  }
}

async function recordOpenAi() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is required to record openai fixtures');
  const base = (process.env.OPENAI_URL ?? 'https://api.openai.com').replace(/\/+$/, '');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  for (const c of CASES) {
    const body = await postJson(
      `${base}/v1/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: c.prompt }],
        temperature: 0,
        ...(c.tools ? { tools: [TOOL] } : {}),
      },
      { Authorization: `Bearer ${key}` }
    );
    // The key must never reach a fixture that gets committed.
    write('openai', c.name, `openai ${model} @ ${base}`, body);
  }
}

function write(provider, caseName, recordedFrom, body) {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${provider}-${caseName}.json`);
  const fixture = {
    provider,
    case: caseName,
    recordedFrom,
    recordedAt: new Date().toISOString(),
    body,
  };
  writeFileSync(path, JSON.stringify(fixture, null, 2) + '\n');
  console.log(`[record] ${provider}-${caseName}.json`);
}

const targets = process.argv.slice(2);
const wanted = targets.length > 0 ? targets : ['ollama', 'openai'];

for (const target of wanted) {
  try {
    if (target === 'ollama') await recordOllama();
    else if (target === 'openai') await recordOpenAi();
    else throw new Error(`unknown target: ${target}`);
  } catch (err) {
    // One unreachable provider must not discard the other's recordings.
    console.error(`[record] ${target} failed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  }
}
