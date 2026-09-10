/**
 * Experiment status vocabulary + validation.
 *
 * The controlled set of experiment lifecycle states, shared by the plugin
 * (status picker + README frontmatter) and — once `@labnoteo/core` is published
 * — the vault-repo automation (validate/issue-sync). Domain-only: NO
 * Obsidian/Node APIs, so it is safe to bundle into the webview and to reuse from
 * Node scripts. This is the single source of truth for the status terms; the
 * plugin/automation must not re-declare them.
 */

/** Allowed `status` values for a lab-note experiment, in rough lifecycle order. */
export const EXPERIMENT_STATUSES = [
  'planned',
  'in-progress',
  'needs-review',
  'completed',
  'failed',
  'discontinued',
  'needs-repeat',
] as const;

/** A single valid experiment status (the union of {@link EXPERIMENT_STATUSES}). */
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

/** Whether `x` is one of the allowed {@link EXPERIMENT_STATUSES}. */
export function isValidStatus(x: string): boolean {
  return (EXPERIMENT_STATUSES as readonly string[]).includes(x);
}
