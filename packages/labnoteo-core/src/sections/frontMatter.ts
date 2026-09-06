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
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
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
 * Scalars keep the legacy compact `key: value` one-liner so existing notes are
 * unchanged; lists and nested maps are emitted as proper YAML (2-space indent,
 * no line wrapping) so Obsidian `tags`/`aliases` survive the round-trip.
 */
export function serializeFrontMatterEntry(key: string, val: unknown): string {
  if (val === null || val === undefined) {
    return `${key}: `;
  }
  if (typeof val !== 'object') {
    return `${key}: ${val}`;
  }
  const dumped = yaml.dump({ [key]: val }, {
    schema: yaml.CORE_SCHEMA,
    lineWidth: -1,
    noRefs: true,
  });
  return dumped.replace(/\n+$/, '');
}
