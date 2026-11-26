import { listUnitOpBlocks } from '../sections/scanInsert';
import { findSampleReferenceSpans } from './sampleStorage';
import { listHeadings } from '../sections/sectionEdit';
import { buildHwUnitOpMarkdown, buildSwUnitOpMarkdown } from './unitOpTemplate';
import { getSeoulDateTimeString } from './dateUtils';
import { findUnitOpInsertOffset, rebuildUnitOpToc } from '../sections/workflowSectionParser';
import { parseFrontMatterYaml } from '../sections/frontMatter';

const sections = ['Parameters', 'Environment', 'Method'];

export interface PresetStep {
  id: string;
  name: string;
  alias: string;
  bodies: Record<string, string>;
}

export function workflowPresetSteps(markdown: string, sampleTypes: readonly string[]): PresetStep[] {
  const { body: noteBody } = parseFrontMatterYaml(markdown);
  const lines = noteBody.split(/\r?\n/);
  const headings = listHeadings(noteBody);
  return listUnitOpBlocks(noteBody).map(op => {
    const bodies: Record<string, string> = {};
    const inner = headings.filter(h => h.level === 4 && h.line > op.headingLine && h.line < op.contentEndLine);
    for (let i = 0; i < inner.length; i++) {
      const { text, line } = inner[i];
      const name = sections.find(section => section.toLowerCase() === text.trim().toLowerCase());
      if (!name) continue;
      const body = lines.slice(line + 1, inner[i + 1]?.line ?? op.contentEndLine);
      const clean = body.filter(row => !/@issue\s*;|labnoteo-scan|!\[|\/issues\/\d+|(?:\[\[|\]\()[^\]\n)]+\.(?:png|jpe?g|webp|pdf)(?:[|\])#]|$)/i.test(row) &&
        !findSampleReferenceSpans(row, sampleTypes).length).join('\n').trim();
      if (clean) bodies[name] = clean;
    }
    return { id: op.opId, name: op.opName, alias: op.alias, bodies };
  });
}

export function placeWorkflowPresetSteps(markdown: string, steps: readonly PresetStep[], experimenter: string): string {
  if (!steps.length) return markdown;
  const blocks = steps.map(step => {
    const template = step.id.startsWith('USW') ? buildSwUnitOpMarkdown : buildHwUnitOpMarkdown;
    const info = { opId: step.id, opName: step.name, opDescription: '', descriptionExtra: step.alias ? ' ' + step.alias : '' };
    const text = template(info, { experimenter, dateTime: getSeoulDateTimeString() }).replace(/^> \n/m, '');
    const lines = text.split('\n');
    for (const name of sections) {
      const body = step.bodies[name];
      if (!body) continue;
      const at = lines.indexOf('#### ' + name);
      if (at >= 0) lines[at + 1] = body;
      else lines.splice(lines.length - 2, 0, '#### ' + name, body, '');
    }
    return lines.join('\n');
  }).join('');
  const at = findUnitOpInsertOffset(markdown);
  return rebuildUnitOpToc(markdown.slice(0, at) + blocks + markdown.slice(at));
}
