import { parseLabNoteMd, serializeLabNoteMd } from '../sections/labnoteSectionParser';

const SAMPLE_README = `---
title: Protein Folding Experiment
author: 홍길동
experiment_type: labnote
sample_tracking: yes
created_date: 2026-01-15
last_updated_date: 2026-01-20
---

## 🎯 Experiment Objective
> Briefly describe the main objective and hypothesis of this experiment.

This experiment tests protein folding under different pH conditions.

## 🗂️ Related Workflows

> Enter the list of related workflow files between the markers below.

[ ] [001 WD010 Sample Prep](./001_WD010_Sample_Prep.labnote.md)
[x] [002 WD020 Analysis](./002_WD020_Analysis.labnote.md)


## 📊 Results & Discussion

The results show significant improvement at pH 7.4.

## Custom Notes

Some additional notes here.
`;

describe('labnoteSectionParser', () => {
  describe('parseLabNoteMd', () => {
    it('should parse YAML front matter', () => {
      const doc = parseLabNoteMd(SAMPLE_README);
      expect(doc.frontMatter.title).toBe('Protein Folding Experiment');
      expect(doc.frontMatter.author).toBe('홍길동');
      expect(doc.frontMatter.experiment_type).toBe('labnote');
      expect(doc.frontMatter.sample_tracking).toBe(true);
      expect(doc.frontMatter.created_date).toBe('2026-01-15');
      expect(doc.frontMatter.last_updated_date).toBe('2026-01-20');
    });

    it('should parse objective section', () => {
      const doc = parseLabNoteMd(SAMPLE_README);
      const objective = doc.sections.find(s => s.type === 'objective');
      expect(objective).toBeDefined();
      if (objective?.type === 'objective') {
        expect(objective.content).toContain('Briefly describe');
        expect(objective.content).toContain('protein folding under different pH');
      }
    });

    it('should parse workflow references with check state', () => {
      const doc = parseLabNoteMd(SAMPLE_README);
      const workflows = doc.sections.find(s => s.type === 'workflows');
      expect(workflows).toBeDefined();
      if (workflows?.type === 'workflows') {
        expect(workflows.items).toHaveLength(2);
        expect(workflows.items[0].title).toBe('001 WD010 Sample Prep');
        expect(workflows.items[0].link).toBe('./001_WD010_Sample_Prep.labnote.md');
        expect(workflows.items[0].checked).toBe(false);
        expect(workflows.items[1].title).toBe('002 WD020 Analysis');
        expect(workflows.items[1].link).toBe('./002_WD020_Analysis.labnote.md');
        expect(workflows.items[1].checked).toBe(true);
      }
    });

    it('should parse results section', () => {
      const doc = parseLabNoteMd(SAMPLE_README);
      const results = doc.sections.find(s => s.type === 'results');
      expect(results).toBeDefined();
      if (results?.type === 'results') {
        expect(results.content).toContain('significant improvement at pH 7.4');
      }
    });

    it('should parse freeform sections', () => {
      const doc = parseLabNoteMd(SAMPLE_README);
      const freeform = doc.sections.find(s => s.type === 'freeform');
      expect(freeform).toBeDefined();
      if (freeform?.type === 'freeform') {
        expect(freeform.heading).toBe('Custom Notes');
        expect(freeform.content).toContain('additional notes');
      }
    });

    it('should handle empty body with only front matter', () => {
      const minimal = `---
title: Empty Note
author: Test
experiment_type: labnote
sample_tracking: no
created_date: 2026-01-01
last_updated_date: 2026-01-01
---
`;
      const doc = parseLabNoteMd(minimal);
      expect(doc.frontMatter.title).toBe('Empty Note');
      expect(doc.frontMatter.sample_tracking).toBe(false);
      expect(doc.sections).toHaveLength(0);
    });

    it('should handle sample_tracking as boolean string', () => {
      const md = `---
title: Test
author: Test
experiment_type: labnote
sample_tracking: true
created_date: 2026-01-01
last_updated_date: 2026-01-01
---
`;
      const doc = parseLabNoteMd(md);
      expect(doc.frontMatter.sample_tracking).toBe(true);
    });

    it('should preserve extra front matter fields', () => {
      const md = `---
title: Test
author: Test
experiment_type: labnote
sample_tracking: yes
created_date: 2026-01-01
last_updated_date: 2026-01-01
custom_field: custom_value
---
`;
      const doc = parseLabNoteMd(md);
      expect(doc.frontMatter.custom_field).toBe('custom_value');
    });
  });

  describe('serializeLabNoteMd', () => {
    it('should output valid YAML front matter', () => {
      const doc = parseLabNoteMd(SAMPLE_README);
      const md = serializeLabNoteMd(doc);
      expect(md).toMatch(/^---\n/);
      expect(md).toContain('title: Protein Folding Experiment');
      expect(md).toContain('author: 홍길동');
    });

    it('should serialize workflow references as standard `- [ ]` task list items', () => {
      const doc = parseLabNoteMd(SAMPLE_README);
      const md = serializeLabNoteMd(doc);
      expect(md).toContain('- [ ] [001 WD010 Sample Prep](./001_WD010_Sample_Prep.labnote.md)');
      expect(md).toContain('- [x] [002 WD020 Analysis](./002_WD020_Analysis.labnote.md)');
      // Must not emit the legacy marker-less form.
      expect(md).not.toMatch(/^\[ \] \[001 WD010/m);
    });

    it('parses both legacy `[ ]` and standard `- [ ]` workflow items', () => {
      const mixed = `---
title: Mixed
author: A
experiment_type: labnote
sample_tracking: no
created_date: 2026-01-01
last_updated_date: 2026-01-01
---

## 🗂️ Related Workflows

- [ ] [001 New Style](./001_WD010_New.labnote.md)
[x] [002 Legacy Style](./002_WD020_Legacy.labnote.md)
`;
      const doc = parseLabNoteMd(mixed);
      const wf = doc.sections.find(s => s.type === 'workflows');
      expect(wf?.type).toBe('workflows');
      if (wf?.type === 'workflows') {
        expect(wf.items).toHaveLength(2);
        expect(wf.items[0].title).toBe('001 New Style');
        expect(wf.items[0].checked).toBe(false);
        expect(wf.items[1].title).toBe('002 Legacy Style');
        expect(wf.items[1].checked).toBe(true);
      }
    });

    it('should preserve inline markdown formatting', () => {
      const mdWithFormatting = `---
title: Test
author: Test
experiment_type: labnote
sample_tracking: yes
created_date: 2026-01-01
last_updated_date: 2026-01-01
---

## 🎯 Experiment Objective
> Some **bold** and *italic* text.

Content with \`code\` and [links](http://example.com).
`;
      const doc = parseLabNoteMd(mdWithFormatting);
      const serialized = serializeLabNoteMd(doc);
      expect(serialized).toContain('**bold**');
      expect(serialized).toContain('*italic*');
      expect(serialized).toContain('`code`');
      expect(serialized).toContain('[links](http://example.com)');
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through parse → serialize → parse', () => {
      const doc1 = parseLabNoteMd(SAMPLE_README);
      const md = serializeLabNoteMd(doc1);
      const doc2 = parseLabNoteMd(md);

      expect(doc2.frontMatter.title).toBe(doc1.frontMatter.title);
      expect(doc2.frontMatter.author).toBe(doc1.frontMatter.author);
      expect(doc2.frontMatter.experiment_type).toBe(doc1.frontMatter.experiment_type);
      expect(doc2.frontMatter.sample_tracking).toBe(doc1.frontMatter.sample_tracking);

      const wf1 = doc1.sections.find(s => s.type === 'workflows');
      const wf2 = doc2.sections.find(s => s.type === 'workflows');
      if (wf1?.type === 'workflows' && wf2?.type === 'workflows') {
        expect(wf2.items).toEqual(wf1.items);
      }

      const obj1 = doc1.sections.find(s => s.type === 'objective');
      const obj2 = doc2.sections.find(s => s.type === 'objective');
      if (obj1?.type === 'objective' && obj2?.type === 'objective') {
        expect(obj2.content.trim()).toBe(obj1.content.trim());
      }
    });
  });
});
