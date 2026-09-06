import { parseWorkflowMd, serializeWorkflowMd, validateWorkflowDocument } from '../sections/workflowSectionParser';

const SAMPLE_WORKFLOW = `---
title: WD010 Sample Preparation
experimenter: 홍길동
created_date: 2026-01-15
last_updated_date: 2026-01-20
end_date: ''
---

## [WD010 Sample Preparation]

> Prepare biological samples for downstream analysis

## Related Unit Operations

> 유닛 오퍼레이션 목록이 자동으로 추가됩니다.

---

### [HW001 Centrifugation]

> Separate components by centrifugal force

#### Meta
- Experimenter: 홍길동
- Start_date: '2026-01-15 09:00'
- End_date: ''

#### Input
- Raw cell culture samples

#### Reagent
- PBS buffer

#### Method
- Centrifuge at 3000 rpm for 10 minutes
- DNA-001|Sample_A was used

#### Output
- Pelleted cells

#### Results & Discussions
- Clear separation achieved

---

### [SW001 Data Analysis]

> Analyze experimental data using statistical methods

#### Meta
- Experimenter: 홍길동
- Start_date: '2026-01-16 10:00'
- End_date: ''
- Software: Python 3.11

#### Input
- Raw measurement data

#### Output
- Statistical summary report

#### Parameters
- alpha = 0.05

#### Method
- T-test comparison between groups

#### Discussion
- Results are statistically significant
`;

describe('workflowSectionParser', () => {
  describe('parseWorkflowMd', () => {
    it('should parse YAML front matter', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      expect(doc.frontMatter.title).toBe('WD010 Sample Preparation');
      expect(doc.frontMatter.experimenter).toBe('홍길동');
      expect(doc.frontMatter.created_date).toBe('2026-01-15');
      expect(doc.frontMatter.last_updated_date).toBe('2026-01-20');
      expect(doc.frontMatter.end_date).toBe('');
    });

    it('should parse workflow header', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      expect(doc.workflowHeader).toBe('[WD010 Sample Preparation]');
    });

    it('should parse workflow description', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      expect(doc.workflowDescription).toBe('Prepare biological samples for downstream analysis');
    });

    it('should parse HW unit operation', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const hwOp = doc.unitOperations.find(op => op.opType === 'hw');
      expect(hwOp).toBeDefined();
      expect(hwOp!.opId).toBe('HW001');
      expect(hwOp!.opName).toBe('Centrifugation');
      expect(hwOp!.opDescription).toBe('Separate components by centrifugal force');
    });

    it('should parse SW unit operation', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const swOp = doc.unitOperations.find(op => op.opType === 'sw');
      expect(swOp).toBeDefined();
      expect(swOp!.opId).toBe('SW001');
      expect(swOp!.opName).toBe('Data Analysis');
      expect(swOp!.opDescription).toBe('Analyze experimental data using statistical methods');
    });

    it('should detect HW/SW type from opId prefix', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      expect(doc.unitOperations[0].opType).toBe('hw');
      expect(doc.unitOperations[1].opType).toBe('sw');
    });

    it('should detect USW/UHW catalog opIds as sw/hw', () => {
      const md = `---
title: Test
experimenter: A
created_date: 2026-01-01
last_updated_date: 2026-01-01
end_date: ''
---

## [WD999 Test]

## Related Unit Operations

---

### [UHW010 Liquid Handling]

> HW desc

#### Meta
- Experimenter: A
- Start_date: '2026-01-01'
- End_date: ''

#### Input
-

---

### [USW250 Model Evaluation]

> SW desc

#### Meta
- Experimenter: A
- Start_date: '2026-01-01'
- End_date: ''
- Software: Python

#### Input
-

`;
      const doc = parseWorkflowMd(md);
      expect(doc.unitOperations).toHaveLength(2);
      expect(doc.unitOperations[0].opId).toBe('UHW010');
      expect(doc.unitOperations[0].opType).toBe('hw');
      expect(doc.unitOperations[1].opId).toBe('USW250');
      expect(doc.unitOperations[1].opType).toBe('sw');
    });

    it('should parse unit operation sections', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const hwOp = doc.unitOperations[0];
      const sectionHeadings = hwOp.sections.map(s => s.heading);
      expect(sectionHeadings).toContain('Meta');
      expect(sectionHeadings).toContain('Input');
      expect(sectionHeadings).toContain('Reagent');
      expect(sectionHeadings).toContain('Method');
      expect(sectionHeadings).toContain('Output');
      expect(sectionHeadings).toContain('Results & Discussions');
    });

    it('should preserve sample references in content', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const hwOp = doc.unitOperations[0];
      const methodSection = hwOp.sections.find(s => s.heading === 'Method');
      expect(methodSection).toBeDefined();
      expect(methodSection!.content).toContain('DNA-001|Sample_A');
    });

    it('should parse multiple unit operations', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      expect(doc.unitOperations).toHaveLength(2);
    });

    it('should handle empty workflow (no unit operations)', () => {
      const emptyWorkflow = `---
title: WD010 Empty Workflow
experimenter: Test
created_date: 2026-01-01
last_updated_date: 2026-01-01
end_date: ''
---

## [WD010 Empty Workflow]

> An empty workflow

## Related Unit Operations

> No operations yet.

`;
      const doc = parseWorkflowMd(emptyWorkflow);
      expect(doc.frontMatter.title).toBe('WD010 Empty Workflow');
      expect(doc.unitOperations).toHaveLength(0);
    });

    it('should normalize typo heading Reagen to Reagent', () => {
      const mdWithTypo = `---
title: Typo Test
experimenter: Test
created_date: 2026-01-01
last_updated_date: 2026-01-01
end_date: ''
---

## [Typo Test]

> Test

## Related Unit Operations

---

### [HW001 Test Op]

> Desc

#### Meta
- Experimenter: 'Test'
- Start_date: ''
- End_date: ''

#### Input
- in

#### Reagen
- buffer A

#### Output
- out

`;
      const doc = parseWorkflowMd(mdWithTypo);
      const hwOp = doc.unitOperations[0];
      const reagentSec = hwOp.sections.find(s => s.heading === 'Reagent');
      expect(reagentSec).toBeDefined();
      expect(reagentSec!.content).toContain('buffer A');
      expect(hwOp.sections.some(s => s.heading === 'Reagen')).toBe(false);

      const roundTrip = serializeWorkflowMd(doc);
      expect(roundTrip).toContain('#### Reagent');
      // "#### Reagent" contains substring "Reagen"; assert no standalone typo heading
      expect(roundTrip).not.toMatch(/\n#### Reagen\n/);
    });
  });

  describe('serializeWorkflowMd', () => {
    it('should output valid YAML front matter', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const md = serializeWorkflowMd(doc);
      expect(md).toMatch(/^---\n/);
      expect(md).toContain('title: WD010 Sample Preparation');
      expect(md).toContain('experimenter: 홍길동');
    });

    it('should serialize unit operation sections', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const md = serializeWorkflowMd(doc);
      expect(md).toContain('### [HW001 Centrifugation]');
      expect(md).toContain('### [SW001 Data Analysis]');
      expect(md).toContain('#### Meta');
      expect(md).toContain('#### Input');
    });

    it('should include horizontal rules between unit operations', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const md = serializeWorkflowMd(doc);
      expect(md).toContain('---');
    });

    // Issue #35: the auto-generated "Related Unit Operations" TOC link text must
    // include the per-instance step name (alias), formatted as
    // `{opId} {opName} | {alias}`.
    const WORKFLOW_WITH_ALIAS = `---
title: WB150 Test
experimenter: 홍길동
created_date: 2026-01-15
last_updated_date: 2026-01-20
end_date: ''
---

## [WB150 Test]

> Test workflow

## Related Unit Operations

---

### [UHW400 Manual] Oligo Pool Resuspension

> Resuspend

#### Method
- step

---

### [UHW010 Liquid Handling]

> No alias here

#### Method
- step
`;

    it('should include the step name (alias) in the TOC link label', () => {
      const doc = parseWorkflowMd(WORKFLOW_WITH_ALIAS);
      const md = serializeWorkflowMd(doc);
      expect(md).toContain('- [UHW400 Manual | Oligo Pool Resuspension](#');
    });

    it('should keep the TOC label as "{opId} {opName}" without a trailing " | " when there is no alias', () => {
      const doc = parseWorkflowMd(WORKFLOW_WITH_ALIAS);
      const md = serializeWorkflowMd(doc);
      const tocLines = md.split('\n').filter(l => l.startsWith('- ['));
      const noAliasLine = tocLines.find(l => l.includes('UHW010 Liquid Handling'));
      expect(noAliasLine).toBeDefined();
      expect(noAliasLine).toContain('- [UHW010 Liquid Handling](#');
      expect(noAliasLine).not.toContain('|');
    });

    it('should keep the TOC anchor pointing at the (alias-inclusive) heading slug', () => {
      const doc = parseWorkflowMd(WORKFLOW_WITH_ALIAS);
      const md = serializeWorkflowMd(doc);
      // The alias-bearing op serializes its heading as "### [UHW400 Manual] Oligo Pool Resuspension".
      // Its GitHub-style slug removes brackets/pipes and joins words with hyphens.
      const expectedSlug = 'uhw400-manual-oligo-pool-resuspension';
      expect(md).toContain('### [UHW400 Manual] Oligo Pool Resuspension');
      expect(md).toContain(`](#${expectedSlug})`);
    });
  });

  describe('validateWorkflowDocument', () => {
    it('should validate a valid document', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      const result = validateWorkflowDocument(doc);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing title', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      doc.frontMatter.title = '';
      const result = validateWorkflowDocument(doc);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('title'))).toBe(true);
    });

    it('should detect missing experimenter', () => {
      const doc = parseWorkflowMd(SAMPLE_WORKFLOW);
      doc.frontMatter.experimenter = '';
      const result = validateWorkflowDocument(doc);
      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('experimenter'))).toBe(true);
    });
  });

  describe('roundtrip', () => {
    it('should preserve metadata through parse → serialize → parse', () => {
      const doc1 = parseWorkflowMd(SAMPLE_WORKFLOW);
      const md = serializeWorkflowMd(doc1);
      const doc2 = parseWorkflowMd(md);

      expect(doc2.frontMatter.title).toBe(doc1.frontMatter.title);
      expect(doc2.frontMatter.experimenter).toBe(doc1.frontMatter.experimenter);
      expect(doc2.workflowHeader).toBe(doc1.workflowHeader);
      expect(doc2.workflowDescription).toBe(doc1.workflowDescription);
    });

    it('should preserve unit operations through roundtrip', () => {
      const doc1 = parseWorkflowMd(SAMPLE_WORKFLOW);
      const md = serializeWorkflowMd(doc1);
      const doc2 = parseWorkflowMd(md);

      expect(doc2.unitOperations).toHaveLength(doc1.unitOperations.length);
      for (let i = 0; i < doc1.unitOperations.length; i++) {
        expect(doc2.unitOperations[i].opId).toBe(doc1.unitOperations[i].opId);
        expect(doc2.unitOperations[i].opName).toBe(doc1.unitOperations[i].opName);
        expect(doc2.unitOperations[i].opType).toBe(doc1.unitOperations[i].opType);
        expect(doc2.unitOperations[i].sections.length).toBe(doc1.unitOperations[i].sections.length);
      }
    });

    it('should preserve sample references through roundtrip', () => {
      const doc1 = parseWorkflowMd(SAMPLE_WORKFLOW);
      const md = serializeWorkflowMd(doc1);
      const doc2 = parseWorkflowMd(md);

      const method1 = doc1.unitOperations[0].sections.find(s => s.heading === 'Method');
      const method2 = doc2.unitOperations[0].sections.find(s => s.heading === 'Method');
      expect(method2!.content.trim()).toBe(method1!.content.trim());
    });
  });
});
