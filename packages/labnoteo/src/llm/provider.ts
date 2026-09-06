/**
 * LLM provider abstraction for the Obsidian build.
 *
 * VS Code delegates AI to Copilot Chat; Obsidian talks to a local Ollama or an
 * OpenAI-compatible endpoint directly. All HTTP goes through Obsidian's
 * {@link requestUrl}, which bypasses CORS and works on both desktop and mobile.
 *
 * Requests are **non-streaming**: `requestUrl` has no streaming API, and a
 * single buffered response keeps behaviour identical on mobile (where there is
 * no Node/Electron fallback). Streaming, if ever added, must be desktop-guarded
 * behind `Platform.isDesktopApp` with a Node `fetch` path.
 */
import { requestUrl } from 'obsidian';
import type { LabnoteSettings } from '../settings';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
}

export interface LlmProvider {
  readonly name: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
}

/** Join a base URL and path with exactly one slash between them. */
export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  constructor(private readonly settings: LabnoteSettings) {}

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string> {
    const res = await requestUrl({
      url: joinUrl(this.settings.llmEndpoint, '/api/chat'),
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({
        model: this.settings.llmModel,
        messages,
        stream: false,
        options: opts?.temperature != null ? { temperature: opts.temperature } : undefined,
      }),
      throw: false,
    });
    if (res.status >= 400) {
      throw new Error(`Ollama request failed (${res.status}): ${res.text}`);
    }
    return res.json?.message?.content ?? '';
  }
}

class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  constructor(private readonly settings: LabnoteSettings) {}

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.settings.llmApiKey) {
      headers.Authorization = `Bearer ${this.settings.llmApiKey}`;
    }
    const res = await requestUrl({
      url: joinUrl(this.settings.llmEndpoint, '/v1/chat/completions'),
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.settings.llmModel,
        messages,
        temperature: opts?.temperature,
      }),
      throw: false,
    });
    if (res.status >= 400) {
      throw new Error(`OpenAI request failed (${res.status}): ${res.text}`);
    }
    return res.json?.choices?.[0]?.message?.content ?? '';
  }
}

/** Build the configured provider, or null when AI is disabled. */
export function createLlmProvider(settings: LabnoteSettings): LlmProvider | null {
  switch (settings.llmProvider) {
    case 'ollama':
      return new OllamaProvider(settings);
    case 'openai':
      return new OpenAiProvider(settings);
    default:
      return null;
  }
}
