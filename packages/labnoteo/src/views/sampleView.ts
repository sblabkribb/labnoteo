/**
 * Samples sidebar (Local + Global scopes).
 *
 * Consumes the core {@link buildSampleTree} model. The Local scope is resolved
 * from the active note's `resources/labsamples` folder, so switching notes
 * re-scopes the tree (via `active-leaf-change`); when no note is active it
 * falls back to the vault-global folder for both scopes.
 */
import { ItemView, Menu, Notice, WorkspaceLeaf } from 'obsidian';
import { buildSampleTree, type TreeNode } from '@labnoteo/core';
import {
  getSampleDisplayMeta,
  buildSampleReferenceText,
} from '@labnoteo/core/lib/sampleUtils';
import { getLabsamplesFolder, type SampleRecord } from '@labnoteo/core/lib/sampleStorage';
import type LabnotePlugin from '../main';
import { renderTree } from './treeRender';
import {
  resolveScopeFolder,
  createSampleInteractive,
  editSampleInteractive,
  deleteSampleInteractive,
  type SampleScope,
} from '../sampleActions';

export const SAMPLE_VIEW_TYPE = 'labnote-sample-view';

interface TypePayload {
  scope: SampleScope;
  type: string;
}

interface SamplePayload {
  scope: SampleScope;
  type: string;
  id: string;
  record: SampleRecord;
}

export class SampleTreeView extends ItemView {
  private readonly expanded = new Set<string>();
  private refreshQueued = false;
  private refreshTimer?: number;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: LabnotePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return SAMPLE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.plugin.t('Samples');
  }

  getIcon(): string {
    return 'test-tube';
  }

  async onOpen(): Promise<void> {
    // Re-scope Local when the active note changes.
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => this.scheduleRefresh())
    );
    // Reflect on-disk {Type}.json writes.
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file.path.endsWith('.json') || file.path.endsWith('.labnote.md')) {
          this.scheduleRefresh();
        }
      })
    );
    await this.refresh();
  }

  /** Coalesce bursts of events into a single debounced refresh. */
  private scheduleRefresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    // Keep the handle so onClose() can cancel a pending refresh; otherwise the
    // timer fires after the view is torn down and touches a dead contentEl.
    this.refreshTimer = window.setTimeout(() => {
      this.refreshQueued = false;
      this.refreshTimer = undefined;
      void this.refresh();
    }, 300);
  }

  async onClose(): Promise<void> {
    if (this.refreshTimer !== undefined) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.refreshQueued = false;
  }

  async refresh(): Promise<void> {
    const activePath = this.plugin.activeNotePath();
    const global = this.plugin.settings.globalSampleFolder;
    const local = activePath ? getLabsamplesFolder(activePath) : global;
    const types = getSampleDisplayMeta(this.plugin.settings.customSampleTypes).types;

    const nodes = await buildSampleTree(this.plugin.fs, { local, global }, types);
    renderTree(
      this.contentEl,
      nodes,
      {
        expanded: this.expanded,
        onContext: (node, evt) => this.onContext(node, evt),
      },
      this
    );
  }

  private onContext(node: TreeNode, evt: MouseEvent): void {
    if (node.kind === 'sampleType') {
      this.onTypeContext(node.payload as TypePayload, evt);
      return;
    }
    if (node.kind === 'sample') {
      this.onSampleContext(node.payload as SamplePayload, evt);
    }
  }

  /** Type node: create a new sample in that scope's folder. */
  private onTypeContext(payload: TypePayload, evt: MouseEvent): void {
    const menu = new Menu();
    menu.addItem(item =>
      item
        .setTitle(this.plugin.t('Add sample'))
        .setIcon('plus')
        .onClick(() => {
          void createSampleInteractive(this.app, this.plugin, {
            type: payload.type,
            folder: resolveScopeFolder(this.plugin, payload.scope),
            mode: 'generate',
          });
        })
    );
    menu.showAtMouseEvent(evt);
  }

  /** Sample node: copy / insert reference / edit / delete. */
  private onSampleContext(sample: SamplePayload, evt: MouseEvent): void {
    const folder = resolveScopeFolder(this.plugin, sample.scope);
    const menu = new Menu();

    menu.addItem(item =>
      item
        .setTitle(this.plugin.t('Copy sample ID'))
        .setIcon('copy')
        .onClick(() => {
          void navigator.clipboard.writeText(sample.id);
          new Notice(this.plugin.t('Copied: {0}', sample.id));
        })
    );
    menu.addItem(item =>
      item
        .setTitle(this.plugin.t('Insert reference'))
        .setIcon('plus')
        .onClick(() => {
          const target = this.plugin.host.editTarget();
          if (!target) {
            new Notice(this.plugin.t('Open a note to insert into.'));
            return;
          }
          void target.insertAtCursor(
            buildSampleReferenceText(sample.id, sample.record.alias)
          );
        })
    );
    menu.addItem(item =>
      item
        .setTitle(this.plugin.t('Edit sample'))
        .setIcon('pencil')
        .onClick(() => {
          void editSampleInteractive(this.app, this.plugin, {
            folder,
            type: sample.type,
            id: sample.id,
            record: sample.record,
          });
        })
    );
    menu.addItem(item =>
      item
        .setTitle(this.plugin.t('Delete sample'))
        .setIcon('trash')
        .onClick(() => {
          void deleteSampleInteractive(this.app, this.plugin, {
            folder,
            type: sample.type,
            id: sample.id,
          });
        })
    );

    menu.showAtMouseEvent(evt);
  }
}
