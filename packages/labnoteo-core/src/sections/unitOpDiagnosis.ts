import { listHeadings } from './sectionEdit';
import { commentRanges } from '../lib/issueMarker';

/** Conservative diagnosis of template-shaped blocks that lost their unit-operation heading. */
export function damagedUnitOpHeadings(md: string): { line: number; title: string }[] {
  const hidden = commentRanges(md);
  const starts = [0];
  for (let i = 0; i < md.length; i++) if (md[i] === '\n') starts.push(i + 1);
  const headings = listHeadings(md).filter(h => !hidden.some(r => starts[h.line] >= r.start && starts[h.line] < r.end));
  return headings.filter((h, index) => {
    if (h.level !== 3 || /^\[[A-Z]+\d+\s.+?\]/.test(h.text)) return false;
    const names = new Set<string>();
    for (const child of headings.slice(index + 1)) {
      if (child.level <= 3) break;
      if (child.level === 4) names.add(child.text.trim().toLowerCase());
    }
    return names.has('meta') && names.has('method') && (names.has('input') || names.has('output'));
  }).map(h => ({ line: h.line, title: h.text }));
}
