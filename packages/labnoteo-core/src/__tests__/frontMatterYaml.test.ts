// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import { parseLabNoteMd, serializeLabNoteMd } from '../sections/labnoteSectionParser';
import { parseWorkflowMd, serializeWorkflowMd } from '../sections/workflowSectionParser';

/**
 * Obsidian users add `tags`/`aliases` (YAML lists) and nested keys via the
 * Properties UI. The legacy line-based front-matter parser silently dropped
 * list items and flattened nested keys, so a round-trip through the Section
 * Editor destroyed that data. These tests pin the js-yaml behaviour.
 */

const LABNOTE_WITH_TAGS = `---
title: Protein Folding
author: 홍길동
experiment_type: labnote
sample_tracking: yes
created_date: 2026-01-15
last_updated_date: 2026-01-20
tags:
  - pcr
  - failed
aliases:
  - PF-001
---

## 🎯 Experiment Objective

Body.
`;

const WORKFLOW_WITH_TAGS = `---
title: WD010 Sample Preparation
experimenter: 홍길동
created_date: 2026-01-15
last_updated_date: 2026-01-20
end_date: ''
tags:
  - prep
  - draft
---

## [WD010 Sample Preparation]

> Prepare samples
`;

describe('front matter YAML preservation (labnote)', () => {
  it('preserves tags/aliases list items across a parse→serialize round-trip', () => {
    const doc = parseLabNoteMd(LABNOTE_WITH_TAGS);
    expect(doc.frontMatter.tags).toEqual(['pcr', 'failed']);
    expect(doc.frontMatter.aliases).toEqual(['PF-001']);

    const out = serializeLabNoteMd(doc);
    const reparsed = parseLabNoteMd(out);
    expect(reparsed.frontMatter.tags).toEqual(['pcr', 'failed']);
    expect(reparsed.frontMatter.aliases).toEqual(['PF-001']);
  });

  it('keeps known-key order and formatting (sample_tracking as yes/no)', () => {
    const doc = parseLabNoteMd(LABNOTE_WITH_TAGS);
    const out = serializeLabNoteMd(doc);
    const fmBlock = out.slice(0, out.indexOf('\n---', 3));
    // known keys appear before tags/aliases, in canonical order
    expect(fmBlock).toContain('title: Protein Folding');
    expect(fmBlock).toContain('sample_tracking: yes');
    expect(fmBlock.indexOf('sample_tracking:')).toBeLessThan(fmBlock.indexOf('tags:'));
    // dates stay plain strings, not ISO timestamps
    expect(fmBlock).toContain('created_date: 2026-01-15');
  });
});

describe('front matter YAML preservation (workflow)', () => {
  it('preserves tags list across a parse→serialize round-trip', () => {
    const doc = parseWorkflowMd(WORKFLOW_WITH_TAGS);
    expect(doc.frontMatter.tags).toEqual(['prep', 'draft']);

    const out = serializeWorkflowMd(doc);
    const reparsed = parseWorkflowMd(out);
    expect(reparsed.frontMatter.tags).toEqual(['prep', 'draft']);
    // empty end_date convention preserved
    expect(out).toContain("end_date: ''");
  });
});
