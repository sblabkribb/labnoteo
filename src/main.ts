/**
 * Labnote Assistant — Obsidian plugin entry point.
 *
 * This is the skeleton: it wires the platform-neutral pieces from
 * `@labnoteo/core` (file-system port, translator) into Obsidian and registers a
 * couple of proof-of-wiring commands. Domain commands, sample suggestions, CM6
 * highlighting, sidebar views, the settings tab and the LLM/MCP layer are added
 * by subsequent modules that all consume the same `LabnoteHost` built here.
 */
import { Plugin, Notice, TFile } from 'obsidian';
import type { LabnoteHost, Translator } from '@labnoteo/core';
import { findSampleReferenceAt } from '@labnoteo/core';
import { getSeoulDateString, getSeoulDateTimeString } from '@labnoteo/core/lib/dateUtils';
import { getSampleDisplayMeta } from '@labnoteo/core/lib/sampleUtils';
import { isValidWorkflowPath } from '@labnoteo/core/lib/workflowStructure';
import { saveSamplesFromDocument } from '@labnoteo/core/lib/sampleStorage';
import { VaultFileSystem } from './vaultFileSystem';
import { createObsidianTranslator } from './i18n';
import { createObsidianHost } from './obsidianHost';
import {
  createExperimentCommand,
  createWorkflowCommand,
  insertUnitOperationCommand,
  insertWorkflowLinkCommand,
  syncReadmeOrderOnRename,
  syncReadmeAndSamplesOnDelete,
  labnoteDirFromPath,
} from './commands';
import * as posix from '@labnoteo/core/posix';
import { SampleEditorSuggest } from './sampleSuggest';
import { openSampleDefinition } from './sampleDefinitionModal';
import {
  createSampleHighlightPlugin,
  createSampleReadingHighlighter,
  type HighlightState,
} from './sampleHighlight';
import { createMetaDatePickerExtension } from './dateFieldPicker';
import { WorkflowTreeView, WORKFLOW_VIEW_TYPE } from './views/workflowView';
import { SampleTreeView, SAMPLE_VIEW_TYPE } from './views/sampleView';
import { exportTablesToCsv, exportActiveNoteTablesToCsv } from './exportCsv';
import { LabnoteSettingTab } from './settingsTab';
import {
  draftMethodCommand,
  summarizeResultsCommand,
  extractSamplesCommand,
} from './llm/commands';
import { LabnoteMcpServer } from './llm/mcpServer';
import { CURRENT_SCHEMA_VERSION, migrateSettings, type LabnoteSettings } from './settings';

export default class LabnotePlugin extends Plugin {
  // `Plugin` already declares `settings?: unknown`; re-type it concretely.
  declare settings: LabnoteSettings;
  fs!: VaultFileSystem;
  t!: Translator;
  host!: LabnoteHost;
  mcpServer!: LabnoteMcpServer;
  private sampleSuggest?: SampleEditorSuggest;
  private readonly sampleSyncTimers = new Map<string, number>();
  // Pending README auto-sync events, coalesced per experiment folder.
  private readonly readmeSyncQueue = new Map<
    string,
    { renames: { from: string; to: string }[]; deletes: string[] }
  >();
  private readonly readmeSyncTimers = new Map<string, number>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.fs = new VaultFileSystem(this.app.vault.adapter);
    this.t = createObsidianTranslator();
    this.host = createObsidianHost(this.app, this.fs, this.t);
    this.mcpServer = new LabnoteMcpServer(this);

    this.registerCommands();
    this.registerSampleFeatures();
    this.registerEditorExtension(createMetaDatePickerExtension(this.t('Pick date and time')));
    this.registerViews();
    this.registerFileMenu();
    this.registerEditorMenu();
    this.registerWorkflowReadmeSync();
    this.addSettingTab(new LabnoteSettingTab(this.app, this));

    if (this.settings.mcpEnabled) {
      // Defer to layout-ready so we don't block plugin init on the listener.
      this.app.workspace.onLayoutReady(() => this.mcpServer.start());
    }
  }

  onunload(): void {
    this.mcpServer?.stop();
    // Cancel any pending debounced sample-sync writes. registerInterval only
    // covers setInterval, so these setTimeout handles must be cleared by hand —
    // otherwise an unloaded instance still writes to the vault ~800ms later.
    for (const handle of this.sampleSyncTimers.values()) {
      window.clearTimeout(handle);
    }
    this.sampleSyncTimers.clear();
    // Same for pending README auto-sync flushes.
    for (const handle of this.readmeSyncTimers.values()) {
      window.clearTimeout(handle);
    }
    this.readmeSyncTimers.clear();
    this.readmeSyncQueue.clear();
    // Views/events registered via this.register*() are auto-cleaned by Obsidian.
  }

  /**
   * Run an async command body, surfacing any failure as an error Notice instead
   * of letting the rejected promise vanish (which left commands failing
   * silently with nothing shown to the user).
   */
  private run(fn: () => Promise<void>): void {
    fn().catch((err: unknown) => {
      console.error('[labnoteo] command failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this.host.notify('error', this.t('Command failed: {0}', msg));
    });
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'insert-date',
      name: this.t('Insert date'),
      editorCallback: editor => {
        editor.replaceSelection(getSeoulDateString());
      },
    });

    this.addCommand({
      id: 'insert-datetime',
      name: this.t('Insert date and time'),
      editorCallback: editor => {
        editor.replaceSelection(getSeoulDateTimeString());
      },
    });

    this.addCommand({
      id: 'create-experiment',
      name: this.t('Create experiment'),
      callback: () => this.run(() => createExperimentCommand(this.app, this.host)),
    });

    this.addCommand({
      id: 'create-workflow',
      name: this.t('Create workflow'),
      callback: () => this.run(() => createWorkflowCommand(this.app, this.host)),
    });

    this.addCommand({
      id: 'insert-unit-operation',
      name: this.t('Insert unit operation'),
      callback: () => this.run(() => insertUnitOperationCommand(this.app, this.host)),
    });

    this.addCommand({
      id: 'export-tables-csv',
      name: this.t('Export tables to CSV'),
      callback: () => this.run(() => exportActiveNoteTablesToCsv(this)),
    });

    // --- AI commands ---
    this.addCommand({
      id: 'ai-draft-method',
      name: this.t('AI: Draft Method section'),
      callback: () => this.run(() => draftMethodCommand(this)),
    });
    this.addCommand({
      id: 'ai-summarize-results',
      name: this.t('AI: Summarize results'),
      callback: () => this.run(() => summarizeResultsCommand(this)),
    });
    this.addCommand({
      id: 'ai-extract-samples',
      name: this.t('AI: Extract sample definitions'),
      callback: () => this.run(() => extractSamplesCommand(this)),
    });

    this.addCommand({
      id: 'toggle-mcp-server',
      name: this.t('Toggle MCP server'),
      callback: () =>
        this.run(async () => {
          // Keep the persisted `mcpEnabled` in lock-step with the live server so
          // the command and the settings toggle can't drift out of sync.
          if (this.mcpServer.running) {
            this.mcpServer.stop();
            this.settings.mcpEnabled = false;
          } else {
            this.mcpServer.start();
            this.settings.mcpEnabled = true;
          }
          await this.saveSettings();
        }),
    });
  }

  /**
   * Sample-tree cleanup context passed to the delete auto-sync so it can prune
   * `{Type}.json` records and refresh the sample UI/autocomplete cache.
   */
  private sampleCleanupOpts() {
    return {
      globalSampleFolder: this.settings.globalSampleFolder,
      customTypes: this.settings.customSampleTypes,
      onSamplesChanged: () => {
        this.sampleSuggest?.clearCache();
        this.refreshSampleViews();
      },
    };
  }

  /**
   * Right-click a markdown note in the file explorer → export its tables to CSV.
   * Workflow rename/delete are no longer custom actions: renaming or deleting a
   * workflow file in the explorer auto-syncs the README (see
   * {@link registerWorkflowReadmeSync}).
   */
  private registerFileMenu(): void {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        menu.addItem(item =>
          item
            .setTitle(this.t('Export tables to CSV'))
            .setIcon('table')
            .onClick(() => void exportTablesToCsv(this, file))
        );
      })
    );
  }

  /** Right-click in a lab-note editor → create a workflow + insert a link at the cursor. */
  private registerEditorMenu(): void {
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor, info) => {
        const file = info.file;
        if (!(file instanceof TFile) || file.extension !== 'md') return;

        // Go to definition works in ANY markdown note (references may appear
        // outside `.labnote.md`), so add it before the workflow-file gate below.
        if (this.settings.sampleTracking) {
          const cur = editor.getCursor();
          const types = getSampleDisplayMeta(this.settings.customSampleTypes).types;
          const hit = findSampleReferenceAt(editor.getLine(cur.line), cur.ch, types);
          if (hit) {
            menu.addItem(item =>
              item
                .setTitle(this.t('Go to definition'))
                .setIcon('search')
                .onClick(() =>
                  this.run(() =>
                    openSampleDefinition(this.app, this, {
                      type: hit.type,
                      id: hit.id,
                      docPath: file.path,
                    })
                  )
                )
            );
          }
        }

        // Workflow-specific items depend on the file kind:
        //  - a workflow file (NNN_WX###_*.labnote.md) → insert a unit operation,
        //  - the experiment README (README.labnote.md) → insert a workflow link.
        // Everything else (plain notes) gets no workflow item.
        if (isValidWorkflowPath(file.path)) {
          menu.addItem(item =>
            item
              .setTitle(this.t('Insert unit operation'))
              .setIcon('plus')
              .onClick(() => this.run(() => insertUnitOperationCommand(this.app, this.host)))
          );
        } else if (file.name.toLowerCase() === 'readme.labnote.md') {
          menu.addItem(item =>
            item
              .setTitle(this.t('Insert workflow'))
              .setIcon('git-branch-plus')
              .onClick(() => this.run(() => insertWorkflowLinkCommand(this.app, this.host, editor)))
          );
        }
      })
    );
  }

  /**
   * Keep the experiment README (and, on delete, the sample tree) in sync with
   * the file explorer:
   *  - renaming a workflow file inside its folder reorders the README checklist
   *    to the new `NNN` order (and relinks the entry),
   *  - deleting one removes its checklist entry and prunes samples it defined.
   *
   * Events are coalesced per experiment folder (~400ms) so bulk operations — or
   * Obsidian's own backlink update racing our write — settle into a single
   * README write. Our writes go through `vault.process` (a 'modify', never
   * rename/delete), so they cannot re-enter these listeners. Cross-folder moves
   * are intentionally not auto-listed in the destination README (documented
   * limitation — use "Insert workflow").
   */
  private registerWorkflowReadmeSync(): void {
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        const newPath = file.path;
        // Only same-folder workflow-file renames auto-reorder the README.
        if (!isValidWorkflowPath(newPath) || !isValidWorkflowPath(oldPath)) return;
        const dir = labnoteDirFromPath(newPath);
        if (!dir || dir !== labnoteDirFromPath(oldPath)) return;
        this.queueReadmeSync(dir).renames.push({
          from: posix.basename(oldPath),
          to: posix.basename(newPath),
        });
        this.scheduleReadmeSync(dir);
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', file => {
        if (!(file instanceof TFile) || !isValidWorkflowPath(file.path)) return;
        const dir = labnoteDirFromPath(file.path);
        if (!dir) return;
        this.queueReadmeSync(dir).deletes.push(file.path);
        this.scheduleReadmeSync(dir);
      })
    );
  }

  /** Get (or create) the pending-event queue for an experiment folder. */
  private queueReadmeSync(dir: string): { renames: { from: string; to: string }[]; deletes: string[] } {
    let q = this.readmeSyncQueue.get(dir);
    if (!q) {
      q = { renames: [], deletes: [] };
      this.readmeSyncQueue.set(dir, q);
    }
    return q;
  }

  /** (Re)arm the per-folder debounce that flushes queued README-sync events. */
  private scheduleReadmeSync(dir: string): void {
    const prev = this.readmeSyncTimers.get(dir);
    if (prev !== undefined) window.clearTimeout(prev);
    const handle = window.setTimeout(() => {
      this.readmeSyncTimers.delete(dir);
      const q = this.readmeSyncQueue.get(dir);
      this.readmeSyncQueue.delete(dir);
      if (q) void this.flushReadmeSync(dir, q);
    }, 400);
    this.readmeSyncTimers.set(dir, handle);
  }

  /** Apply all queued deletes (prune + sample cleanup) then renames (reorder). */
  private async flushReadmeSync(
    dir: string,
    q: { renames: { from: string; to: string }[]; deletes: string[] }
  ): Promise<void> {
    try {
      if (q.deletes.length > 0) {
        const removed = await syncReadmeAndSamplesOnDelete(
          this.app,
          this.host,
          dir,
          q.deletes,
          this.sampleCleanupOpts()
        );
        if (removed.length > 0) {
          this.sampleSuggest?.clearCache();
          this.refreshSampleViews();
          const ids = removed.map(r => `${r.type} ${r.id}`).join(', ');
          this.host.notify('info', this.t('Removed from sample tree: {0}', ids));
        }
      }
      if (q.renames.length > 0) {
        await syncReadmeOrderOnRename(this.app, this.host, dir, q.renames);
      }
    } catch (err) {
      console.warn('[labnoteo] README auto-sync failed:', err);
    }
  }

  /** Register the two sidebar views + commands/ribbon to open them. */
  private registerViews(): void {
    this.registerView(WORKFLOW_VIEW_TYPE, leaf => new WorkflowTreeView(leaf, this));
    this.registerView(SAMPLE_VIEW_TYPE, leaf => new SampleTreeView(leaf, this));

    this.addRibbonIcon('box', this.t('Workflows'), () => void this.activateView(WORKFLOW_VIEW_TYPE));
    this.addRibbonIcon('test-tube', this.t('Samples'), () => void this.activateView(SAMPLE_VIEW_TYPE));

    this.addCommand({
      id: 'open-workflow-view',
      name: this.t('Open workflow view'),
      callback: () => void this.activateView(WORKFLOW_VIEW_TYPE),
    });
    this.addCommand({
      id: 'open-sample-view',
      name: this.t('Open sample view'),
      callback: () => void this.activateView(SAMPLE_VIEW_TYPE),
    });
  }

  /** Reveal (or create) a sidebar leaf hosting the given view type. */
  private async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(viewType);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: viewType, active: true });
      await workspace.revealLeaf(leaf);
    }
  }

  /** Sample autocomplete, live/reading-mode highlighting, and save-time sync. */
  private registerSampleFeatures(): void {
    if (!this.settings.sampleTracking) return;

    // Autocomplete (@type;… → sample IDs).
    this.sampleSuggest = new SampleEditorSuggest(this.app, {
      fs: this.fs,
      customTypes: () => this.settings.customSampleTypes,
      globalFolder: () => this.settings.globalSampleFolder,
      plugin: this,
    });
    this.registerEditorSuggest(this.sampleSuggest);

    // Highlighting — one live getter shared by both surfaces.
    const getState = (): HighlightState => getSampleDisplayMeta(this.settings.customSampleTypes);
    this.registerEditorExtension(createSampleHighlightPlugin(getState));
    this.registerMarkdownPostProcessor(createSampleReadingHighlighter(getState));

    // Persist sample definitions to {Type}.json when a lab note is edited.
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file instanceof TFile) this.scheduleSampleSync(file);
      })
    );
  }

  /** Debounced write-through of a lab note's sample definitions. */
  private scheduleSampleSync(file: TFile): void {
    if (!file.path.endsWith('.labnote.md')) return;
    const prev = this.sampleSyncTimers.get(file.path);
    if (prev !== undefined) window.clearTimeout(prev);
    const handle = window.setTimeout(() => {
      this.sampleSyncTimers.delete(file.path);
      void this.syncSamples(file);
    }, 800);
    this.sampleSyncTimers.set(file.path, handle);
  }

  private async syncSamples(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      await saveSamplesFromDocument(
        this.fs,
        file.path,
        content,
        this.settings.globalSampleFolder,
        this.settings.customSampleTypes
      );
      // Freshly-written definitions should show up in autocomplete right away.
      this.sampleSuggest?.clearCache();
      this.refreshSampleViews();
    } catch (err) {
      console.warn('[labnoteo] sample sync failed:', err);
    }
  }

  /**
   * Refresh any open Samples sidebar(s). Called explicitly after sample JSON
   * writes because those go through the low-level `adapter.write`
   * ([VaultFileSystem](./vaultFileSystem.ts)), which bypasses the Vault event
   * pipeline — so `vault.on('modify')` cannot be relied on for `{Type}.json`.
   */
  refreshSampleViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(SAMPLE_VIEW_TYPE)) {
      if (leaf.view instanceof SampleTreeView) void leaf.view.refresh();
    }
  }

  /**
   * The path of the most recently active file, if any (vault-relative).
   *
   * Uses `getActiveFile()` rather than `getActiveViewOfType(MarkdownView)` so it
   * keeps returning the last note when focus moves to a sidebar (e.g. the sample
   * view itself). The old approach returned undefined on sidebar focus, which
   * collapsed the sample tree's Local scope to Global and made samples vanish.
   */
  activeNotePath(): string | undefined {
    return this.app.workspace.getActiveFile()?.path;
  }

  notify(message: string): void {
    new Notice(message);
  }

  async loadSettings(): Promise<void> {
    const raw = await this.loadData();
    this.settings = migrateSettings(raw);
    // Persist the upgraded shape once so old `data.json` files converge (and the
    // legacy `llmEndpoint` migration isn't re-run every load).
    const rawVersion =
      raw && typeof raw === 'object'
        ? (raw as Record<string, unknown>).schemaVersion
        : undefined;
    if (rawVersion !== CURRENT_SCHEMA_VERSION) {
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
