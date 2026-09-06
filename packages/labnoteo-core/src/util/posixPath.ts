/**
 * Platform-neutral POSIX-style path helpers.
 *
 * Core logic must not depend on Node's `path`, whose separator differs by OS
 * (`\` on Windows). Obsidian vault paths are always `/`-separated, and Node on
 * Windows accepts `/` just fine, so we standardise on `/` everywhere.
 *
 * Every helper first converts any backslashes to `/`, so a Windows `fsPath`
 * (e.g. `C:\vault\note.md`) passed in from the VS Code host is handled
 * correctly. A leading drive prefix (`C:`) is preserved so absolute Windows
 * paths survive normalisation and remain comparable.
 */

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Normalise a path: convert separators to `/`, collapse duplicate slashes and
 * resolve `.`/`..` segments. Preserves a leading `/` (POSIX root) and a leading
 * Windows drive (`C:`). Never returns a trailing slash except for the root.
 */
export function normalize(input: string): string {
  const p = toPosix(input);

  // Split off a leading Windows drive (`C:`) so it isn't treated as a segment.
  let drive = '';
  let rest = p;
  const driveMatch = /^([a-zA-Z]:)(\/.*|)$/.exec(p);
  if (driveMatch) {
    drive = driveMatch[1];
    rest = p.slice(drive.length);
  }

  const rooted = rest.startsWith('/');
  const out: string[] = [];
  for (const seg of rest.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') {
        out.pop();
      } else if (!rooted && !drive) {
        out.push('..');
      }
    } else {
      out.push(seg);
    }
  }

  let result = out.join('/');
  if (rooted || drive) {
    result = '/' + result;
  }
  result = drive + result;
  if (result === '') return '.';
  if (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
}

/** Join path segments with `/`, ignoring empty parts, then normalise. */
export function join(...parts: Array<string | undefined | null>): string {
  const filtered = parts.filter((p): p is string => p != null && p !== '');
  if (filtered.length === 0) return '.';
  return normalize(filtered.map(toPosix).join('/'));
}

/** Directory portion of a path (POSIX semantics). */
export function dirname(input: string): string {
  const p = normalize(input);
  const idx = p.lastIndexOf('/');
  if (idx === -1) return '.';
  if (idx === 0) return '/';
  return p.slice(0, idx);
}

/** Final path segment, optionally stripping a trailing extension. */
export function basename(input: string, ext?: string): string {
  let p = toPosix(input);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const idx = p.lastIndexOf('/');
  let base = idx === -1 ? p : p.slice(idx + 1);
  if (ext && base !== ext && base.endsWith(ext)) {
    base = base.slice(0, -ext.length);
  }
  return base;
}

/** Extension of the final segment, including the leading dot (or ''). */
export function extname(input: string): string {
  const base = basename(input);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot);
}

/**
 * Canonical form for comparing two absolute paths for equality, tolerant of
 * separator style and (optionally) case. Callers that need case-insensitive
 * comparison — matching Windows/macOS filesystem semantics used by the sample
 * storage de-dup logic — should lowercase the result.
 */
export function normalizeForCompare(input: string): string {
  return normalize(input);
}
