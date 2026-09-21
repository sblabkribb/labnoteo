# Labnote Assistant for Obsidian (labnoteo)

**Version 0.87.0**

[한국어](README.md)

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
- **Discussion flag**: Mark a note as needing team discussion with *Toggle discussion flag*, independent of its lifecycle status — an `in-progress` experiment can ask for a decision without pretending to be done. The next push opens a GitHub Issue for it.
- **Issue markers**: Questions come up mid-sentence, so drop an `@issue;<ID>;<topic>` marker right where it arose (extending the `@dna;…` sample grammar you already use). Every marker opens its own Issue, linked back to that exact line of the note.
- **Research automation (optional)**: One command scaffolds GitHub Actions, zero-dependency scripts, and AI-agent rules (`AGENTS.md`) into your vault to validate notes, open Experiment ↔ Issue links, and draft a Living-Manuscript Wiki — all opt-in and human-reviewed. See [Research automation](#research-automation).

## Requirements

- Obsidian `1.5.0` or later.
- Node.js `22+` for development.

## Installation

### First-time setup order

The order is vault → CLI agent → prerequisite plugins → Labnote Assistant → automation → git/GitHub → Copilot setup. **BRAT is how you install Labnote Assistant**, so it necessarily comes first.

1. Create or open an Obsidian vault.
2. **Install a CLI agent & sign in** (Claude Code / Codex) — before Copilot. See [Copilot agents](#copilot-agents).
3. **Install & enable the community plugins** — **BRAT** (how you install Labnote Assistant) + **Copilot** + (optional) Data Files Editor. See [Plugins to install](#plugins-to-install).
4. **Install & enable Labnote Assistant** — add `sblabkribb/labnoteo` with the BRAT from step 3 (or install manually). See [Installing Labnote Assistant](#installing-labnote-assistant).
5. Run *Setup research automation* to generate `.labnoteo/`, `.gitignore`, `AGENTS.md`, and `QUICKSTART.md`. See [Research automation](#research-automation).
6. `git init`, then enable the pre-commit hook — `git config core.hooksPath .labnoteo/hooks`.
7. Connect a **private** GitHub repository and make the first push.
8. **Configure Copilot** — `Auto-detect` the agent under `Basic → Agents`, and pick a BYOK model for Quick Chat if you need one. See [Copilot agents](#copilot-agents) and [Copilot LLM setup](#3-copilot-llm-setup).
9. (Optional) Wire Labnote's tools into the agent over MCP. See [MCP server](#mcp-server-desktop-only).

- **`.gitignore` comes before the first push (5 → 7)**: once oversized raw data lands in Git history, nothing short of a history rewrite takes it back. `.gitignore` is written by *Setup research automation*, so connect git after that.
- **Copilot setup comes after the automation setup (5 → 8)**: *installing* the plugin is done in step 3, but *connecting* the agent waits until `AGENTS.md` exists. Agent Chat reads the vault-root `AGENTS.md` as its instructions, so your rules apply from the very first session.

### Plugins to install

CLI agents (Claude Code / Codex) are **system CLIs**, not Obsidian plugins, so they are not in this table — install them before Copilot so its `Auto-detect` picks them up right away.

| Order | Plugin | Role | How to install |
| --- | --- | --- | --- |
| 1 | **Obsidian42 - BRAT** | Required (how you install Labnote Assistant) | Settings → Community plugins → **Browse** |
| 1 | **Copilot** (by logancyang) | Required | Settings → Community plugins → **Browse** |
| 1 | **Data Files Editor** | Optional | Settings → Community plugins → **Browse** |
| 2 | **Labnote Assistant** (this plugin) | Required | BRAT or manual — [see below](#installing-labnote-assistant) |

Rows sharing an `Order` can be installed in any sequence; `2` comes after all of `1`.

- **Obsidian42 - BRAT**: Labnote Assistant is not in the community plugin directory yet, so this is what installs it. Skip it only if you chose the manual route.
- **Copilot**: its agent mode drives your local Claude Code / Codex CLI, which handles git commits, Issue signals, and Wiki drafts. **Install the CLI agent first and `Auto-detect` finds it in one go.** See [Copilot agents](#copilot-agents) for setup.
- **Data Files Editor**: edits the sample stores at `resources/labsamples/*.json` directly inside Obsidian.

### Installing Labnote Assistant

The plugin is not in the community directory yet, so install it from a release. Obsidian keeps plugins **per vault** (`.obsidian/plugins/` lives inside the vault), so repeat this once per vault.

**Via BRAT (recommended; updates itself)**

Use the BRAT you installed in step 3 of [First-time setup order](#first-time-setup-order).

1. Run *BRAT: Add a beta plugin for testing* and enter `sblabkribb/labnoteo`.
2. Enable **Labnote Assistant** in Settings → Community plugins.

**Manually**

1. Download `main.js`, `manifest.json`, and `styles.css` from a release.
2. Create `.obsidian/plugins/labnoteo/` inside your vault and copy the three files into it.
3. Enable **Labnote Assistant** in Settings → Community plugins.

> Obsidian reads the release's `versions.json` from the repository, so there is no need to copy it into a vault. If you keep several vaults, symlinking each `.obsidian/plugins/labnoteo` to one shared copy avoids re-copying.

## Commands

| Command | Description |
|---|---|
| Insert date | Insert the current date |
| Insert date and time | Insert the current timestamp |
| Create experiment | Create a new `.labnote.md` experiment note |
| Change experiment status | Update the active experiment's `status` frontmatter via a picker |
| Toggle discussion flag | Turn the active experiment's `discuss` flag on/off, so the next push opens a GitHub Issue |
| Insert issue marker | Drop an `@issue;<ID>;<topic>` marker at the cursor (selection becomes the topic); each marker opens its own Issue |
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

Run **Setup research automation** from the command palette. It writes the files below into the current vault — creating parent folders, confirming before it overwrites anything, and only *appending* missing lines to an existing `.gitignore` — then points researchers at the generated `QUICKSTART.md` (day-to-day usage) and admins at `.labnoteo/SETUP.md` (one-time setup).

The machinery lives in a single hidden `.labnoteo/` folder, so Obsidian's file explorer keeps showing only what a researcher opens: `labnote/`, `wiki-staging/`, `QUICKSTART.md` and the agent rules. Upgrading from an earlier version, the command also offers to delete the files it used to scatter across the vault root.

| Area | Files | What it does |
| --- | --- | --- |
| User docs | `QUICKSTART.md`, `.labnoteo/SETUP.md` | A researcher-facing guide (5-minute walkthrough, cheatsheet, feature reference, FAQ) and an admin/developer setup guide (one-time checklist, asset reference, architecture). |
| Large-file protection | `.labnoteo/scripts/check-large-files.mjs`, `.labnoteo/hooks/pre-commit`, `.gitignore` | Blocks oversized data files before commit (with a Node-free shell fallback). |
| Validation | `.labnoteo/scripts/validate.mjs`, `.github/workflows/validate.yml` | On push, checks `status` values, duplicate experiment ids, and that `@issue` markers parse with folder-unique ids. |
| Experiment ↔ Issue | `.labnoteo/scripts/issue-sync.mjs`, `.github/workflows/experiment-issues.yml`, `.github/ISSUE_TEMPLATE/experiment.md` | Opens one long-lived Issue per experiment marked `discuss: true` or `status: needs-review` (reopened if it was closed), plus one Issue per `@issue;<ID>;<topic>` marker found in *any* `*.labnote.md` of the changed experiment folder, linked to that line (a resolved marker Issue stays closed). Deterministic, via the GitHub REST API. |
| Manual backfill | `experiment-issues.yml` / `validate.yml` `workflow_dispatch` | Run either workflow from the Actions tab. `issue-sync` then scans every experiment folder (`--all`) instead of the push diff, picking up markers written before the automation existed — idempotent, and it deliberately leaves closed discussion threads closed. |
| AI agent rules | `AGENTS.md`, `CLAUDE.md` | Rules for a local AI agent (Claude Code, Cursor, …): git workflow and commit messages, when to flag a note with `discuss: true`, and how to draft facts into `wiki-staging/`. `CLAUDE.md` is a one-line `@AGENTS.md` import for Claude Code. Only the labnoteo-managed marker block is refreshed on re-runs — your own rules outside it are preserved. |
| Living-Manuscript Wiki (optional) | `.github/workflows/wiki-sync.yml`, `wiki-staging/*` | Publishes the human-reviewed `wiki-staging/` drafts to the GitHub Wiki after they are merged. |

The bundled scripts are **zero-dependency** Node ESM: they reuse labnoteo's own `@labnoteo/core` functions (so they never drift from the plugin) and run with `node .labnoteo/scripts/*.mjs` — no `npm install` inside your vault.

**Prerequisites & scope**

- The vault must be a GitHub repository (push it first) for any Actions to run. Keep it **private** if it holds research data.
- All server-side automation is **deterministic** and runs on GitHub-hosted runners — no self-hosted runner or server-side LLM is needed. The AI judgments (does this note need discussion? which facts belong in the Wiki?) are done by your **local AI agent** following `AGENTS.md`; the agent only sets the `discuss: true` signal or drafts into `wiki-staging/`, while `issue-sync` / `wiki-sync` remain the sole creators/publishers, so nothing is duplicated. `wiki-sync.yml` may need a PAT (`GH_WIKI_TOKEN`) because the Wiki is a separate repository.
- `AGENTS.md` is **shared with Copilot**: Copilot's *Custom vault instructions* field edits the vault-root `AGENTS.md` directly, and that file becomes the instruction set for Agent Chat and, by default, Quick Chat — so the rules this command installs apply to Copilot automatically. When you edit from that field, **keep your own rules outside** labnoteo's managed marker block so you don't disturb it, and once a re-run of this command has refreshed `AGENTS.md`, **start a new Agent Chat** for it to take effect. See [Copilot agents](#copilot-agents).
- Automation **never rewrites your notes** — it only opens Issues and publishes reviewed Wiki drafts. Scientific judgment and `status` changes stay with you.
- After a plugin update, re-run the command to refresh the scripts, then review the diff before committing.

See the generated `QUICKSTART.md` (researchers) and `.labnoteo/SETUP.md` (admins) in your vault for the walkthrough and the full setup checklist.

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

> **Tool calling needs a model with function-calling support.** With Ollama, pick a model that advertises the `tools` capability (`qwen3`, `llama3.1`, …); one without it will not call tools and answers in prose instead.

**MCP server** — see below.

## MCP server (desktop only)

Enabling the MCP server exposes Labnote's tools (`get_sample`, `list_samples`, `create_sample`, `get_unit_operation`, `update_section`, `create_workflow`) to an external MCP client such as Claude Desktop.

- **Endpoint**: `http://127.0.0.1:3987` — loopback only, never a routable interface.
- **Auth**: a random per-session bearer token. Copy it from Settings → **MCP token** while the server is running; it changes on every restart.
- **Writes are confirmed**: any tool that modifies the vault prompts you first and shows the target path, because the model chooses that path.

The server is a *stateless* implementation of the `2025-06-18` MCP revision (`initialize`, `tools/list`, `tools/call`). It validates the `Origin` header to defend against DNS rebinding, and because authentication is a bearer token rather than the spec's OAuth flow, your client must be able to set a custom `Authorization` header.

## Copilot agents

Copilot's **agent mode** runs a CLI agent installed on this machine (**Claude Code** / **Codex** / opencode) as-is. It authenticates with **the account signed in to that CLI, not a BYOK API key** — pick "Claude" and it drives your local `claude` CLI and the Claude subscription (Pro/Max/Team/Enterprise) signed in to it; pick "Codex" and it uses the `codex-acp` adapter and your Codex CLI login.

This is a different layer from labnoteo's built-in AI commands: those draft and summarize *inside* Obsidian, while the external agent handles git, Issue signals, and Wiki drafts. See [Copilot LLM setup](#3-copilot-llm-setup) for how the layers differ. If you set up [Research automation](#research-automation), the same CLI picks up the generated `AGENTS.md` / `CLAUDE.md` automatically, in the terminal and in Copilot's agent mode alike.

> Copilot's *Custom vault instructions* field **edits the vault-root `AGENTS.md` directly**. That file is the instruction set for Agent Chat (and, by default, Quick Chat), so the rules labnoteo installs apply to Copilot too. Editing from that field can disturb labnoteo's managed marker block, though, so **keep your own rules outside the markers**. Once a re-run of *Setup research automation* has refreshed `AGENTS.md`, **start a new Agent Chat** for it to take effect.

### 1) Install & sign in to a CLI agent (before Copilot)

**Claude Code** — Copilot's *Install Claude Code* only shows you an install command to run outside Copilot; the binary itself is what the `Auto-detect` in 2) looks for in the usual install locations. Installing the CLI first is the surer path.

1. Install Claude Code through the official route. On Windows PowerShell, for example:
   ```powershell
   irm https://gist.githubusercontent.com/logancyang/7a87eb38d91015eac567521f8cc9c729/raw/install-claude-agent-mode-windows.ps1 | iex
   ```
2. When a browser sign-in window appears, log in with your Claude account. **A subscription (Pro/Max/Team/Enterprise) needs no API key.**
3. Run `claude` in a terminal and check the auth state with `/status`.

> If `ANTHROPIC_API_KEY` is set in your environment, it **takes precedence** over the subscription login and bills against that key. Leave it unset to use your subscription.

**Codex** — Install the Codex CLI and sign in. The adapter (`codex-acp`) defaults to `Managed by Copilot`, so Copilot installs it for you without Node/npm and `Sign in` works inside Copilot as well — unlike Claude, **pre-installing is not mandatory.** The benefit of doing it first is sharing the login and configuration with your terminal, which matters because labnoteo governs terminal work through `AGENTS.md` too.

**opencode** — Copilot installs and manages it directly, so there is no CLI to prepare.

### 2) Connect the agent in Copilot

*Installing* the Copilot plugin is already done in step 3 of [First-time setup order](#first-time-setup-order); this section only covers connecting.

1. Go to Settings → Copilot → **Basic → Agents**, pick **Claude** or **Codex** → **Configure** → **Auto-detect**. Since you installed the CLI in 1), it is found right away. Only if it isn't, paste the binary's absolute path into **My own binary**. (A "not in your PATH" warning is fine.)
2. Set your default agent with **Default backend**.
3. Run **Open Copilot Agent Chat Window** from the command palette to open the chat.
4. Select text in a note, then use agent mode's context controls to add the selection or the active note to the chat.

> Claude's **Auto mode permissions** (`Auto` / `Accept edits` / `Bypass permissions`) govern how freely the agent edits your vault. `Bypass permissions` is not recommended.

### 3) Copilot LLM setup

Model setup is confusing because there are **three layers**, and each looks at different credentials.

| Layer | Model & auth | Where to configure | Used for |
| --- | --- | --- | --- |
| **labnoteo's own AI** | Ollama or an OpenAI-compatible endpoint + its own `API key` | Settings → Labnote Assistant → **AI provider** (`Provider`, `Ollama endpoint` / `OpenAI endpoint`, `Model`, `API key`) — see [Settings](#settings) | Drafting and summarizing inside a note (`AI: Draft Method section`, …) |
| **Copilot Agent Chat** (Claude / Codex / opencode) | **The CLI login** — BYOK keys are not used | Each agent's tab under `Basic → Agents`. Left at `Agent default`, the agent picks the model | git commits, Issue signals, Wiki drafts |
| **Copilot Quick Chat** | Needs a Copilot-hosted or **BYOK** model. A **separate list** from the models you pick for Agent Chat | `Settings → Copilot → BYOK` + `Basic → Agents → Quick Chat` | Short questions in the Copilot chat pane |

**Setting up a model for Quick Chat**

1. `Settings → Copilot → BYOK → Add provider`. For a local model use the `Self Host` template (Ollama defaults to `http://localhost:11434/v1`, LM Studio to `http://localhost:1234/v1`); for a cloud model pick the provider and enter its key. A custom OpenAI-compatible endpoint requires a `Base URL`.
2. Under `Basic → Agents → Quick Chat`, enable the models you want and set the `Default model`.

**Where people get stuck**

- **A `missing key` label appears, or you only see `Select Model`** — the default model is OpenRouter's Gemini 2.5 Flash, so it is blocked without a key. To use another provider, add it under BYOK first, then change the `Default model`.
- **Agent Chat won't work and you are entering BYOK keys** — that is mixing up the layers. Claude/Codex only look at **the CLI login** (see 1)).
- **Agent models are empty after Copilot's `Reset Settings`** — your keys are preserved, but backend model activation is reset, so re-enable them under `Basic → Agents`.

### 4) (Optional) Connect Labnote tools — MCP

Register labnoteo's MCP server with Claude Code and the same `claude` binary can call Labnote's tools directly, from a terminal or from Copilot's agent mode. **Desktop only.**

1. Run **Toggle MCP server** from the command palette and copy the token from Settings → **MCP token** (reissued on every restart).
2. Register it with the copied token:
   ```bash
   claude mcp add --transport http labnoteo http://127.0.0.1:3987 \
     --header "Authorization: Bearer <copied-token>"
   ```
3. Confirm the connection with `claude mcp list`. Then instruct it in natural language, e.g. "list the DNA samples in this vault with list_samples".

**Cautions**

- **Token refresh**: toggling the server off and on changes the token. Run `claude mcp remove labnoteo` and `add` again with the new one.
- **Writes are confirmed**: tools that modify the vault make Obsidian prompt you with the target path before running.
- **Header issue**: some Claude Code versions (notably on Windows) drop the `Authorization` header, yielding `401`. If it persists, update Claude Code.

## Development

This is an npm workspaces monorepo:

- `src/` — the Obsidian plugin, bundled to `main.js` at the repository root via esbuild. The plugin lives at the root because Obsidian's community directory reads `manifest.json` from there.
- `packages/labnoteo-core` — platform-neutral core logic (parsers, workflow/sample domain), consumed by the plugin. It must not import Node-only APIs; anything platform-specific goes behind a port (`LabnoteFs`, `LabnoteHost`).
- `automation/` — sources for the vault-scaffolded [Research automation](#research-automation) scripts. esbuild builds them (Stage 1) to zero-dependency `dist-automation/*.mjs` — reusing the same `@labnoteo/core` source as the plugin, so there is no drift — and embeds them (plus the workflow/AGENTS.md/Wiki templates) as strings inside `main.js` (Stage 2). This keeps a 3-file install self-sufficient; the *Setup research automation* command writes those strings out into the vault. Not every source here ships: `issue-gate.ts` and `wiki-propose.ts` are excluded from the build, since the local AI agent makes those judgments now (see `esbuild.config.mjs`); they are kept as sources for a possible opt-in path.
- `issue-sync` and `validate` must see the *same* markers, so both read a folder through `readMarkerSources` rather than reading a README directly — narrowing either one alone would mean opening issues for markers that were never validated, or the reverse.
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
