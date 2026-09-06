/**
 * Click-to-pick date/time editing for unit operation `#### Meta` blocks.
 *
 * A CodeMirror 6 `ViewPlugin` marks the value of every `- Start_date: '…'` /
 * `- End_date: '…'` line as clickable (and, when the value is still empty, adds
 * a small calendar affordance so there is something to click). Clicking opens
 * the platform's native date/time picker via `<input type="datetime-local">`
 * and writes the chosen value back through a single editor transaction, so
 * undo/redo and Obsidian's own save pipeline keep working normally.
 *
 * Line parsing lives in `@labnoteo/core/lib/dateUtils` ({@link findMetaDateFieldInLine})
 * so it stays unit-tested and shared with any other consumer.
 *
 * Only the editing surfaces (Live Preview / Source) are covered — reading mode
 * is read-only by design.
 */
import {
  ViewPlugin,
  Decoration,
  WidgetType,
  EditorView,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import {
  findMetaDateFieldInLine,
  fromDateTimeLocalValue,
  getSeoulDateTimeString,
  toDateTimeLocalValue,
} from '@labnoteo/core/lib/dateUtils';

const VALUE_CLASS = 'labnote-date-value';
const ICON_CLASS = 'labnote-date-pick';
const PICKER_CLASS = 'labnote-datetime-picker';

/** Calendar affordance rendered when a date field has no value yet. */
class DatePickIconWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }

  eq(other: DatePickIconWidget): boolean {
    return other.label === this.label;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span');
    el.className = ICON_CLASS;
    el.textContent = '📅';
    el.setAttribute('aria-label', this.label);
    // Handled here rather than through `domEventHandlers` because a widget's
    // DOM is not part of the document text, so `posAtCoords` cannot locate it.
    // `mousedown` only suppresses the caret jump; the picker opens on `click`,
    // after the editor has finished taking focus, so it cannot be stolen back.
    el.addEventListener('mousedown', event => event.preventDefault());
    el.addEventListener('click', event => {
      openPickerAt(view, view.posAtDOM(el), event);
    });
    return el;
  }

  /** Let CodeMirror process events inside the widget instead of dropping them. */
  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Editor extension enabling the click-to-pick behaviour. `label` is the
 * localized tooltip for the calendar affordance.
 */
export function createMetaDatePickerExtension(label: string) {
  const plugin = ViewPlugin.fromClass(
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
        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = view.state.doc.lineAt(pos);
            const match = findMetaDateFieldInLine(line.text);
            if (match) {
              if (match.valueEnd > match.valueStart) {
                builder.add(
                  line.from + match.valueStart,
                  line.from + match.valueEnd,
                  Decoration.mark({ class: VALUE_CLASS })
                );
              } else {
                // Empty value: no text to click, so offer an icon instead.
                builder.add(
                  line.to,
                  line.to,
                  Decoration.widget({ widget: new DatePickIconWidget(label), side: 1 })
                );
              }
            }
            pos = line.to + 1;
          }
        }
        return builder.finish();
      }
    },
    { decorations: v => v.decorations }
  );

  return [
    plugin,
    EditorView.domEventHandlers({
      // `click` rather than `mousedown`: the editor grabs focus on mousedown,
      // which would pull it straight back out of the picker input.
      click: (event, view) => {
        const target = event.target as HTMLElement | null;
        if (!target?.closest(`.${VALUE_CLASS}`)) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;
        // Not consumed: the click still places the caret, so the value stays
        // editable by hand if the picker is dismissed.
        openPickerAt(view, pos, event);
        return false;
      },
    }),
  ];
}

/** Open the picker for the Meta date field on the line containing `pos`. */
function openPickerAt(view: EditorView, pos: number, event: MouseEvent): void {
  const line = view.state.doc.lineAt(pos);
  const match = findMetaDateFieldInLine(line.text);
  if (!match) return;

  const lineNumber = line.number;
  const initial =
    toDateTimeLocalValue(match.value) || toDateTimeLocalValue(getSeoulDateTimeString());

  openDateTimePicker({
    x: event.clientX,
    y: event.clientY,
    initial,
    onPick: picked => {
      const value = fromDateTimeLocalValue(picked);
      if (!value) return;
      // The document may have changed while the picker was open, so resolve the
      // target range again instead of trusting the captured offsets.
      if (lineNumber > view.state.doc.lines) return;
      const current = view.state.doc.line(lineNumber);
      const target = findMetaDateFieldInLine(current.text);
      if (!target || target.field !== match.field) return;
      view.dispatch({
        changes: {
          from: current.from + target.valueStart,
          to: current.from + target.valueEnd,
          insert: target.quote ? value : `'${value}'`,
        },
      });
      view.focus();
    },
  });
}

interface DateTimePickerOptions {
  x: number;
  y: number;
  /** `YYYY-MM-DDTHH:mm`, the value shape `datetime-local` expects. */
  initial: string;
  onPick: (value: string) => void;
}

/**
 * Show a transient `datetime-local` input at the given viewport coordinates and
 * immediately open its native calendar/clock popup.
 *
 * The input is rendered (not hidden) so that hosts without `showPicker()`
 * still present a usable field rather than nothing at all.
 */
function openDateTimePicker(opts: DateTimePickerOptions): void {
  const input = document.createElement('input');
  input.type = 'datetime-local';
  input.className = PICKER_CLASS;
  input.value = opts.initial;
  input.style.left = `${opts.x}px`;
  input.style.top = `${opts.y + 12}px`;
  document.body.appendChild(input);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    input.remove();
  };

  input.addEventListener('change', () => {
    const value = input.value;
    close();
    if (value) opts.onPick(value);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  // Delayed so a pick that moves focus away still delivers its `change` first.
  input.addEventListener('blur', () => window.setTimeout(close, 150));

  input.focus();
  const withPicker = input as HTMLInputElement & { showPicker?: () => void };
  try {
    withPicker.showPicker?.();
  } catch {
    // Picker unavailable (or blocked without a user gesture) — the focused
    // input remains usable on its own.
  }
}
