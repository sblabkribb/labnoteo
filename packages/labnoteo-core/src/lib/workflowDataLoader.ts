/**
 * Workflow Data Loader
 * Handles loading, saving, and copying workflow/unit operation JSON files
 */

import * as path from '../util/posixPath';
import type { LabnoteFs } from '../fs/labnoteFs';
import {
  WORKFLOWS_CATALOG,
  UNIT_OPERATIONS_HW_CATALOG,
  UNIT_OPERATIONS_SW_CATALOG,
  CATALOG_FILE_NAMES,
  type WorkflowItem,
  type WorkflowJson,
  type UnitOperationItem,
  type UnitOperationJson,
} from '../catalog';

// The catalog shapes live in `../catalog` (the single source of truth for both
// the bundled constants and their types). They were previously re-declared here
// verbatim; re-export instead so existing `@labnoteo/core/lib/workflowDataLoader`
// consumers keep importing the same names.
export type { WorkflowItem, WorkflowJson, UnitOperationItem, UnitOperationJson };

/**
 * Get the file path for workflow-related JSON files
 */
export function getWorkflowFilePath(
  workspaceRoot: string,
  fileType: 'workflows' | 'unitoperations_hw' | 'unitoperations_sw'
): string {
  const fileName = `${fileType}_en.json`;
  return path.join(workspaceRoot, 'resources', 'workflows', fileName);
}

/**
 * Ensure the editable workspace copy of the workflow catalogs exists.
 *
 * The catalogs are bundled into `@labnoteo/core` (single source of truth), so
 * missing files are seeded by serializing the bundled constants rather than
 * copying loose files from the extension install directory. This works for
 * both VS Code and Obsidian (which ships no loose files) and avoids the old
 * failure mode where a missing source silently left the tree view empty.
 */
export async function ensureWorkflowResources(fs: LabnoteFs, workspaceRoot: string): Promise<void> {
  // Skip if path is invalid (e.g., in test environment)
  if (!workspaceRoot) {
    return;
  }

  try {
    const workspaceWorkflowsDir = path.join(workspaceRoot, 'resources', 'workflows');

    // Seed each catalog file from the bundled constant if it does not exist.
    // The adapter's `write` creates parent directories on demand.
    const seeds: Array<{ file: string; data: unknown }> = [
      { file: CATALOG_FILE_NAMES.workflows, data: WORKFLOWS_CATALOG },
      { file: CATALOG_FILE_NAMES.unitOperationsHw, data: UNIT_OPERATIONS_HW_CATALOG },
      { file: CATALOG_FILE_NAMES.unitOperationsSw, data: UNIT_OPERATIONS_SW_CATALOG },
    ];

    for (const { file, data } of seeds) {
      const destPath = path.join(workspaceWorkflowsDir, file);
      if (!(await fs.exists(destPath))) {
        await fs.write(destPath, JSON.stringify(data, null, 2));
      }
    }
  } catch (error) {
    // Silently fail in test/dev environments
    console.error('[workflowDataLoader] Error ensuring workflow resources:', error);
  }
}

/**
 * Load workflows from JSON file
 */
export async function loadWorkflows(fs: LabnoteFs, workspaceRoot: string): Promise<WorkflowJson> {
  const empty = (): WorkflowJson => ({
    version: '0.1.0',
    language: 'English',
    lastUpdated: new Date().toISOString().split('T')[0],
    workflows: [],
  });

  // Return empty structure if workspaceRoot is invalid
  if (!workspaceRoot) {
    return empty();
  }

  const filePath = getWorkflowFilePath(workspaceRoot, 'workflows');

  if (!(await fs.exists(filePath))) {
    return empty();
  }

  try {
    const content = await fs.read(filePath);
    const parsed = JSON.parse(content) as Partial<WorkflowJson>;
    // Guard the shape: a malformed file (or one missing `workflows`) must not
    // hand a non-array through to callers that iterate it.
    if (!parsed || !Array.isArray(parsed.workflows)) return empty();
    return { ...empty(), ...parsed, workflows: parsed.workflows };
  } catch {
    return empty();
  }
}

/**
 * Load unit operations from JSON file
 */
export async function loadUnitOperations(
  fs: LabnoteFs,
  workspaceRoot: string,
  type: 'hw' | 'sw'
): Promise<UnitOperationJson> {
  const empty = (): UnitOperationJson => ({
    version: '0.1.0',
    language: 'English',
    lastUpdated: new Date().toISOString().split('T')[0],
    unitOperations: [],
  });

  // Return empty structure if workspaceRoot is invalid
  if (!workspaceRoot) {
    return empty();
  }

  const filePath = getWorkflowFilePath(workspaceRoot, `unitoperations_${type}`);

  if (!(await fs.exists(filePath))) {
    return empty();
  }

  try {
    const content = await fs.read(filePath);
    const parsed = JSON.parse(content) as Partial<UnitOperationJson>;
    if (!parsed || !Array.isArray(parsed.unitOperations)) return empty();
    return { ...empty(), ...parsed, unitOperations: parsed.unitOperations };
  } catch {
    return empty();
  }
}

/**
 * Group workflows by category
 */
export function groupWorkflowsByCategory(
  workflows: WorkflowItem[]
): Record<string, WorkflowItem[]> {
  return workflows.reduce((acc, workflow) => {
    const category = workflow.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(workflow);
    return acc;
  }, {} as Record<string, WorkflowItem[]>);
}
