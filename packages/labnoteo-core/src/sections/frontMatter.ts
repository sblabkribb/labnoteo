import * as yaml from 'js-yaml';

/**
 * Parse a `---` front-matter block using a real YAML parser (js-yaml).
 *
 * The previous line-based parser silently dropped YAML list items (Obsidian
 * `tags`/`aliases`) and flattened nested keys. Using js-yaml preserves the full
 * structure. CORE_SCHEMA (YAML 1.2) keeps ISO dates as plain strings and does
 * NOT coerce `yes/no` to booleans, matching the historical string handling.
 *
 * Callers must already have normalized CRLF → LF (the block regex requires
 * a bare `\n` after the opening `---`).
 */
export function parseFrontMatterYaml(md: string): {
  frontMatter: Record<string, unknown>;
  body: string;
} {
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

  let frontMatter: Record<string, unknown> = {};
  try {
    const loaded = yaml.load(yamlBlock, { schema: yaml.CORE_SCHEMA });
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      frontMatter = loaded as Record<string, unknown>;
    }
  } catch {
    // Malformed YAML: fall back to an empty object rather than throwing so the
    // document body still renders (mirrors the old lenient behaviour).
    frontMatter = {};
  }
  return { frontMatter, body };
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
