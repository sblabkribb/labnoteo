/**
 * Platform-neutral tree model.
 *
 * Both the VS Code TreeDataProviders and the Obsidian sidebar `ItemView`s can
 * render the same {@link TreeNode}[] so that tree structure, label formatting
 * and sort order live in exactly one place. Platforms only map `TreeNode` to
 * their native widget (`TreeItem` / DOM).
 */
import type { LabnoteFs } from '../fs/labnoteFs';
import { loadSamplesByType, type SampleRecord } from '../lib/sampleStorage';
import {
  groupWorkflowsByCategory,
  type WorkflowItem,
  type UnitOperationItem,
} from '../lib/workflowDataLoader';
import { sampleTypeColors } from '../lib/sampleUtils';

/** A node kind; mirrors the VS Code `contextValue`s used for menu wiring. */
export type TreeNodeKind =
  | 'sampleRoot'
  | 'sampleType'
  | 'sample'
  | 'sampleDetail'
  | 'workflowRoot'
  | 'category'
  | 'workflow'
  | 'unitOpRoot'
  | 'unitOperation';

export interface TreeNode {
  /** Stable id, unique within its sibling list (used for collapse state). */
  id: string;
  label: string;
  kind: TreeNodeKind;
  icon?: string;
  color?: string;
  tooltip?: string;
  children?: TreeNode[];
  /** Kind-specific data the platform layer needs for actions. */
  payload?: unknown;
}

// ===========================================================================
// Reorder
// ===========================================================================

/**
 * Compute the new ordering after dragging `sourceIds` onto `targetId`.
 *
 * - Sources are removed from their current positions.
 * - They are re-inserted immediately *before* `targetId`.
 * - When `targetId` is undefined or not present, sources are appended.
 * - Relative order of the sources is preserved.
 */
export function computeReorder(
  currentIds: string[],
  sourceIds: string[],
  targetId?: string
): string[] {
  const sourceSet = new Set(sourceIds);
  const remaining = currentIds.filter(id => !sourceSet.has(id));

  let insertAt: number;
  if (targetId != null) {
    const idx = remaining.indexOf(targetId);
    insertAt = idx === -1 ? remaining.length : idx;
  } else {
    insertAt = remaining.length;
  }

  return [
    ...remaining.slice(0, insertAt),
    ...sourceIds,
    ...remaining.slice(insertAt),
  ];
}

// ===========================================================================
// Workflow catalog tree (read-only)
// ===========================================================================

const DBTL_ORDER = ['Design', 'Build', 'Test', 'Learn', 'General'];

export interface WorkflowTreeData {
  workflows: WorkflowItem[];
  hwUnitOps: UnitOperationItem[];
  swUnitOps: UnitOperationItem[];
}

/** Build the 3-level workflow / unit-operation catalog tree. */
export function buildWorkflowTree(data: WorkflowTreeData): TreeNode[] {
  const grouped = groupWorkflowsByCategory(data.workflows);
  const categories = Object.keys(grouped).sort(
    (a, b) => DBTL_ORDER.indexOf(a) - DBTL_ORDER.indexOf(b)
  );

  const workflowRoot: TreeNode = {
    id: 'workflows',
    label: `Workflows [${data.workflows.length}]`,
    kind: 'workflowRoot',
    icon: 'symbol-class',
    children: categories.map(category => ({
      id: `category:${category}`,
      label: `${category} [${grouped[category].length}]`,
      kind: 'category' as const,
      icon: 'folder',
      children: grouped[category].map(wf => ({
        id: `workflow:${wf.id}`,
        label: `${wf.id}: ${wf.name}`,
        kind: 'workflow' as const,
        icon: 'file',
        tooltip: wf.description || undefined,
        payload: wf,
      })),
    })),
  };

  const buildUnitOpRoot = (
    kind: 'hw' | 'sw',
    ops: UnitOperationItem[]
  ): TreeNode => ({
    id: `unitOps:${kind}`,
    label: `${kind === 'hw' ? 'HW' : 'SW'} Unit Operations [${ops.length}]`,
    kind: 'unitOpRoot',
    icon: 'symbol-method',
    payload: { opType: kind },
    children: ops.map(op => ({
      id: `unitOp:${op.id}`,
      label: `${op.id}: ${op.name}`,
      kind: 'unitOperation' as const,
      icon: 'symbol-function',
      tooltip:
        op.description +
        (op.equipment
          ? `\nEquipment: ${op.equipment}`
          : op.software
            ? `\nSoftware: ${op.software}`
            : ''),
      payload: { ...op, opType: kind },
    })),
  });

  return [
    workflowRoot,
    buildUnitOpRoot('hw', data.hwUnitOps),
    buildUnitOpRoot('sw', data.swUnitOps),
  ];
}

// ===========================================================================
// Sample tree (per-vault, disk-backed)
// ===========================================================================

export type SampleScope = 'local' | 'global';

export interface SampleTreeRoots {
  /** Absolute path to the document-local `resources/labsamples` folder. */
  local: string;
  /** Absolute path to the vault/workspace-global `resources/labsamples` folder. */
  global: string;
}

function sampleDetailNodes(idPrefix: string, rec: SampleRecord): TreeNode[] {
  const details: TreeNode[] = [];
  if (rec.alias) {
    details.push({
      id: `${idPrefix}:alias`,
      label: `alias: ${rec.alias}`,
      kind: 'sampleDetail',
    });
  }
  const description = rec.descriptions?.[0];
  if (description) {
    details.push({
      id: `${idPrefix}:description`,
      label: `description: ${description}`,
      kind: 'sampleDetail',
    });
  }
  return details;
}

async function buildScopeNode(
  fs: LabnoteFs,
  scope: SampleScope,
  folder: string,
  types: readonly string[]
): Promise<TreeNode> {
  const typeNodes: TreeNode[] = [];
  for (const type of types) {
    const records = await loadSamplesByType(fs, folder, type);
    const ids = Object.keys(records);
    const sampleNodes: TreeNode[] = ids.map(id => {
      const rec = records[id];
      const label = rec.alias ? `${id} | ${rec.alias}` : id;
      const nodeId = `sample:${scope}:${type}:${id}`;
      return {
        id: nodeId,
        label,
        kind: 'sample' as const,
        tooltip: rec.descriptions?.[0] || undefined,
        payload: { scope, type, id, record: rec },
        children: sampleDetailNodes(nodeId, rec),
      };
    });

    typeNodes.push({
      id: `sampleType:${scope}:${type}`,
      label: `${type} [${ids.length}]`,
      kind: 'sampleType',
      icon: 'symbol-class',
      color: (sampleTypeColors as Record<string, string>)[type],
      payload: { scope, type },
      children:
        sampleNodes.length > 0
          ? sampleNodes
          : [
              {
                id: `sampleType:${scope}:${type}:empty`,
                label: 'No samples',
                kind: 'sampleDetail' as const,
              },
            ],
    });
  }

  return {
    id: `sampleRoot:${scope}`,
    label: scope === 'local' ? 'Samples (Local)' : 'Samples (Global)',
    kind: 'sampleRoot',
    payload: { scope },
    children: typeNodes,
  };
}

/** Build the 4-level sample tree for both scopes. */
export async function buildSampleTree(
  fs: LabnoteFs,
  roots: SampleTreeRoots,
  types: readonly string[]
): Promise<TreeNode[]> {
  return [
    await buildScopeNode(fs, 'local', roots.local, types),
    await buildScopeNode(fs, 'global', roots.global, types),
  ];
}
