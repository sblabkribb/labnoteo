/**
 * Regex utilities shared across the extension.
 *
 * Keep this module dependency-free so it can be imported by both the Node
 * extension host and (if needed) webview bundles.
 */

/**
 * Escape a string so it can be safely embedded inside a RegExp source and
 * matched as a literal. This is required any time we build a regex from a
 * user-controlled or document-derived string (sample alias, sample id, etc.)
 * — otherwise a `.` or `(` in the input would change the regex meaning and
 * cause incorrect matches or, in the worst case, a syntax error.
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalise an arbitrary title/name into a single safe path segment: collapse
 * whitespace to `_`, keep hyphens, drop anything else that is not a Unicode
 * letter/number/`_`, and trim redundant separators.
 *
 * Dashes (`–`, `—`, …), the minus sign (`−`) and range tildes (`~`, `～`) become an ASCII `-`, so a
 * range like `M1–M8` stays readable as `M1-M8` instead of collapsing to `M1M8`.
 * A separator run containing a hyphen (`M1 – M8` → `M1_-_M8`) is reduced to a
 * single `-`.
 *
 * A minus sign — a dash right before a digit and not after a letter or digit —
 * is kept together with the separator before it, so `냉동고 -20°C` becomes
 * `냉동고_-20C` and `−80°C 보관` becomes `-80C_보관` instead of reading as +80.
 *
 * Uses the Unicode property escapes (`\p{L}\p{N}`) so non-ASCII names (Korean,
 * CJK, accented Latin, …) survive intact. This is the SINGLE rule shared by both
 * the experiment folder-name and the workflow file-name builders, which used to
 * disagree (`[^\w\u3131-\uD79D_]` vs `[^\p{L}\p{N}_]u`) and could produce
 * mismatched folder/file names for the same title in one vault.
 */
export function sanitizePathSegment(input: string): string {
  // Private-use placeholder that shields the sign from separator merging and
  // edge trimming. No lookbehind: the plugin also runs on mobile WebViews.
  const SIGN = '\uE000';
  return input
    .replace(/\uE000/g, '')
    .replace(/(^|[^\p{L}\p{N}])[-\u2212\u2013\uFF0D](?=\d)/gu, `$1${SIGN}`)
    .replace(/[\p{Pd}\u2212~\uFF5E]/gu, '-')
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_\uE000-]/gu, '')
    .replace(/[_-]*-[_-]*/g, '-')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .replace(/\uE000/g, '-');
}
