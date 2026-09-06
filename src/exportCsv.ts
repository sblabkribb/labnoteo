/**
 * Export every Markdown table in a lab note to sibling `.csv` files.
 *
 * Reuses the pure core helpers ({@link extractMarkdownTables},
 * {@link tableToCsv}); this module only handles vault I/O and user feedback.
 */
import { Notice, TFile } from 'obsidian';
import * as posix from '@labnoteo/core/posix';
import { extractMarkdownTables, tableToCsv } from '@labnoteo/core/lib/exportTablesCsv';
import type LabnotePlugin from './main';

/** Strip the trailing `.md` (keeps a compound `.labnote` stem). */
function noteStem(file: TFile): string {
  return file.name.replace(/\.md$/i, '');
}

export async function exportTablesToCsv(plugin: LabnotePlugin, file: TFile): Promise<void> {
  const content = await plugin.app.vault.read(file);
  const tables = extractMarkdownTables(content);
  if (tables.length === 0) {
    new Notice(plugin.t('No tables found in this note.'));
    return;
  }

  const dir = posix.dirname(file.path);
  const stem = noteStem(file);
  let written = 0;
  for (const table of tables) {
    const outPath = posix.join(dir, `${stem}_table${table.index + 1}.csv`);
    await plugin.fs.write(outPath, tableToCsv(table.rows));
    written++;
  }

  new Notice(plugin.t('Exported {0} CSV file(s).', String(written)));
}

/** Export tables from the currently active markdown note (command palette). */
export async function exportActiveNoteTablesToCsv(plugin: LabnotePlugin): Promise<void> {
  const file = plugin.app.workspace.getActiveFile();
  if (!file || file.extension !== 'md') {
    new Notice(plugin.t('Open a markdown note first.'));
    return;
  }
  await exportTablesToCsv(plugin, file);
}
