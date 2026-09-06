/**
 * Plugin settings shape + defaults.
 *
 * Mirrors the companion VS Code extension's configuration where it makes sense
 * (`sampleTracking`, `customSampleTypes`) and adds the LLM provider settings
 * that the Obsidian build introduces (VS Code delegates LLM to Copilot Chat,
 * Obsidian talks to Ollama/OpenAI directly).
 */
export type LlmProviderKind = 'none' | 'ollama' | 'openai';

export interface LabnoteSettings {
  /** Show the Samples sidebar view. */
  sampleTracking: boolean;
  /** Extra sample types beyond the built-ins (DNA, RNA, …). */
  customSampleTypes: string[];
  /** Folder (vault-relative) that holds vault-global sample storage. */
  globalSampleFolder: string;

  // --- LLM ---
  llmProvider: LlmProviderKind;
  /** Base URL for the provider (Ollama default shown). */
  llmEndpoint: string;
  /** Model id, e.g. `llama3.1` or `gpt-4o-mini`. */
  llmModel: string;
  /** API key for OpenAI-compatible providers (never sent to Ollama). */
  llmApiKey: string;
  /** Expose the in-process MCP server for external MCP clients. */
  mcpEnabled: boolean;
}

export const DEFAULT_SETTINGS: LabnoteSettings = {
  sampleTracking: true,
  customSampleTypes: [],
  globalSampleFolder: 'resources/labsamples',
  llmProvider: 'none',
  llmEndpoint: 'http://localhost:11434',
  llmModel: 'llama3.1',
  llmApiKey: '',
  mcpEnabled: false,
};
