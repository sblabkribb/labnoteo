/**
 * Renders a platform-neutral {@link TreeNode}[] (from `@labnoteo/core`) into an
 * Obsidian sidebar using only `createEl`/`setIcon` — no innerHTML. Collapse
 * state is caller-owned (a `Set<string>` of expanded node ids) so it survives
 * re-renders.
 */
import { setIcon } from 'obsidian';
import type { TreeNode } from '@labnoteo/core';

/** Map the core (VS Code codicon) icon names to Obsidian's Lucide set. */
const ICON_MAP: Record<string, string> = {
  'symbol-class': 'box',
  folder: 'folder',
  file: 'file-text',
  'symbol-method': 'wrench',
  'symbol-function': 'square-function',
};

export interface TreeRenderCtx {
  expanded: Set<string>;
  onClick?: (node: TreeNode, evt: MouseEvent) => void;
  onContext?: (node: TreeNode, evt: MouseEvent) => void;
}

export function renderTree(
  container: HTMLElement,
  nodes: TreeNode[],
  ctx: TreeRenderCtx
): void {
  container.empty();
  container.addClass('labnote-tree');
  for (const node of nodes) renderNode(container, node, ctx, 0);
}

function renderNode(
  parent: HTMLElement,
  node: TreeNode,
  ctx: TreeRenderCtx,
  depth: number
): void {
  const hasChildren = !!node.children && node.children.length > 0;
  const row = parent.createDiv({ cls: 'labnote-tree-row' });
  row.style.paddingLeft = `${depth * 14 + 4}px`;

  const twistie = row.createSpan({ cls: 'labnote-tree-twistie' });
  const expanded = ctx.expanded.has(node.id);
  if (hasChildren) setIcon(twistie, expanded ? 'chevron-down' : 'chevron-right');

  if (node.color) {
    const dot = row.createSpan({ cls: 'labnote-tree-dot' });
    dot.style.cssText =
      `display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;background:${node.color};`;
  } else if (node.icon && ICON_MAP[node.icon]) {
    const iconEl = row.createSpan({ cls: 'labnote-tree-icon' });
    setIcon(iconEl, ICON_MAP[node.icon]);
  }

  row.createSpan({ cls: 'labnote-tree-label', text: node.label });
  if (node.tooltip) row.setAttr('aria-label', node.tooltip);

  const childrenEl = parent.createDiv({ cls: 'labnote-tree-children' });
  childrenEl.style.display = expanded ? '' : 'none';
  if (hasChildren) {
    for (const child of node.children!) renderNode(childrenEl, child, ctx, depth + 1);
  }

  row.addEventListener('click', evt => {
    if (hasChildren) {
      const nowExpanded = childrenEl.style.display === 'none';
      childrenEl.style.display = nowExpanded ? '' : 'none';
      if (nowExpanded) ctx.expanded.add(node.id);
      else ctx.expanded.delete(node.id);
      setIcon(twistie, nowExpanded ? 'chevron-down' : 'chevron-right');
    }
    ctx.onClick?.(node, evt);
  });

  row.addEventListener('contextmenu', evt => {
    evt.preventDefault();
    ctx.onContext?.(node, evt);
  });
}
