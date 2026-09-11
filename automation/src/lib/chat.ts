/**
 * Thin OpenAI-compatible chat client for the vault automation (issue-gate,
 * wiki-propose).
 *
 * A deliberate, minimal re-implementation of a STABLE wire contract
 * (`POST /v1/chat/completions`) — NOT drift. It is intentionally NOT the plugin
 * `src/llm/provider.ts`/`runAgent`: the automation only needs a single
 * request→text (or →JSON) call against a self-hosted local LLM (Ollama/vLLM),
 * with no agent loop, tools, or Obsidian `requestUrl`. Zero deps (Node 18+
 * global `fetch`).
 */

/** A single chat message in the OpenAI schema. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Client configuration, typically sourced from repo variables / env. */
export interface ChatClientOptions {
  /** Base URL of the OpenAI-compatible server, e.g. `http://localhost:11434/v1`. */
  endpoint: string;
  /** Model name, e.g. `qwen2.5:14b`. */
  model: string;
  /** Optional bearer key (usually omitted for a local endpoint). */
  apiKey?: string;
  /** Sampling temperature (default 0 for deterministic classification). */
  temperature?: number;
}

/** Build client options from env vars set by the workflow (repo variables). */
export function chatOptionsFromEnv(): ChatClientOptions {
  const endpoint = process.env.LLM_ENDPOINT?.trim();
  const model = process.env.LLM_MODEL?.trim();
  if (!endpoint) throw new Error('LLM_ENDPOINT is not set (repo variable).');
  if (!model) throw new Error('LLM_MODEL is not set (repo variable).');
  return {
    endpoint,
    model,
    apiKey: process.env.LLM_API_KEY?.trim() || undefined,
    temperature: 0,
  };
}

/**
 * Send `messages` and return the assistant's raw text content. Throws on a
 * non-2xx response or an empty completion so callers fail loudly in CI.
 */
export async function chat(
  opts: ChatClientOptions,
  messages: ChatMessage[]
): Promise<string> {
  const url = `${opts.endpoint.replace(/\/+$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0,
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('Chat response contained no content.');
  }
  return content;
}

/**
 * Extract the first JSON object from a model reply, tolerating ```json fences or
 * surrounding prose (small local models rarely honour a pure-JSON instruction).
 * Returns undefined when nothing parseable is found. Pure/testable.
 */
export function extractJson<T = unknown>(text: string): T | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return undefined;
  }
}

/** Send `messages` and parse the reply as JSON (via {@link extractJson}). */
export async function chatJson<T = unknown>(
  opts: ChatClientOptions,
  messages: ChatMessage[]
): Promise<T | undefined> {
  return extractJson<T>(await chat(opts, messages));
}
