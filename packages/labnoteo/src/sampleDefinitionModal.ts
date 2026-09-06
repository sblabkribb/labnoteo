/**
 * "Go to definition" popup for a sample reference in the editor.
 *
 * Registry-first: a sample's definition (alias/description) lives in JSON, not
 * in the document. This modal shows the resolved record (local/global registry
 * or the read-only catalog) and offers edit/delete/open-file actions.
 */
import { App, Modal, Notice, Platform, Setting } from 'obsidian';
import * as posix from '@labnoteo/core/posix';
import type LabnotePlugin from './main';
import {
  editSampleInteractive,
  deleteSampleInteractive,
  resolveSampleDefinition,
  type ResolvedSampleDefinition,
} from './sampleActions';

/** Resolve `(type, id)` then show the definition popup (or a Notice if absent). */
export async function openSampleDefinition(
  app: App,
  plugin: LabnotePlugin,
  opts: { type: string; id: string; docPath: string }
): Promise<void> {
  const resolved = await resolveSampleDefinition(plugin, opts);
  if (!resolved) {
    new Notice(plugin.t('No definition found for {0}', opts.id));
    return;
  }
  new SampleDefinitionModal(app, plugin, opts.type, opts.id, resolved).open();
}

class SampleDefinitionModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: LabnotePlugin,
    private readonly type: string,
    private readonly id: string,
    private readonly resolved: ResolvedSampleDefinition
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const t = this.plugin.t;
    const { scope, folder, record } = this.resolved;
    const jsonPath = posix.join(folder, `${this.type}.json`);

    contentEl.createEl('h3', { text: t('Sample definition') });

    const rows: Array<[string, string]> = [
      [t('Type'), this.type],
      [t('ID'), this.id],
      [t('Alias'), record.alias ?? '-'],
      [t('Description'), record.descriptions?.[0] ?? '-'],
      [t('Scope'), scope],
      [t('File'), jsonPath],
    ];
    for (const [name, value] of rows) {
      new Setting(contentEl).setName(name).addText(text => {
        text.setValue(value).setDisabled(true);
      });
    }

    const isEditable = scope !== 'catalog';
    const canOpenFile = isEditable && Platform.isDesktopApp;

    const buttons = new Setting(contentEl);
    if (isEditable) {
      buttons.addButton(btn =>
        btn
          .setButtonText(t('Edit sample'))
          .setCta()
          .onClick(async () => {
            const ok = await editSampleInteractive(this.app, this.plugin, {
              folder,
              type: this.type,
              id: this.id,
              record,
            });
            if (ok) this.close();
          })
      );
      buttons.addButton(btn =>
        btn.setButtonText(t('Delete sample')).setWarning().onClick(async () => {
          const ok = await deleteSampleInteractive(this.app, this.plugin, {
            folder,
            type: this.type,
            id: this.id,
          });
          if (ok) this.close();
        })
      );
    }
    if (canOpenFile) {
      buttons.addButton(btn =>
        btn.setButtonText(t('Open JSON file')).onClick(() => {
          void (
            this.app as unknown as { openWithDefaultApp(p: string): Promise<void> }
          )
            .openWithDefaultApp(jsonPath)
            .catch(() => new Notice(this.plugin.t('Could not open {0}', jsonPath)));
        })
      );
    }
    buttons.addButton(btn => btn.setButtonText(t('Close')).onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
