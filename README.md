# Labnote Assistant for Obsidian (labnoteo)

**Version 0.76.0**

A Markdown-based lab notebook for Obsidian, with sample tracking, workflow checklists, unit operations, and optional LLM assistance for biology and bioinformatics experiments.

This repository is the Obsidian port of the Labnote Assistant. It shares its platform-neutral parsing and domain logic with a companion VS Code extension, but is fully self-contained here.

## Features

- **Sample tracking**: A dedicated Samples sidebar view. Define, insert, edit, and search samples (DNA, RNA, Plasmid, and custom types). Move samples between local (note) and global scope.
- **Workflow checklists**: A Workflows sidebar view to create and manage numbered workflow notes, insert unit operations, and keep the table of contents in sync.
- **Unit operations**: Insert hardware/software unit operations from a bundled catalog, with automatic heading normalization and TOC updates.
- **CSV export**: Export tables from a note to CSV.
- **Sample suggestions & highlighting**: Inline suggestions and highlighting for sample references while editing.
- **LLM assistance (optional)**: Draft methods, summarize results, and extract samples via Ollama or OpenAI. Includes an optional local MCP server toggle.

## Commands

| Command | Description |
|---|---|
| Insert date / datetime | Insert the current date or timestamp |
| Create experiment | Create a new `.labnote.md` experiment note |
| Create workflow | Create a numbered workflow note |
| Insert unit operation | Insert a unit operation from the catalog |
| Export tables to CSV | Export note tables to CSV |
| AI: Draft method | Draft an experimental method with the configured LLM |
| AI: Summarize results | Summarize results with the configured LLM |
| AI: Extract samples | Extract samples from note text with the configured LLM |
| Toggle MCP server | Start/stop the local MCP server |
| Open Workflow / Sample view | Reveal the sidebar views |

> Renaming a workflow file in the file explorer automatically reorders the README checklist to match the new number prefix; deleting one removes its checklist entry and prunes the samples it defined.

## Installation (manual)

1. Download `main.js`, `manifest.json`, `versions.json`, and `styles.css` from a release.
2. Create `.obsidian/plugins/labnoteo/` inside your vault and copy the four files into it.
3. In Obsidian, go to Settings → Community plugins and enable **Labnote Assistant**.

## Settings

- **Sample tracking**: Show the Samples sidebar view.
- **Custom sample types**: Add custom sample types beyond the built-ins.
- **LLM provider**: `none`, `ollama`, or `openai` (the desktop build talks to the provider directly).

## Development

This is an npm workspaces monorepo:

- `src/` — the Obsidian plugin, bundled to `main.js` at the repository root via esbuild. The plugin lives at the root because Obsidian's community directory reads `manifest.json` from there.
- `packages/labnoteo-core` — platform-neutral core logic (parsers, workflow/sample domain), consumed by the plugin.

```bash
npm install          # install all workspaces
npm run build        # bundle the Obsidian plugin -> main.js
npm run typecheck    # typecheck core + plugin
npm test             # run core unit tests (vitest)
npm run sync:versions # propagate root version to packages + manifest
```

## Requirements

- Obsidian `1.5.0` or later.
- Node.js `22+` for development.

## License

MIT
