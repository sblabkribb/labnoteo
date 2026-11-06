/**
 * "Print experiment worksheet": the unit operations of a workflow note as
 * pages to carry into the lab, each with a QR code naming the note, the unit
 * operation and the page, so a photo of it can be filed back automatically.
 */
import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type { LabnoteHost, Translator } from '@labnoteo/core';
import { getSeoulDateString } from '@labnoteo/core/lib/dateUtils';
import { encodePagePayload, payloadLabel, unitOpFingerprint, type PagePayload } from '@labnoteo/core/lib/scanPayload';
import type { SampleLocationLookup } from '@labnoteo/core/lib/sampleStorage';
import {
  annotateWorksheetSamples,
  listWorksheetUnitOps,
  paginateWorksheet,
  type WorksheetPage,
  type WorksheetBlock,
  type WorksheetQuote,
  type WorksheetSection,
  type WorksheetUnitOp,
} from '@labnoteo/core/lib/worksheet';
import {
  CODE_SPAN_RE,
  EM_STAR_RE,
  EM_UNDERSCORE_RE,
  ESCAPED_MARK_RE,
  FOOTNOTE_REF_RE,
  HIGHLIGHT_RE,
  MATH_BLOCK_RE,
  MATH_INLINE_RE,
  codeSpanText,
} from '@labnoteo/core/lib/exportTablesCsv';
import type { WorksheetPaperSize } from '../settings';
import { buildPrintHtml, escapeHtml, openHtmlInBrowser, printHtml, type PrintPage } from './printPages';
import { texToHtml } from './texHtml';

/** Markdown inline syntax reduced to its text: links, emphasis, code ticks. */
export function plainInline(text: string): string {
  return text
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '[$1]')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1');
}

/**
 * A formula as printable text, or italic TeX when it uses more than
 * {@link texToHtml} reads: printing it as written beats printing it wrong.
 */
const mathHtml = (tex: string): string => {
  const read = texToHtml(tex);
  return read === undefined ? `<i>${escapeHtml(tex)}</i>` : read;
};

/**
 * A footnote definition as the raised number its references print as (#434):
 * `[^1]: thawed on ice` becomes `¹ thawed on ice`. Run before `inline()`,
 * which keeps `<sup>` but escapes everything around it.
 */
export const footnoteDefinitionMarked = (text: string): string =>
  text.replace(/^\[\^([^\]\s]+)\]:[ \t]*/, '<sup>$1</sup> ');

/**
 * Inline Markdown as the reading view shows it, escaped for HTML (#434): code
 * as written and math as printable text, `<sub>`/`<sup>` and HTML entities
 * kept, struck-through text struck rather than dropped (a crossed-out value
 * must not read as a live one), a highlight underlined for black-and-white
 * printing and a footnote reference as its raised number.
 */
const inline = (text: string): string => {
  const held: string[] = [];
  const hold = (html: string): string => `\u0000${held.push(html) - 1}\u0000`;
  let s = text
    .replace(CODE_SPAN_RE, (_m, _ticks: string, body: string) => hold(escapeHtml(codeSpanText(body))))
    .replace(MATH_BLOCK_RE, (_m, tex: string) => hold(mathHtml(tex)))
    .replace(MATH_INLINE_RE, (_m, before: string, tex: string) => before + hold(mathHtml(tex)))
    .replace(ESCAPED_MARK_RE, (_m, mark: string) => hold(escapeHtml(mark)))
    .replace(/<(sub|sup)>([\s\S]*?)<\/\1>/gi, (_m, tag: string, body: string) => {
      const name = tag.toLowerCase();
      return `${hold(`<${name}>`)}${body}${hold(`</${name}>`)}`;
    });
  s = escapeHtml(plainInline(s))
    .replace(/&amp;([a-z][a-z\d]*|#\d+|#x[\da-f]+);/gi, '&$1;')
    .replace(EM_STAR_RE, '$1<i>$2</i>')
    .replace(EM_UNDERSCORE_RE, '$1<i>$2</i>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
    .replace(HIGHLIGHT_RE, '<mark>$1</mark>')
    .replace(FOOTNOTE_REF_RE, '<sup>$1</sup>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => held[Number(i)]);
};

const codeHtml = (lines: readonly string[]): string => `<pre class="code">${escapeHtml(lines.join('\n'))}</pre>`;

/**
 * A callout as a bordered box under its type and title, a plain quote with a
 * rule on its left (#558): printed as `> [!warning]` it read as markup.
 */
function quoteHtml(quote: WorksheetQuote): string {
  const body = quote.lines.map(l => `<div>${inline(l) || '&nbsp;'}</div>`).join('');
  if (!quote.callout) return `<blockquote class="quote">${body}</blockquote>`;
  const label = quote.callout.charAt(0).toUpperCase() + quote.callout.slice(1);
  const title = quote.title ? ` ${inline(quote.title)}` : '';
  return `<div class="callout"><div class="callout-title"><b>${escapeHtml(label)}</b>${title}</div>${body}</div>`;
}

/** A pipe table as a printed table: on paper its `|` marks would be unreadable (#254). */
function tableHtml(rows: readonly string[][]): string {
  const [header, ...body] = rows;
  const cells = (row: readonly string[], tag: 'th' | 'td'): string =>
    row.map(c => `<${tag}>${inline(c)}</${tag}>`).join('');
  const head = header ? `<tr>${cells(header, 'th')}</tr>` : '';
  return `<table class="grid">${head}${body.map(r => `<tr>${cells(r, 'td')}</tr>`).join('')}</table>`;
}

/**
 * Section blocks as paper would have them: a list prints with bullets rather
 * than its `- ` marks (#253), a run of items staying one list.
 */
function blocksHtml(blocks: readonly WorksheetBlock[]): string {
  let html = '';
  let items: string[] = [];
  const flush = (): void => {
    if (items.length === 0) return;
    html += `<ul class="bul">${items.join('')}</ul>`;
    items = [];
  };
  for (const block of blocks) {
    if (block.kind === 'item') {
      items.push(`<li class="d${Math.min(block.level, 3)}">${inline(block.text) || '&nbsp;'}</li>`);
      continue;
    }
    flush();
    html +=
      block.kind === 'table'
        ? tableHtml(block.rows)
        : block.kind === 'code'
          ? codeHtml(block.lines)
          : block.kind === 'quote'
            ? quoteHtml(block)
            : `<p>${inline(block.footnote ? footnoteDefinitionMarked(block.text) : block.text) || '&nbsp;'}</p>`;
  }
  flush();
  return html;
}

/** The sections that get twice the leftover height: the ones written in by hand the most. */
const WIDE_SECTIONS = new Set(['Method', 'Results & Discussions']);

/**
 * How much of the page's leftover height a section takes, in shares (#245).
 * A section with nothing in it is there to be written in, and Results &
 * Discussions keeps room under what is already written.
 */
function growShares(section: WorksheetSection): number {
  if (section.type === 'blank') return WIDE_SECTIONS.has(section.title) ? 2 : 1;
  if (section.type === 'text' && section.title === 'Results & Discussions') return 2;
  return 0;
}

function sectionHtml(section: WorksheetSection): string {
  // The text written above the first `####` has no heading of its own (#383).
  const title = section.title ? `<h3>${escapeHtml(section.title)}</h3>` : '';
  const grow = growShares(section);
  const growClass = grow > 0 ? ` g${grow}` : '';
  const fill = grow > 0 ? '<div class="fill"></div>' : '';
  switch (section.type) {
    case 'meta': {
      const rows = section.fields
        .map(f => `<tr><td class="k">${escapeHtml(f.label)}</td><td class="v">${inline(f.value)}&nbsp;</td></tr>`)
        .join('');
      return `<div class="sec">${title}<table class="meta">${rows}</table></div>`;
    }
    case 'steps': {
      // What precedes the first step gets no box or number, so step 1 is the note's step 1.
      let n = 0;
      const items = section.steps
        .map(s => {
          // A footnote the parser kept with its step prints under it (#418), as
          // the raised number a reference in that step shows (#434).
          const sub =
            s.sub.length > 0
              ? `<ul class="sub">${s.sub.map(l => `<li>${inline(footnoteDefinitionMarked(l))}</li>`).join('')}</ul>`
              : '';
          const mark = s.preface ? '' : `<span class="box${s.done ? ' done' : ''}"></span><span class="n">${++n}.</span>`;
          return (
            `<li>${mark}<div class="s">${inline(s.text)}${sub}${s.table ? tableHtml(s.table) : ''}` +
            `${(s.code ?? []).map(codeHtml).join('')}${(s.quotes ?? []).map(quoteHtml).join('')}</div></li>`
          );
        })
        .join('');
      return `<div class="sec">${title}<ol class="steps">${items}</ol></div>`;
    }
    case 'text':
      return `<div class="sec text${growClass}">${title}${blocksHtml(section.blocks)}${fill}</div>`;
    case 'blank':
      return `<div class="sec${growClass}">${title}${fill}</div>`;
  }
}

export interface WorksheetContext {
  noteTitle: string;
  noteId: string;
  printedOn: string;
  t: Translator;
}

function unitOpTitle(op: WorksheetUnitOp): string {
  return `[${op.opId} ${op.opName}]${op.alias ? ` ${op.alias}` : ''}`;
}

/** The printable form of worksheet pages. */
export function worksheetPrintPages(pages: readonly WorksheetPage[], ctx: WorksheetContext): PrintPage[] {
  return pages.map(p => {
    const payload: PagePayload = {
      noteId: ctx.noteId,
      unitOpIndex: p.unitOp.index,
      opId: p.unitOp.opId,
      fingerprint: unitOpFingerprint(p.unitOp.opName, p.unitOp.alias),
      page: p.page,
      pageCount: p.pageCount,
      printedOn: ctx.printedOn,
    };
    const continued = p.page > 1 ? ` <span class="muted">(${escapeHtml(ctx.t('continued'))})</span>` : '';
    const header =
      `<div class="muted">${escapeHtml(ctx.noteTitle)} · ${escapeHtml(ctx.noteId)}</div>` +
      `<div class="title">${inline(unitOpTitle(p.unitOp))}${continued}</div>` +
      (p.page === 1 && p.unitOp.description ? `<div>${inline(p.unitOp.description)}</div>` : '') +
      `<div class="muted">${escapeHtml(ctx.t('Page {0} of {1} · printed {2}', String(p.page), String(p.pageCount), ctx.printedOn))}</div>`;
    return {
      payload: encodePagePayload(payload),
      label: payloadLabel(payload),
      header,
      body: `<div class="ws">${p.sections.map(sectionHtml).join('')}</div>`,
      footer: escapeHtml(
        ctx.t('Write on this sheet, then photograph or scan it with a QR code visible and put the file in the scan folder.')
      ),
    };
  });
}

export function buildWorksheetHtml(
  unitOps: readonly WorksheetUnitOp[],
  ctx: WorksheetContext,
  paper: WorksheetPaperSize
): string {
  const pages = worksheetPrintPages(paginateWorksheet(unitOps), ctx);
  return buildPrintHtml(`${ctx.noteTitle} — ${ctx.t('Experiment worksheet')}`, paper, pages);
}

/** The note's front-matter title, else its file name without `.labnote`. */
export function noteTitleOf(app: App, file: TFile): string {
  const title: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : file.basename.replace(/\.labnote$/, '');
}

export interface WorksheetDeps {
  app: App;
  host: LabnoteHost;
  t: Translator;
  paper: () => WorksheetPaperSize;
  setPaper: (paper: WorksheetPaperSize) => Promise<void>;
  ensureNoteId: (file: TFile) => Promise<string | undefined>;
  /** Sample types and where their samples are stored, for the note (#496); undefined when it does not track samples. */
  sampleLookup?: (file: TFile) => Promise<{ types: string[]; lookup: SampleLocationLookup } | undefined>;
}

/**
 * The unit operations to print selected at first: the lab ones, or every one
 * of a note with only software ones (#508), whose run log is worth printing too.
 */
export function initialWorksheetSelection(unitOps: readonly WorksheetUnitOp[]): number[] {
  const lab = unitOps.filter(op => op.kind === 'hw');
  return (lab.length > 0 ? lab : unitOps).map(op => op.index);
}

/** Pick the unit operations to print (lab ones preselected), then print or open in a browser. */
export async function printWorksheetCommand(deps: WorksheetDeps, file: TFile): Promise<void> {
  const { app, host, t } = deps;
  const unitOps = listWorksheetUnitOps(await app.vault.read(file));
  if (unitOps.length === 0) {
    host.notify('info', t('This note has no unit operations to print. Add one with "{0}" first.', t('Insert unit operation')));
    return;
  }
  const choice = await new WorksheetModal(app, t, unitOps, deps.paper()).choose();
  if (!choice) return;
  if (choice.paper !== deps.paper()) await deps.setPaper(choice.paper);
  const noteId = await deps.ensureNoteId(file);
  if (!noteId) return;
  // Re-read: assigning the ID rewrote the note, and it may have been edited meanwhile.
  const chosen = listWorksheetUnitOps(await app.vault.read(file)).filter(op =>
    choice.indices.includes(op.index)
  );
  const samples = await deps.sampleLookup?.(file);
  const fresh = samples ? annotateWorksheetSamples(chosen, samples.types, samples.lookup) : chosen;
  const html = buildWorksheetHtml(fresh, { noteTitle: noteTitleOf(app, file), noteId, printedOn: getSeoulDateString(), t }, choice.paper);
  if (choice.target === 'browser') {
    await openHtmlInBrowser(html, `${noteId}_worksheet.html`);
    host.notify('info', t('Opened the worksheet in your browser. Print it from there.'));
    return;
  }
  try {
    await printHtml(html);
  } catch (err) {
    console.warn('[labnoteo] printing from Obsidian failed, opening in the browser:', err);
    await openHtmlInBrowser(html, `${noteId}_worksheet.html`);
    host.notify('info', t('Printing from Obsidian did not work, so the worksheet opened in your browser. Print it from there.'));
  }
}

interface WorksheetChoice {
  indices: number[];
  paper: WorksheetPaperSize;
  target: 'print' | 'browser';
}

class WorksheetModal extends Modal {
  private resolve: (choice: WorksheetChoice | null) => void = () => {};
  private chosen: WorksheetChoice | null = null;
  private readonly selected: Set<number>;
  private paper: WorksheetPaperSize;

  constructor(
    app: App,
    private readonly t: Translator,
    private readonly unitOps: readonly WorksheetUnitOp[],
    paper: WorksheetPaperSize
  ) {
    super(app);
    this.paper = paper;
    this.selected = new Set(initialWorksheetSelection(unitOps));
  }

  choose(): Promise<WorksheetChoice | null> {
    return new Promise(resolve => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl, t } = this;
    this.modalEl.addClass('labnote-worksheet-modal');
    this.setTitle(t('Print experiment worksheet'));
    contentEl.createEl('p', {
      text: this.unitOps.some(op => op.kind === 'hw')
        ? t('Each unit operation starts on a new page with a QR code in two corners. Lab unit operations are selected; turn on software ones to print them too.')
        : t('Each unit operation starts on a new page with a QR code in two corners. This note has only software unit operations, so all of them are selected.'),
    });
    for (const op of this.unitOps) {
      const kind = op.kind === 'hw' ? t('Lab') : t('Software');
      new Setting(contentEl)
        .setName(`${op.index}. ${unitOpTitle(op)}`)
        .setDesc(kind)
        .addToggle(toggle =>
          toggle.setValue(this.selected.has(op.index)).onChange(on => {
            if (on) this.selected.add(op.index);
            else this.selected.delete(op.index);
          })
        );
    }
    new Setting(contentEl).setName(t('Paper size')).addDropdown(d =>
      d
        .addOption('a4', 'A4')
        .addOption('letter', 'Letter')
        .setValue(this.paper)
        .onChange(v => (this.paper = v as WorksheetPaperSize))
    );
    new Setting(contentEl)
      .addButton(b => b.setButtonText(t('Open in browser')).onClick(() => this.finish('browser')))
      .addButton(b => {
        b.setButtonText(t('Print')).setCta().onClick(() => this.finish('print'));
        // Otherwise the first toggle gets focus, and Enter turns that page off (#325).
        window.setTimeout(() => b.buttonEl.focus(), 0);
      });
  }

  private finish(target: WorksheetChoice['target']): void {
    if (this.selected.size === 0) {
      new Notice(this.t('Select at least one unit operation.'));
      return;
    }
    const indices = this.unitOps.map(op => op.index).filter(i => this.selected.has(i));
    this.chosen = { indices, paper: this.paper, target };
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve(this.chosen);
  }
}
