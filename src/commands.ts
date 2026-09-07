/**
 * Obsidian command implementations.
 *
 * These are thin orchestrators: all domain logic (structure/content generation,
 * checklist parsing, TOC building, path validation) lives in `@labnoteo/core`
 * and is unit-tested there. Each command wires core functions to the
 * {@link LabnoteHost} (modals/notices) and the {@link VaultFileSystem}.
 *
 * Vault root is the empty string: core path helpers join it away, so
 * `join('', 'labnote', ...)` yields vault-relative `labnote/...` paths that the
 * adapter understands.
 */
import { TFile, type App, type Editor } from 'obsidian';
import type {
  LabnoteHost,
  WorkflowItem,
  UnitOperationItem,
  PickItem,
  InsertUnitOperationInput,
} from '@labnoteo/core';
import {
  insertUnitOperationAtCursor,
  rebuildUnitOpToc,
  locateInsertedUnitOpHeading,
} from '@labnoteo/core';
import * as posix from '@labnoteo/core/posix';
import { workflowAliasModal } from './modals';
import { createLabnoteStructure } from '@labnoteo/core/lib/labnoteStructure';
import {
  ensureWorkflowResources,
  loadWorkflows,
  loadUnitOperations,
} from '@labnoteo/core/lib/workflowDataLoader';
import {
  getNextWorkflowNumber,
  createWorkflowFileName,
  createWorkflowContent,
  parseWorkflowChecklistFromReadme,
  generateWorkflowChecklist,
  updateReadmeWorkflowSection,
  parseExperimenterFromReadme,
  reconcileWorkflowChecklist,
  type WorkflowRename,
} from '@labnoteo/core/lib/workflowStructure';
import { removeWorkflowFromReadme } from '@labnoteo/core/lib/workflowDelete';
import {
  removeSourcesForDocument,
  type RemovedSampleRef,
} from '@labnoteo/core/lib/sampleStorage';

// Vault root sentinel. Core loaders treat a falsy root as "no workspace" and
// bail, so we use '.' — it is truthy yet normalises away, keeping every derived
// path clean and vault-relative (e.g. `resources/workflows/...`, `labnote/...`).
const VAULT_ROOT = '.';
const README = 'README.labnote.md';

/** Derive the `labnote/{###_Name}` experiment dir from a vault-relative path. */
export function labnoteDirFromPath(p: string): string | undefined {
  const parts = posix.normalize(p).split('/');
  const idx = parts.lastIndexOf('labnote');
  if (idx === -1 || idx + 1 >= parts.length) return undefined;
  const exp = parts[idx + 1];
  if (!/^\d{3}_/.test(exp)) return undefined;
  return parts.slice(0, idx + 2).join('/');
}

/**
 * Resolve the target experiment folder from the active note's path. Warns and
 * returns undefined when no lab note (a file under `labnote/###_*`) is open.
 */
async function resolveLabnoteDir(app: App, host: LabnoteHost): Promise<string | undefined> {
  // Use the active *file* (not the active MarkdownView) so resolution still
  // works when focus is on a sidebar/tree, e.g. the workflow view context menu.
  const active = app.workspace.getActiveFile()?.path;
  const dir = active ? labnoteDirFromPath(active) : undefined;
  if (!dir) {
    host.notify('warn', host.t('Open a lab note first.'));
    return undefined;
  }
  return dir;
}

/** Create a new experiment folder (labnote/###_Title) + README scaffold. */
export async function createExperimentCommand(app: App, host: LabnoteHost): Promise<void> {
  const title = await host.prompt({
    title: host.t('New experiment'),
    prompt: host.t('Experiment title'),
    validate: v => (v.trim() ? null : host.t('Title is required.')),
  });
  if (!title) return;

  const existing = await host.fs.list('labnote');
  const structure = createLabnoteStructure(VAULT_ROOT, title.trim(), existing);

  await host.fs.mkdir(structure.labnoteFolder);
  await host.fs.mkdir(structure.imagesFolder);
  await host.fs.mkdir(structure.resourcesFolder);
  await host.fs.write(structure.readmePath, structure.readmeContent);

  await host.openFile(structure.readmePath);
  host.notify('info', host.t('Experiment created: {0}', posix.basename(structure.labnoteFolder)));
}

/**
 * Create the workflow file for an already-chosen catalog item inside a resolved
 * experiment folder, register it in the README checklist, and open it. Shared by
 * the command (after the picker) and the sidebar context menu.
 */
async function createWorkflowFromChoice(
  app: App,
  host: LabnoteHost,
  labnoteDir: string,
  chosen: WorkflowItem
): Promise<void> {
  const created = await createWorkflowFile(app, host, labnoteDir, chosen);
  if (!created) return;
  await host.openFile(created.path);
  host.notify('info', host.t('Workflow created: {0}', created.fileName));
}

/** Details of a freshly created workflow file. */
interface CreatedWorkflow {
  /** Vault-relative path of the new workflow file. */
  path: string;
  /** File name (basename with extension). */
  fileName: string;
  /** Human-readable `id name [alias]` used for checklist/link display. */
  displayTitle: string;
}

/**
 * Prompt for an optional alias, write the workflow file and register it in the
 * README checklist. Does NOT open the file — callers decide what to do with the
 * result (open it, or insert a link at the cursor). Returns undefined if the
 * alias prompt was cancelled.
 */
async function createWorkflowFile(
  app: App,
  host: LabnoteHost,
  labnoteDir: string,
  chosen: WorkflowItem
): Promise<CreatedWorkflow | undefined> {
  // Ask for an optional per-instance alias. The catalog name stays inside the
  // `[id name]` prefix; the alias (if any) is appended after it.
  const alias = await workflowAliasModal(app, {
    id: chosen.id,
    catalogName: chosen.name,
    title: host.t('Workflow name'),
    placeholder: host.t('Enter a name for this workflow'),
  });
  if (alias === undefined) return undefined; // cancelled
  const cleanAlias = alias.trim();

  const readmePath = posix.join(labnoteDir, README);
  let experimenter = '';
  if (await host.fs.exists(readmePath)) {
    experimenter = parseExperimenterFromReadme(await host.fs.read(readmePath));
  }

  const existingFiles = await host.fs.list(labnoteDir);
  const sequence = getNextWorkflowNumber(existingFiles);
  const info = { id: chosen.id, name: chosen.name, description: chosen.description };
  const fileName = createWorkflowFileName(sequence, info, cleanAlias || undefined);
  const workflowPath = posix.join(labnoteDir, fileName);

  await host.fs.write(
    workflowPath,
    createWorkflowContent(info, experimenter, cleanAlias || undefined)
  );

  const displayTitle = cleanAlias
    ? `${chosen.id} ${chosen.name} ${cleanAlias}`
    : `${chosen.id} ${chosen.name}`;

  // Register in the README "Related Workflows" checklist (non-destructive).
  if (await host.fs.exists(readmePath)) {
    const readme = await host.fs.read(readmePath);
    const items = parseWorkflowChecklistFromReadme(readme);
    items.push({ done: false, title: displayTitle, fileName });
    const updated = updateReadmeWorkflowSection(readme, generateWorkflowChecklist(items));
    await host.fs.write(readmePath, updated);
  }

  return { path: workflowPath, fileName, displayTitle };
}

/** Present the workflow catalog picker (seeding catalog resources first). */
async function pickWorkflow(host: LabnoteHost): Promise<WorkflowItem | undefined> {
  await ensureWorkflowResources(host.fs, VAULT_ROOT);
  const catalog = await loadWorkflows(host.fs, VAULT_ROOT);
  return host.pick(
    catalog.workflows.map<PickItem<WorkflowItem>>(wf => ({
      label: `${wf.id}: ${wf.name}`,
      description: wf.category,
      detail: wf.description,
      value: wf,
    })),
    { title: host.t('Select workflow'), placeholder: host.t('Search workflows') }
  );
}

/**
 * Create a specific catalog workflow into the current experiment, resolving the
 * target experiment folder from the active note. Used by the workflow sidebar's
 * context menu, where the workflow is already known.
 */
export async function createWorkflowForItem(
  app: App,
  host: LabnoteHost,
  chosen: WorkflowItem
): Promise<void> {
  const labnoteDir = await resolveLabnoteDir(app, host);
  if (!labnoteDir) return;
  await createWorkflowFromChoice(app, host, labnoteDir, chosen);
}

/** Create a new workflow file inside an experiment + register it in the README. */
export async function createWorkflowCommand(app: App, host: LabnoteHost): Promise<void> {
  const labnoteDir = await resolveLabnoteDir(app, host);
  if (!labnoteDir) return;

  const chosen = await pickWorkflow(host);
  if (!chosen) return;

  await createWorkflowFromChoice(app, host, labnoteDir, chosen);
}

/**
 * Create a workflow file (same flow as {@link createWorkflowCommand}) and insert
 * a link to it at the current cursor position. Invoked from the editor
 * right-click menu on a `.labnote.md` note.
 */
export async function insertWorkflowLinkCommand(
  app: App,
  host: LabnoteHost,
  editor: Editor
): Promise<void> {
  const labnoteDir = await resolveLabnoteDir(app, host);
  if (!labnoteDir) return;

  const chosen = await pickWorkflow(host);
  if (!chosen) return;

  const created = await createWorkflowFile(app, host, labnoteDir, chosen);
  if (!created) return;

  // `createWorkflowFile` already registered the workflow in the experiment
  // README's "Related Workflows" checklist. When this command is invoked on the
  // README itself, that checklist entry *is* the link — inserting another one at
  // the cursor would duplicate it (the reported bug). So only add a cursor link
  // when editing some other note.
  const readmePath = posix.join(labnoteDir, README);
  if (app.workspace.getActiveFile()?.path === readmePath) {
    host.notify('info', host.t('Workflow created: {0}', created.fileName));
    return;
  }

  // Resolve the TFile for a settings-aware link. A file written through the
  // adapter may lag the vault index, so retry briefly before falling back.
  let file = app.vault.getAbstractFileByPath(created.path);
  for (let i = 0; i < 10 && !(file instanceof TFile); i++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    file = app.vault.getAbstractFileByPath(created.path);
  }

  const sourcePath = app.workspace.getActiveFile()?.path ?? '';
  const link =
    file instanceof TFile
      ? app.fileManager.generateMarkdownLink(file, sourcePath, undefined, created.displayTitle)
      : `[[${created.fileName.replace(/\.md$/, '')}|${created.displayTitle}]]`;

  editor.replaceSelection(link);
  host.notify('info', host.t('Workflow created: {0}', created.fileName));
}

/**
 * Insert a unit-operation block at the cursor, then rebuild the
 * `## Related Unit Operations` TOC so its entries follow the document order of
 * the actual `### [..]` headings. Finally, move the cursor/focus to the
 * just-inserted heading. Shared by the command and the workflow sidebar's
 * context menu.
 */
export async function insertUnitOpAndUpdateToc(
  host: LabnoteHost,
  input: InsertUnitOperationInput
): Promise<boolean> {
  // Capture the cursor BEFORE inserting: the inserted block lands here, which
  // lets us relocate the new heading after the whole-doc TOC rewrite.
  const before = host.editTarget();
  const cursorBefore = before?.getCursorOffset ? await before.getCursorOffset() : -1;

  const ok = await insertUnitOperationAtCursor(host, input);
  if (!ok) return false;

  const target = host.editTarget();
  if (target) {
    const md = await target.getText();
    const updated = rebuildUnitOpToc(md);
    if (updated !== md) {
      await target.replaceRange(0, md.length, updated);
    }
    // Whole-doc replaceRange resets the cursor, so explicitly move focus to the
    // inserted unit-operation heading in the final (rebuilt) text.
    if (target.revealOffset && cursorBefore >= 0) {
      const off = locateInsertedUnitOpHeading(md, cursorBefore, updated);
      if (off >= 0) await target.revealOffset(off);
    }
  }
  return true;
}

/** Insert a unit-operation block at the cursor + update the workflow TOC. */
export async function insertUnitOperationCommand(app: App, host: LabnoteHost): Promise<void> {
  await ensureWorkflowResources(host.fs, VAULT_ROOT);
  const hw = await loadUnitOperations(host.fs, VAULT_ROOT, 'hw');
  const sw = await loadUnitOperations(host.fs, VAULT_ROOT, 'sw');

  const items: PickItem<{ op: UnitOperationItem; kind: 'hw' | 'sw' }>[] = [
    ...hw.unitOperations.map(op => ({
      label: `${op.id}: ${op.name}`,
      description: 'HW',
      detail: op.description,
      value: { op, kind: 'hw' as const },
    })),
    ...sw.unitOperations.map(op => ({
      label: `${op.id}: ${op.name}`,
      description: 'SW',
      detail: op.description,
      value: { op, kind: 'sw' as const },
    })),
  ];

  const chosen = await host.pick(items, {
    title: host.t('Insert unit operation'),
    placeholder: host.t('Search unit operations'),
  });
  if (!chosen) return;

  const { op, kind } = chosen;
  await insertUnitOpAndUpdateToc(host, {
    opId: op.id,
    opName: op.name,
    opDescription: op.description,
    opType: kind,
    equipment: op.equipment,
    software: op.software,
  });
}

// === README auto-sync on native rename / delete ==============================
//
// Instead of custom rename/renumber/delete commands, we react to Obsidian's own
// file-explorer rename/delete events (wired in main.ts) and keep the README
// "Related Workflows" checklist — and, on delete, the sample tree — in sync.
// The pure domain logic lives in `@labnoteo/core`
// (reconcileWorkflowChecklist / removeWorkflowFromReadme / removeSourcesForDocument);
// these helpers sequence the Obsidian-side reads/writes.

/**
 * Write note content, preferring the Vault API so an already-open README
 * refreshes immediately. `vault.process` fires only a 'modify' event (never
 * rename/delete), so it cannot re-enter the workflow README sync listeners.
 * Falls back to the adapter when the file is not (yet) in the vault index.
 * (Data files such as `{Type}.json` keep using the adapter directly.)
 *
 * Exported as the `writeNote` hook for `ToolContext`: AI tools edit notes the
 * user may have open, and writing those through the adapter would be silently
 * undone the next time the editor flushed its buffer.
 */
export async function writeNoteThroughVault(
  app: App,
  host: LabnoteHost,
  notePath: string,
  content: string
): Promise<void> {
  const file = app.vault.getFileByPath(notePath);
  if (file instanceof TFile) {
    await app.vault.process(file, () => content);
  } else {
    await host.fs.write(notePath, content);
  }
}

/**
 * After workflow files were renamed in the file explorer, reorder the README
 * "Related Workflows" checklist to match the new `NNN` order. `renames` are the
 * old->new basenames accumulated for one experiment folder; passing them lets
 * reconcile relink correctly even when Obsidian's "Automatically update
 * internal links" setting is off. Only writes when the section actually changes.
 */
export async function syncReadmeOrderOnRename(
  app: App,
  host: LabnoteHost,
  labnoteDir: string,
  renames: WorkflowRename[]
): Promise<void> {
  const readmePath = posix.join(labnoteDir, README);
  if (!(await host.fs.exists(readmePath))) return;
  const readme = await host.fs.read(readmePath);
  const res = reconcileWorkflowChecklist(readme, renames);
  if (res.changed) {
    await writeNoteThroughVault(app, host, readmePath, res.content);
  }
}

/** Sample-tree cleanup context for {@link syncReadmeAndSamplesOnDelete}. */
export interface SampleCleanupOpts {
  globalSampleFolder?: string;
  customTypes?: string[];
  /** Called after samples were pruned so the caller can refresh views/caches. */
  onSamplesChanged?: () => void;
}

/**
 * After workflow files were deleted in the file explorer, remove their README
 * checklist entries (surgically — preserving order + any manual links) and
 * prune the sample tree of sources only these documents defined. Returns every
 * auto-removed sample so the caller can surface a toast + refresh views.
 */
export async function syncReadmeAndSamplesOnDelete(
  app: App,
  host: LabnoteHost,
  labnoteDir: string,
  deletedPaths: string[],
  opts: SampleCleanupOpts = {}
): Promise<RemovedSampleRef[]> {
  // 1) README: drop each deleted entry in one read-modify-write. The README may
  //    itself be gone (whole-folder delete); then there is nothing to prune.
  const readmePath = posix.join(labnoteDir, README);
  if (await host.fs.exists(readmePath)) {
    let content = await host.fs.read(readmePath);
    let changed = false;
    for (const p of deletedPaths) {
      const res = removeWorkflowFromReadme(content, posix.basename(p));
      if (res.changed) {
        content = res.content;
        changed = true;
      }
    }
    if (changed) await writeNoteThroughVault(app, host, readmePath, content);
  }

  // 2) Samples: a deleted document defines nothing, so pass empty text — every
  //    record that listed this note as a source drops it (and is deleted if it
  //    becomes orphaned). Failures are non-fatal: the file is already gone.
  const removed: RemovedSampleRef[] = [];
  for (const p of deletedPaths) {
    try {
      const r = await removeSourcesForDocument(
        host.fs,
        p,
        '',
        opts.globalSampleFolder,
        opts.customTypes
      );
      removed.push(...r);
    } catch (err) {
      console.warn('[labnoteo] sample cleanup during workflow delete failed:', err);
    }
  }
  return removed;
}
