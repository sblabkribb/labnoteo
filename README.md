# Labnote Assistant for Obsidian (labnoteo)

**Version 0.81.0**

A Markdown-based lab notebook for Obsidian, with sample tracking, workflow checklists, unit operations, and optional LLM assistance for biology and bioinformatics experiments.

This repository is the Obsidian port of the Labnote Assistant. It shares its platform-neutral parsing and domain logic with a companion VS Code extension, but is fully self-contained here.

## Features

- **Sample tracking**: A dedicated Samples sidebar view. Define, insert, edit, and search samples (DNA, RNA, Plasmid, and custom types). Move samples between local (note) and global scope.
- **Workflow checklists**: A Workflows sidebar view to create and manage numbered workflow notes, insert unit operations, and keep the table of contents in sync.
- **Unit operations**: Insert hardware/software unit operations from a bundled catalog, with automatic heading normalization and TOC updates.
- **CSV export**: Export tables from a note to CSV.
- **Sample suggestions & highlighting**: Inline suggestions and highlighting for sample references while editing.
- **LLM assistance (optional)**: Draft methods, summarize results, and extract samples via Ollama or OpenAI. The *Ask assistant* command goes further and lets the model call Labnote's own tools to reach a goal, confirming with you before any write. The same tools are available to external MCP clients.
- **Experiment status**: Track each experiment's lifecycle (`planned` → `in-progress` → `needs-review` → `completed` / `failed` / …) in the note's frontmatter with the *Change experiment status* command, and drive validation and Issue automation from it.
- **Research automation (optional)**: One command scaffolds GitHub Actions, zero-dependency scripts, and AI-agent rules (`AGENTS.md`) into your vault to validate notes, open Experiment ↔ Issue links, and draft a Living-Manuscript Wiki — all opt-in and human-reviewed. See [Research automation](#research-automation).

## Requirements

- Obsidian `1.5.0` or later.
- Node.js `22+` for development.

## Installation

The plugin is not in Obsidian's community plugin directory yet, so install it from a release. Note that Obsidian keeps plugins **per vault** — `.obsidian/plugins/` lives inside the vault — so either route below is repeated once per vault.

**Via BRAT (recommended; updates itself)**

1. Install **Obsidian42 - BRAT** from Settings → Community plugins.
2. Run *BRAT: Add a beta plugin for testing* and enter `sblabkribb/labnoteo`.
3. Enable **Labnote Assistant** in Settings → Community plugins.

BRAT reads this repository's releases, so later versions arrive without you touching files.

**Manually**

1. Download `main.js`, `manifest.json`, and `styles.css` from a release.
2. Create `.obsidian/plugins/labnoteo/` inside your vault and copy the three files into it.
3. Enable **Labnote Assistant** in Settings → Community plugins.

If you keep several vaults, symlinking each `.obsidian/plugins/labnoteo` to one shared copy avoids re-copying — and during development it makes `npm run dev` rebuilds visible in every vault at once.

> Releases also carry `versions.json`. Obsidian reads that file from the repository to decide which plugin version a given app version may update to; inside a vault it is ignored, so there is no need to copy it.

### Handy companion plugins (optional)

Both are in the community directory, so install them from Settings → Community plugins → **Browse**.

- **Data Files Editor**: opens and edits JSON files such as the sample stores at `resources/labsamples/*.json` directly inside Obsidian, so you can inspect or fix sample data without an external editor.
- **Git** (Obsidian Git, optional): version-controls and backs up your lab-notebook vault from inside Obsidian. If you use an AI agent (e.g. Claude Code via [Copilot agent mode](#copilot-agent-mode--claude-code-optional)), you don't need it — the agent commits and pushes with native `git`, following the rules the scaffolded `AGENTS.md` provides (see [Research automation](#research-automation)).

## Commands

| Command | Description |
|---|---|
| Insert date | Insert the current date |
| Insert date and time | Insert the current timestamp |
| Create experiment | Create a new `.labnote.md` experiment note |
| Change experiment status | Update the active experiment's `status` frontmatter via a picker |
| Create workflow | Create a numbered workflow note |
| Insert unit operation | Insert a unit operation from the catalog |
| Export tables to CSV | Export note tables to CSV |
| Setup research automation | Scaffold GitHub Actions + scripts into the current vault (see [Research automation](#research-automation)) |
| AI: Draft Method section | Draft an experimental method with the configured LLM |
| AI: Summarize results | Summarize results with the configured LLM |
| AI: Extract sample definitions | Extract samples from note text with the configured LLM |
| AI: Ask assistant (uses tools) | State a goal and let the model reach it with Labnote's tools |
| Toggle MCP server | Start/stop the local MCP server |
| Open workflow view / Open sample view | Reveal the sidebar views |

> Renaming a workflow file in the file explorer automatically reorders the README checklist to match the new number prefix; deleting one removes its checklist entry and prunes the samples it defined.

## Research automation

Beyond the notebook itself, labnoteo can turn your vault into a lightweight research-notes system on GitHub — note validation, Experiment ↔ Issue links, and a Living-Manuscript Wiki — without you writing any CI by hand. Because every vault is different, the plugin *provisions* these assets into whichever vault it is installed in.

Run **Setup research automation** from the command palette. It writes the files below into the current vault — creating parent folders, confirming before it overwrites anything, and only *appending* missing lines to an existing `.gitignore` — then points you at the generated `SETUP.md` for the one-time setup steps.

| Area | Files | What it does |
| --- | --- | --- |
| Large-file protection | `scripts/check-large-files.mjs`, `.githooks/pre-commit`, `.gitignore` | Blocks oversized data files before commit (with a Node-free shell fallback). |
| Validation | `scripts/validate.mjs`, `.github/workflows/validate.yml` | On push, checks `status` values and duplicate experiment ids. |
| Experiment ↔ Issue | `scripts/issue-sync.mjs`, `.github/workflows/experiment-issues.yml`, `.github/ISSUE_TEMPLATE/experiment.md` | Opens/updates one Issue per experiment marked `discuss: true` or `status: needs-review` (deterministic, via the GitHub REST API). |
| AI agent rules | `AGENTS.md`, `CLAUDE.md` | Rules for a local AI agent (Claude Code, Cursor, …): git workflow and commit messages, when to flag a note with `discuss: true`, and how to draft facts into `wiki-staging/`. `CLAUDE.md` is a one-line `@AGENTS.md` import for Claude Code. Only the labnoteo-managed marker block is refreshed on re-runs — your own rules outside it are preserved. |
| Living-Manuscript Wiki (optional) | `.github/workflows/wiki-sync.yml`, `wiki-staging/*` | Publishes the human-reviewed `wiki-staging/` drafts to the GitHub Wiki after they are merged. |

The bundled scripts are **zero-dependency** Node ESM: they reuse labnoteo's own `@labnoteo/core` functions (so they never drift from the plugin) and run with `node scripts/*.mjs` — no `npm install` inside your vault.

**Prerequisites & scope**

- The vault must be a GitHub repository (push it first) for any Actions to run. Keep it **private** if it holds research data.
- All server-side automation is **deterministic** and runs on GitHub-hosted runners — no self-hosted runner or server-side LLM is needed. The AI judgments (does this note need discussion? which facts belong in the Wiki?) are done by your **local AI agent** following `AGENTS.md`; the agent only sets the `discuss: true` signal or drafts into `wiki-staging/`, while `issue-sync` / `wiki-sync` remain the sole creators/publishers, so nothing is duplicated. `wiki-sync.yml` may need a PAT (`GH_WIKI_TOKEN`) because the Wiki is a separate repository.
- Automation **never rewrites your notes** — it only opens Issues and publishes reviewed Wiki drafts. Scientific judgment and `status` changes stay with you.
- After a plugin update, re-run the command to refresh the scripts, then review the diff before committing.

See the generated `SETUP.md` in your vault for the full checklist and phase-by-phase details.

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

## Copilot (agent mode) + Claude Code (optional)

Copilot's **agent mode** runs a CLI agent installed on this machine (OpenCode / **Claude Code** / Codex). Pick "Claude" and Copilot drives your local `claude` (Claude Code) CLI, authenticating with **the Claude subscription account signed in to that CLI (Pro/Max/Team/Enterprise), not an API key**.

> If you ran **Setup research automation**, the vault contains `AGENTS.md` (git workflow, commit-message rules, when to flag `discuss: true`, how to draft `wiki-staging/` facts) and a `CLAUDE.md` that imports it via `@AGENTS.md` — so this same `claude` CLI picks the rules up automatically, in the terminal and in Copilot's agent mode alike. This is a different layer from labnoteo's built-in AI commands: those draft/summarize *inside* Obsidian, while the external agent handles git, Issue signals, and Wiki drafts.

### 1) Install & sign in to Claude Code

1. Run the install command shown in Copilot's Settings → **Basic → Agents → Claude → Configure**, under *Install Claude Code*. On Windows PowerShell, for example, it is a single line (copying the exact command from Copilot's dialog is safest):
   ```powershell
   irm https://gist.githubusercontent.com/logancyang/7a87eb38d91015eac567521f8cc9c729/raw/install-claude-agent-mode-windows.ps1 | iex
   ```
2. When a browser sign-in window appears during install, log in with your Claude account. **A subscription (Pro/Max/Team/Enterprise) needs no API key.**
3. Run `claude` in a terminal and check the current auth state with `/status`.

> If `ANTHROPIC_API_KEY` is set in your environment, it **takes precedence** over the subscription login and bills against that key. Leave the variable unset to use your subscription.

### 2) Connect the Claude agent in Copilot

1. Install and enable `Copilot` (by logancyang) from Settings → Community plugins → **Browse**.
2. Go to Settings → Copilot → **Basic → Agents → Claude → Configure → Auto-detect**. If it isn't found, paste the `claude` binary path copied during install into the binary-path field and save. (A "not in your PATH" warning is fine — Copilot locates Claude by file path, not PATH.)
3. Run **Open Copilot Agent Chat Window** from the command palette, pick **Claude**, and send a message.
4. Select text in a note, then use agent mode's context controls to add the selection or the active note to the chat.

### 3) (Optional) Wire Labnote tools into Claude — MCP

Register labnoteo's MCP server with Claude Code and the **same `claude` binary — whether you use it from a terminal or from Copilot's agent mode** — can call Labnote's tools (`get_sample`, `list_samples`, `create_sample`, `get_unit_operation`, `update_section`, `create_workflow`) directly. **Desktop only.**

1. Run **Toggle MCP server** from Obsidian's command palette and copy the current token from Settings → **MCP token** (it is reissued on every restart).
2. Register it with the copied token:
   ```bash
   claude mcp add --transport http labnoteo http://127.0.0.1:3987 \
     --header "Authorization: Bearer <copied-token>"
   ```
3. Confirm the `labnoteo` connection with `claude mcp list`, and check its status with `/mcp` inside Claude Code.
4. Then just instruct it in natural language, e.g. "list the DNA samples in this vault with list_samples", or "draft the Method section of the current experiment note with update_section".

**Cautions**

- **Token refresh**: toggling the MCP server off and on changes the token. To re-register, run `claude mcp remove labnoteo` and `add` again with the new token.
- **Writes are confirmed**: tools that modify the vault (`create_sample`, `update_section`, `create_workflow`) make Obsidian prompt you with the target path before running, because the model chooses that path.
- **Binding**: the server binds only `127.0.0.1` (loopback) and is not exposed on any other interface.
- **Header issue**: some Claude Code versions (notably on Windows) drop the `Authorization` header on tool calls, yielding `401`. This server supports header auth only, so if `401` persists, update Claude Code to the latest version.

## Development

This is an npm workspaces monorepo:

- `src/` — the Obsidian plugin, bundled to `main.js` at the repository root via esbuild. The plugin lives at the root because Obsidian's community directory reads `manifest.json` from there.
- `packages/labnoteo-core` — platform-neutral core logic (parsers, workflow/sample domain), consumed by the plugin. It must not import Node-only APIs; anything platform-specific goes behind a port (`LabnoteFs`, `LabnoteHost`).
- `automation/` — sources for the vault-scaffolded [Research automation](#research-automation) scripts. esbuild builds them (Stage 1) to zero-dependency `dist-automation/*.mjs` — reusing the same `@labnoteo/core` source as the plugin, so there is no drift — and embeds them (plus the workflow/AGENTS.md/Wiki templates) as strings inside `main.js` (Stage 2). This keeps a 3-file install self-sufficient; the *Setup research automation* command writes those strings out into the vault.
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

## License

MIT
