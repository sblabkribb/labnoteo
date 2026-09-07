# Labnote Assistant for Obsidian (labnoteo)

**Version 0.77.0**

A Markdown-based lab notebook for Obsidian, with sample tracking, workflow checklists, unit operations, and optional LLM assistance for biology and bioinformatics experiments.

This repository is the Obsidian port of the Labnote Assistant. It shares its platform-neutral parsing and domain logic with a companion VS Code extension, but is fully self-contained here.

## Features

- **Sample tracking**: A dedicated Samples sidebar view. Define, insert, edit, and search samples (DNA, RNA, Plasmid, and custom types). Move samples between local (note) and global scope.
- **Workflow checklists**: A Workflows sidebar view to create and manage numbered workflow notes, insert unit operations, and keep the table of contents in sync.
- **Unit operations**: Insert hardware/software unit operations from a bundled catalog, with automatic heading normalization and TOC updates.
- **CSV export**: Export tables from a note to CSV.
- **Sample suggestions & highlighting**: Inline suggestions and highlighting for sample references while editing.
- **LLM assistance (optional)**: Draft methods, summarize results, and extract samples via Ollama or OpenAI. The *Ask assistant* command goes further and lets the model call Labnote's own tools to reach a goal, confirming with you before any write. The same tools are available to external MCP clients.

## Commands

| Command | Description |
|---|---|
| Insert date | Insert the current date |
| Insert date and time | Insert the current timestamp |
| Create experiment | Create a new `.labnote.md` experiment note |
| Create workflow | Create a numbered workflow note |
| Insert unit operation | Insert a unit operation from the catalog |
| Export tables to CSV | Export note tables to CSV |
| AI: Draft Method section | Draft an experimental method with the configured LLM |
| AI: Summarize results | Summarize results with the configured LLM |
| AI: Extract sample definitions | Extract samples from note text with the configured LLM |
| AI: Ask assistant (uses tools) | State a goal and let the model reach it with Labnote's tools |
| Toggle MCP server | Start/stop the local MCP server |
| Open workflow view / Open sample view | Reveal the sidebar views |

> Renaming a workflow file in the file explorer automatically reorders the README checklist to match the new number prefix; deleting one removes its checklist entry and prunes the samples it defined.

## Installation (manual)

1. Download `main.js`, `manifest.json`, `versions.json`, and `styles.css` from a release.
2. Create `.obsidian/plugins/labnoteo/` inside your vault and copy the four files into it.
3. In Obsidian, go to Settings → Community plugins and enable **Labnote Assistant**.

## Settings

**Samples**

- **Sample tracking**: Show the Samples sidebar view.
- **Custom sample types**: Add custom sample types beyond the built-ins.
- **Global sample folder**: Vault-relative folder holding vault-wide sample storage (default `resources/labsamples`).

**AI provider**

- **Provider**: `none`, `ollama`, or `openai`. The plugin talks to the provider directly.
- **Ollama endpoint** / **OpenAI endpoint**: Base URLs, kept in separate fields so switching provider can never send your OpenAI key to a local Ollama address.
- **Model**: Model id, e.g. `qwen3` or `gpt-4o-mini`.
- **API key**: Used for OpenAI-compatible providers only; never sent to Ollama.

> **Tool calling needs a capable model.** *Ask assistant* and the MCP tools rely on the provider's function-calling support. With Ollama the model must advertise the `tools` capability (`qwen3`, `llama3.1`, …); a model without it will not request tools and will instead answer in prose, sometimes with plausible-looking JSON that is never executed.

**MCP server** — see below.

## MCP server (desktop only)

Enabling the MCP server exposes Labnote's tools (`get_sample`, `list_samples`, `create_sample`, `get_unit_operation`, `update_section`, `create_workflow`) to an external MCP client such as Claude Desktop.

- **Endpoint**: `http://127.0.0.1:3987` — loopback only, never a routable interface.
- **Auth**: a random per-session bearer token. Copy it from Settings → **MCP token** while the server is running; it changes on every restart.
- **Writes are confirmed**: any tool that modifies the vault prompts you first and shows the target path, because the model chooses that path.

The server implements the `2025-06-18` MCP revision as a *stateless* server: `initialize`, `tools/list`, and `tools/call`. It answers `GET` with `405` since it has no server-initiated messages to stream, and validates the `Origin` header to defend against DNS rebinding. Because authentication is a bearer token rather than the spec's OAuth flow, your client must be able to set a custom `Authorization` header.

## Development

This is an npm workspaces monorepo:

- `src/` — the Obsidian plugin, bundled to `main.js` at the repository root via esbuild. The plugin lives at the root because Obsidian's community directory reads `manifest.json` from there.
- `packages/labnoteo-core` — platform-neutral core logic (parsers, workflow/sample domain), consumed by the plugin. It must not import Node-only APIs; anything platform-specific goes behind a port (`LabnoteFs`, `LabnoteHost`).
- `tests/` — plugin-layer tests, plus a runtime stub for the `obsidian` package (which ships types only). Core tests live beside the code in `packages/labnoteo-core/src/__tests__/`.

```bash
npm install           # install all workspaces
npm run dev           # watch build
npm run build         # bundle the Obsidian plugin -> main.js
npm run typecheck     # typecheck core + plugin
npm test              # run all tests (vitest: core + plugin projects)
npm run sync:versions # propagate root version to packages, manifest, and READMEs
```

`npm run sync:versions -- --check` writes nothing and fails if any target has drifted from the root `package.json` version; CI runs it that way.

Every `LabnoteFs` implementation must pass the shared contract in `packages/labnoteo-core/src/__tests__/labnoteFsContract.ts`, which is where the atomicity guarantee behind `{Type}.json` is enforced.

`npm run record:fixtures` re-records the LLM response fixtures in `tests/fixtures/llm/` against a live provider — see that folder's README for why they exist and how to read their provenance.

## Requirements

- Obsidian `1.5.0` or later.
- Node.js `22+` for development.

## License

MIT
