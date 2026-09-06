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
} from '../catalog';

// Type definitions
export interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface WorkflowJson {
  version: string;
  language: string;
  lastUpdated: string;
  workflows: WorkflowItem[];
}

export interface UnitOperationItem {
  id: string;
  name: string;
  description: string;
  equipment?: string; // HW unit operations
  software?: string;  // SW unit operations
}

export interface UnitOperationJson {
  version: string;
  language: string;
  lastUpdated: string;
  unitOperations: UnitOperationItem[];
}

// Category prefixes for ID generation
const CATEGORY_PREFIXES: Record<string, string> = {
  'Design': 'WD',
  'Build': 'WB',
  'Test': 'WT',
  'Learn': 'WL',
  'General': 'WG',
};

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
    return JSON.parse(content) as WorkflowJson;
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
    return JSON.parse(content) as UnitOperationJson;
  } catch {
    return empty();
  }
}

/**
 * Save workflows to JSON file
 */
export async function saveWorkflows(
  fs: LabnoteFs,
  workspaceRoot: string,
  data: WorkflowJson
): Promise<void> {
  const filePath = getWorkflowFilePath(workspaceRoot, 'workflows');

  // Update lastUpdated
  data.lastUpdated = new Date().toISOString().split('T')[0];

  await fs.write(filePath, JSON.stringify(data, null, 2));
}

/**
 * Save unit operations to JSON file
 */
export async function saveUnitOperations(
  fs: LabnoteFs,
  workspaceRoot: string,
  type: 'hw' | 'sw',
  data: UnitOperationJson
): Promise<void> {
  const filePath = getWorkflowFilePath(workspaceRoot, `unitoperations_${type}`);

  // Update lastUpdated
  data.lastUpdated = new Date().toISOString().split('T')[0];

  await fs.write(filePath, JSON.stringify(data, null, 2));
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

/**
 * Generate next workflow ID for a category
 */
export function generateNextWorkflowId(
  workflows: WorkflowItem[],
  category: string
): string {
  const prefix = CATEGORY_PREFIXES[category] || 'WX';
  
  // Find all IDs with this prefix
  const existingIds = workflows
    .filter(w => w.id.startsWith(prefix))
    .map(w => parseInt(w.id.substring(2), 10))
    .filter(n => !isNaN(n));
  
  // Get max ID and add 10 (IDs are in increments of 10)
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  const nextNum = Math.ceil((maxId + 1) / 10) * 10;
  
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generate next unit operation ID
 */
export function generateNextUnitOpId(
  operations: UnitOperationItem[],
  type: 'hw' | 'sw'
): string {
  const prefix = type === 'hw' ? 'UHW' : 'USW';
  
  // Find all IDs with this prefix
  const existingIds = operations
    .filter(op => op.id.startsWith(prefix))
    .map(op => parseInt(op.id.substring(3), 10))
    .filter(n => !isNaN(n));
  
  // Get max ID and add 10
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  const nextNum = Math.ceil((maxId + 1) / 10) * 10;
  
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Add a new workflow
 */
export function addWorkflow(
  data: WorkflowJson,
  workflow: Partial<WorkflowItem> & { name: string; description: string; category: string }
): WorkflowJson {
  const id = workflow.id || generateNextWorkflowId(data.workflows, workflow.category);
  
  const newWorkflow: WorkflowItem = {
    id,
    name: workflow.name,
    description: workflow.description,
    category: workflow.category,
  };
  
  return {
    ...data,
    workflows: [...data.workflows, newWorkflow],
  };
}

/**
 * Add a new unit operation
 */
export function addUnitOperation(
  data: UnitOperationJson,
  operation: UnitOperationItem
): UnitOperationJson {
  return {
    ...data,
    unitOperations: [...data.unitOperations, operation],
  };
}

/**
 * Search workflows by name, id, or description
 */
export function searchWorkflows(
  workflows: WorkflowItem[],
  query: string
): WorkflowItem[] {
  const lowerQuery = query.toLowerCase();
  return workflows.filter(
    w =>
      w.id.toLowerCase().includes(lowerQuery) ||
      w.name.toLowerCase().includes(lowerQuery) ||
      w.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search unit operations by name, id, or description
 */
export function searchUnitOperations(
  operations: UnitOperationItem[],
  query: string
): UnitOperationItem[] {
  const lowerQuery = query.toLowerCase();
  return operations.filter(
    op =>
      op.id.toLowerCase().includes(lowerQuery) ||
      op.name.toLowerCase().includes(lowerQuery) ||
      op.description.toLowerCase().includes(lowerQuery)
  );
}
