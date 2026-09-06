/**
 * Shared command logic: insert a Unit Operation block at the cursor.
 *
 * This is the platform-neutral (text-editor / Obsidian CM6) path. It is written
 * against {@link LabnoteHost} so both the VS Code extension and the Obsidian
 * plugin can call it. VS Code additionally keeps a Section-Editor webview path
 * that this function does not attempt to model.
 */
import type { LabnoteHost } from '../host';
import { isValidWorkflowPath, parseExperimenterFromReadme } from '../lib/workflowStructure';
import { getSeoulDateTimeString } from '../lib/dateUtils';
import { buildSwUnitOpMarkdown, buildHwUnitOpMarkdown } from '../lib/unitOpTemplate';
import * as posix from '../util/posixPath';

/** The unit-operation payload a caller (tree/menu/suggest) provides. */
export interface InsertUnitOperationInput {
  opId: string;
  opName: string;
  opDescription?: string;
  opType: 'hw' | 'sw';
  equipment?: string;
  software?: string;
}

/**
 * Insert a unit-operation template at the active cursor.
 *
 * Returns `true` when a block was inserted, `false` when the command bailed
 * (no active workflow document, invalid path, or missing info) — after already
 * having notified the user in that case.
 */
export async function insertUnitOperationAtCursor(
  host: LabnoteHost,
  input: InsertUnitOperationInput
): Promise<boolean> {
  const target = host.editTarget();
  if (!target) {
    host.notify('warn', host.t('Please open a workflow file.'));
    return false;
  }

  if (!isValidWorkflowPath(target.path)) {
    host.notify(
      'warn',
      host.t('Please run this command on a workflow file inside the labnote folder.')
    );
    return false;
  }

  const { opId, opName, opDescription, opType, equipment, software } = input;
  if (!opId || !opName) {
    host.notify('error', host.t('Missing unit operation info.'));
    return false;
  }

  // Experimenter comes from the sibling README front matter, if present.
  const readmePath = posix.join(posix.dirname(target.path), 'README.labnote.md');
  let experimenter = '';
  if (await host.fs.exists(readmePath)) {
    experimenter = parseExperimenterFromReadme(await host.fs.read(readmePath));
  }

  const dateTime = getSeoulDateTimeString();
  const info = { opId, opName, opDescription: opDescription ?? '' };
  const template =
    opType === 'sw'
      ? buildSwUnitOpMarkdown(info, { experimenter, dateTime, software })
      : buildHwUnitOpMarkdown(info, { experimenter, dateTime, equipment });

  await target.insertAtCursor(template);
  host.notify('info', host.t('Unit operation inserted: {0} {1}', opId, opName));
  return true;
}
