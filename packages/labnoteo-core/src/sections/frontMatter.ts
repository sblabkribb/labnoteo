import * as yaml from 'js-yaml';

/** Result of {@link parseFrontMatterYaml}. */
export interface FrontMatterParse {
  frontMatter: Record<string, unknown>;
  body: string;
  /**
   * Set only when a `---` block WAS present but could not be read as a YAML
   * mapping. `frontMatter` is then empty, which is indistinguishable from a
   * note that simply has no front matter — so any caller that writes the note
   * back must check this first and bail out.
   *
   * A note with no `---` block at all is not an error and leaves this unset.
   */
  parseError?: string;
}

/**
 * Parse a `---` front-matter block using a real YAML parser (js-yaml).
 *
 * The previous line-based parser silently dropped YAML list items (Obsidian
 * `tags`/`aliases`) and flattened nested keys. Using js-yaml preserves the full
 * structure. CORE_SCHEMA (YAML 1.2) keeps ISO dates as plain strings and does
 * NOT coerce `yes/no` to booleans, matching the historical string handling.
 *
 * Reading stays lenient — a broken block yields an empty `frontMatter` so the
 * body still renders — but the failure is now reported in `parseError` instead
 * of being swallowed. An unquoted colon (`title: EXP: 3rd try`) is enough to
 * break the block, and callers that re-serialized the empty result were
 * erasing every other field in the note.
 *
 * Callers must already have normalized CRLF → LF (the block regex requires
 * a bare `\n` after the opening `---`).
 */
export function parseFrontMatterYaml(md: string): FrontMatterParse {
  // The closing fence must be a line that is exactly `---` (optional trailing
  // spaces/tabs) followed by a newline or end-of-input. Without the line anchor
  // a `----` (4-dash) body line was mistaken for the closing fence and ate part
  // of the document.
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!fmMatch) {
    return { frontMatter: {}, body: md };
  }
  const yamlBlock = fmMatch[1];
  const body = md.slice(fmMatch[0].length).replace(/^\n+/, '');

  // An empty block (`---\n---`) is legitimately "no fields", not a failure.
  if (yamlBlock.trim() === '') {
    return { frontMatter: {}, body };
  }

  try {
    const loaded = yaml.load(yamlBlock, { schema: yaml.CORE_SCHEMA });
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      return { frontMatter: loaded as Record<string, unknown>, body };
    }
    // Valid YAML, but a scalar or a list — there are no fields to read, and
    // re-serializing would drop whatever the author wrote.
    return {
      frontMatter: {},
      body,
      parseError: 'front matter is not a YAML mapping (expected `key: value` lines)',
    };
  } catch (err) {
    return {
      frontMatter: {},
      body,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Serialize a single non-known front-matter entry.
 *
 * Every non-null value (scalars included) goes through `yaml.dump`, so a scalar
 * that needs quoting — most importantly one containing a colon, e.g.
 * `Exp: run 1` — is emitted as valid YAML (`title: 'Exp: run 1'`) and survives a
 * serialize → parse round-trip instead of silently resetting the whole block to
 * `{}`. Lists and nested maps are emitted as proper YAML (2-space indent, no
 * line wrapping) so Obsidian `tags`/`aliases` survive too. `null`/`undefined`
 * keep the compact empty `key: ` form used by the workflow/readme templates.
 */
export function serializeFrontMatterEntry(key: string, val: unknown): string {
  if (val === null || val === undefined) {
    return `${key}: `;
  }
  const dumped = yaml.dump({ [key]: val }, {
    schema: yaml.CORE_SCHEMA,
    lineWidth: -1,
    noRefs: true,
  });
  return dumped.replace(/\n+$/, '');
}
