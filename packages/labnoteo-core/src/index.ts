/**
 * @labnoteo/core — platform-neutral core entry (browser + node safe).
 *
 * This entry MUST NOT import Node-only APIs (fs, path, child_process) so that
 * the vite-bundled webview can consume it. Node-specific helpers live under
 * `@labnoteo/core/node`.
 */

export const CORE_VERSION = '0.69.0';

// === Section domain model + parsers (shared by extension host and webview) ===
export type {
  LabNoteFrontMatter,
  WorkflowReference,
  LabNoteSection,
  LabNoteDocument,
  WorkflowFrontMatter,
  UnitOpSection,
  UnitOperationBlock,
  WorkflowDocument,
} from './sections/sectionTypes';

export {
  parseLabNoteMd,
  serializeLabNoteMd,
} from './sections/labnoteSectionParser';

export {
  parseWorkflowMd,
  serializeWorkflowMd,
  validateWorkflowDocument,
  buildUnitOpTocLine,
  appendUnitOpToWorkflowToc,
  rebuildUnitOpToc,
  locateInsertedUnitOpHeading,
} from './sections/workflowSectionParser';

// Re-exported from the dependency-free heading module so browser consumers
// (webview) get the normalizer without pulling js-yaml into their bundle.
export { normalizeWorkflowUnitSectionHeading } from './sections/unitOpHeading';

// Non-lossy single-section edit (LLM tools + edit-adjacent commands).
export { replaceSectionBody, type SectionEditResult } from './sections/sectionEdit';

// === Transport-agnostic domain tool set (MCP server + built-in AI commands) ===
export {
  createLabnoteTools,
  runTool,
  type ToolDef,
  type ToolContext,
  type ToolResult,
  type JsonSchema,
} from './tools';

// === Host abstraction (platform services for command logic) ===
export type {
  LabnoteHost,
  EditTarget,
  PickItem,
  PromptOpts,
  NotifyKind,
} from './host';

// === Shared command logic (host-driven; consumed by both platforms) ===
export {
  insertUnitOperationAtCursor,
  type InsertUnitOperationInput,
} from './commands/insertUnitOperation';

// === i18n (shared translator; Obsidian t() shim, VS Code keeps native l10n) ===
export {
  createTranslator,
  formatMessage,
  type Translator,
} from './i18n/translator';

// === Sample autocomplete + highlighting (VS Code provider + Obsidian suggest) ===
export {
  parseSampleTrigger,
  buildSampleCompletionEntries,
  buildSampleCompletionLabel,
  buildSampleInsertText,
  findSampleIdRanges,
  findSampleReferenceAt,
  type SampleTrigger,
  type SampleCandidate,
  type SampleCompletionEntry,
  type SampleIdRange,
  type SampleReferenceAt,
} from './sample/sampleSuggest';

// === Platform-neutral tree model (VS Code providers + Obsidian ItemViews) ===
export {
  computeReorder,
  buildWorkflowTree,
  buildSampleTree,
  type TreeNode,
  type TreeNodeKind,
  type WorkflowTreeData,
  type SampleScope,
  type SampleTreeRoots,
} from './tree/treeModel';

// === File-system port (platform-neutral interface; implementations are per-host) ===
export type { LabnoteFs } from './fs/labnoteFs';
// In-memory implementation for tests (browser + node safe; no fs import).
export { MemFileSystem } from './fs/memFileSystem';

export type {
  SampleDefMap,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from './sections/messages';

// === Bundled default catalogs (browser-safe pure data; tree-shaken from webview) ===
export {
  WORKFLOWS_CATALOG,
  UNIT_OPERATIONS_HW_CATALOG,
  UNIT_OPERATIONS_SW_CATALOG,
  CATALOG_FILE_NAMES,
} from './catalog';
export type {
  WorkflowItem,
  WorkflowJson,
  UnitOperationItem,
  UnitOperationJson,
} from './catalog';
