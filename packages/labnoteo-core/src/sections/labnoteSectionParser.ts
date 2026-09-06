import type {
  LabNoteDocument,
  LabNoteFrontMatter,
  LabNoteSection,
  WorkflowReference,
} from './sectionTypes';
import { parseFrontMatterYaml, serializeFrontMatterEntry } from './frontMatter';

function parseFrontMatter(md: string): { frontMatter: Record<string, unknown>; body: string } {
  return parseFrontMatterYaml(md);
}

function serializeFrontMatter(fm: LabNoteFrontMatter): string {
  const lines: string[] = ['---'];
  const knownKeys = ['title', 'author', 'experiment_type', 'sample_tracking', 'created_date', 'last_updated_date'];
  for (const key of knownKeys) {
    const val = fm[key];
    if (key === 'sample_tracking') {
      lines.push(`${key}: ${val ? 'yes' : 'no'}`);
    } else {
      lines.push(`${key}: ${val ?? ''}`);
    }
  }
  for (const [key, val] of Object.entries(fm)) {
    if (!knownKeys.includes(key)) {
      lines.push(serializeFrontMatterEntry(key, val));
    }
  }
  lines.push('---');
  return lines.join('\n');
}

const OBJECTIVE_PATTERN = /^##\s.*Experiment Objective/i;
const WORKFLOWS_PATTERN = /^##\s.*Related Workflows/i;
const RESULTS_PATTERN = /^##\s.*Results/i;
const H2_PATTERN = /^##\s+/;

export function parseLabNoteMd(md: string): LabNoteDocument {
  // Normalize CRLF up front so front matter and body line splitting behave
  // identically for Windows-saved files (serialization always emits LF).
  const { frontMatter: rawFm, body } = parseFrontMatter(md.replace(/\r\n/g, '\n'));

  const fm: LabNoteFrontMatter = {
    title: String(rawFm.title ?? ''),
    author: String(rawFm.author ?? ''),
    experiment_type: String(rawFm.experiment_type ?? ''),
    sample_tracking: rawFm.sample_tracking === true || rawFm.sample_tracking === 'yes',
    created_date: String(rawFm.created_date ?? ''),
    last_updated_date: String(rawFm.last_updated_date ?? ''),
  };
  for (const [k, v] of Object.entries(rawFm)) {
    if (!(k in fm)) {
      fm[k] = v;
    }
  }

  const lines = body.split('\n');
  const sections: LabNoteSection[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (OBJECTIVE_PATTERN.test(line)) {
      i++;
      const contentLines: string[] = [];
      while (i < lines.length && !H2_PATTERN.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      sections.push({ type: 'objective', content: trimContent(contentLines) });
      continue;
    }

    if (WORKFLOWS_PATTERN.test(line)) {
      i++;
      const items: WorkflowReference[] = [];
      const blockLines: string[] = [];
      while (i < lines.length && !H2_PATTERN.test(lines[i])) {
        // Accept both the legacy marker-less `[ ]` form and the standard
        // task-list `- [ ]` form (optional leading list marker).
        const wfMatch = lines[i].match(/^(?:-\s+)?\[([ x])\]\s*\[([^\]]+)\]\(([^)]+)\)/i);
        if (wfMatch) {
          items.push({
            checked: wfMatch[1].toLowerCase() === 'x',
            title: wfMatch[2],
            link: wfMatch[3],
          });
        }
        blockLines.push(lines[i]);
        i++;
      }
      sections.push({ type: 'workflows', items });
      continue;
    }

    if (RESULTS_PATTERN.test(line)) {
      i++;
      const contentLines: string[] = [];
      while (i < lines.length && !H2_PATTERN.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      sections.push({ type: 'results', content: trimContent(contentLines) });
      continue;
    }

    if (H2_PATTERN.test(line)) {
      const heading = line.replace(H2_PATTERN, '').trim();
      i++;
      const contentLines: string[] = [];
      while (i < lines.length && !H2_PATTERN.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      sections.push({ type: 'freeform', heading, content: trimContent(contentLines) });
      continue;
    }

    i++;
  }

  return { frontMatter: fm, sections };
}

function trimContent(lines: string[]): string {
  const joined = lines.join('\n');
  return joined.replace(/^\n+/, '').replace(/\n+$/, '');
}

export function serializeLabNoteMd(doc: LabNoteDocument): string {
  const parts: string[] = [serializeFrontMatter(doc.frontMatter), ''];

  for (const section of doc.sections) {
    switch (section.type) {
      case 'objective':
        parts.push('## 🎯 Experiment Objective');
        parts.push(section.content);
        parts.push('');
        break;

      case 'workflows': {
        parts.push('## 🗂️ Related Workflows');
        parts.push('');
        for (const item of section.items) {
          const checkbox = item.checked ? '[x]' : '[ ]';
          // Emit standard Markdown task-list items so Obsidian renders them
          // as interactive checkboxes.
          parts.push(`- ${checkbox} [${item.title}](${item.link})`);
        }
        parts.push('');
        parts.push('');
        break;
      }

      case 'results':
        parts.push('## 📊 Results & Discussion');
        parts.push('');
        parts.push(section.content);
        parts.push('');
        break;

      case 'freeform':
        parts.push(`## ${section.heading}`);
        parts.push('');
        parts.push(section.content);
        parts.push('');
        break;
    }
  }

  return parts.join('\n');
}
