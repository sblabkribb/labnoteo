/**
 * Sample-ID highlighting for both Obsidian editing surfaces:
 *
 * - **Live Preview / Source** — a CodeMirror 6 `ViewPlugin` that decorates the
 *   visible ranges.
 * - **Reading mode** — a Markdown post-processor that wraps matches in the
 *   rendered HTML.
 *
 * Both share the pure {@link findSampleIdRanges} scanner from `@labnoteo/core`,
 * so the two views stay perfectly consistent and the logic is unit-tested in
 * core rather than here.
 */
import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { findSampleIdRanges } from '@labnoteo/core';

export interface HighlightState {
  types: string[];
  colors: Record<string, string>;
}

const SAMPLE_ID_CLASS = 'labnote-sample-id';

/**
 * Per-type colour is dynamic (built-ins + custom fallback), so it is handed to
 * the stylesheet through the `--labnote-sample-color` custom property rather than
 * a hardcoded `style` declaration. Returns `undefined` when no colour applies so
 * the caller can skip emitting the variable entirely (avoids the old invalid
 * `background-color:;`).
 */
function sampleColorVar(color: string): string | undefined {
  return color ? `--labnote-sample-color: ${color}` : undefined;
}

/** CM6 ViewPlugin factory. `getState` is read on every rebuild so settings
 *  changes (custom types) take effect without re-registering the extension. */
export function createSampleHighlightPlugin(getState: () => HighlightState) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged) {
          this.decorations = this.build(u.view);
        }
      }

      build(view: EditorView): DecorationSet {
        const { types, colors } = getState();
        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          for (const r of findSampleIdRanges(text, types)) {
            const styleVar = sampleColorVar(colors[r.type] ?? '');
            const deco = Decoration.mark({
              class: SAMPLE_ID_CLASS,
              attributes: styleVar ? { style: styleVar } : {},
            });
            builder.add(from + r.start, from + r.end, deco);
          }
        }
        return builder.finish();
      }
    },
    { decorations: v => v.decorations }
  );
}

/** Reading-mode Markdown post-processor factory. */
export function createSampleReadingHighlighter(
  getState: () => HighlightState
): (el: HTMLElement) => void {
  return (el: HTMLElement) => {
    const { types, colors } = getState();
    if (types.length === 0) return;
    highlightTextNodes(el, types, colors);
  };
}

function highlightTextNodes(
  root: HTMLElement,
  types: string[],
  colors: Record<string, string>
): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (!parent) continue;
    // Skip code, links and already-processed spans.
    if (parent.closest(`code, pre, a, .${SAMPLE_ID_CLASS}`)) continue;
    if (findSampleIdRanges(textNode.data, types).length > 0) targets.push(textNode);
  }

  for (const textNode of targets) {
    const text = textNode.data;
    const ranges = findSampleIdRanges(text, types);
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const r of ranges) {
      if (r.start > last) frag.appendChild(document.createTextNode(text.slice(last, r.start)));
      const span = document.createElement('span');
      span.className = SAMPLE_ID_CLASS;
      span.textContent = text.slice(r.start, r.end);
      const color = colors[r.type] ?? '';
      if (color) span.style.setProperty('--labnote-sample-color', color);
      frag.appendChild(span);
      last = r.end;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.replaceWith(frag);
  }
}
