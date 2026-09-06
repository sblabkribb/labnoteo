/**
 * Platform-neutral translator.
 *
 * VS Code ships its own file-based `vscode.l10n` runtime (driven by
 * `l10n/bundle.l10n.*.json` + `package.nls.json`), so the extension keeps using
 * that natively. Obsidian has no such runtime, so its {@link LabnoteHost.t}
 * shim is built on this helper, reusing the *same* Korean bundle JSON as the
 * single source of translated strings.
 *
 * The substitution syntax mirrors `vscode.l10n.t`: positional `{0}`, `{1}` …
 * placeholders are replaced by the corresponding argument. Unknown keys fall
 * through to the key itself (which is the English source string by convention),
 * so a missing translation degrades to English rather than throwing.
 */

export type Translator = (key: string, ...args: Array<string | number | boolean>) => string;

/** Replace `{0}`,`{1}`… placeholders in `template` with `args`. */
export function formatMessage(
  template: string,
  args: Array<string | number | boolean>
): string {
  if (args.length === 0) return template;
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const i = Number(index);
    return i < args.length ? String(args[i]) : match;
  });
}

/**
 * Build a {@link Translator} over a `key -> translated string` catalog.
 *
 * @param messages the localized catalog (e.g. the parsed Korean bundle). When
 *   omitted/empty the translator is an identity-with-substitution function, i.e.
 *   it returns the English source keys — useful as the default (English) locale.
 */
export function createTranslator(messages: Record<string, string> = {}): Translator {
  return (key, ...args) => {
    const template = Object.prototype.hasOwnProperty.call(messages, key)
      ? messages[key]
      : key;
    return formatMessage(template, args);
  };
}
