/**
 * The `discuss` front-matter flag — "this note needs team discussion".
 *
 * Deliberately separate from `status`: an experiment can be `in-progress` and
 * still need a decision, so flagging must not force a lifecycle change. The
 * flag is what the deterministic `issue-sync` automation promotes to a GitHub
 * Issue (alongside `status: needs-review`).
 *
 * Both readers live here so they cannot drift: the plugin's toggle command and
 * the vault automation must agree on what "flagged" means, or a note can look
 * flagged in Obsidian while the push quietly opens no issue.
 *
 * Domain-only: no Obsidian/Node APIs, so it bundles into the webview and is
 * reusable from the zero-dependency automation scripts.
 */

/** Front-matter key carrying the flag. */
export const DISCUSS_FLAG_KEY = 'discuss';

/**
 * Whether front matter carries the discussion flag.
 *
 * Accepts the boolean `true` and the string `"true"` (case-insensitive): YAML
 * writers and hand edits both occur in practice, and a note reading
 * `discuss: "true"` should not silently fail to open an issue.
 */
export function isDiscussFlagged(frontMatter: Record<string, unknown>): boolean {
  const raw = frontMatter[DISCUSS_FLAG_KEY];
  return raw === true || String(raw).trim().toLowerCase() === 'true';
}

/**
 * Return front matter with the flag turned `on` or off, without mutating the
 * input. Clearing DELETES the key rather than writing `discuss: false`, so
 * notes that were never flagged and notes that no longer are look identical —
 * front matter stays as small as the note actually needs.
 *
 * Key order is preserved; turning the flag on appends it to notes that predate
 * the field.
 */
export function setDiscussFlag(
  frontMatter: Record<string, unknown>,
  on: boolean
): Record<string, unknown> {
  if (on) return { ...frontMatter, [DISCUSS_FLAG_KEY]: true };
  const { [DISCUSS_FLAG_KEY]: _removed, ...rest } = frontMatter;
  return rest;
}
