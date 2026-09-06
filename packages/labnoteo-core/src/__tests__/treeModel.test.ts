// Globals convention (no `import ... from 'vitest'`) — see sampleDefinition.test.ts.
import {
  buildWorkflowTree,
  buildSampleTree,
  type WorkflowTreeData,
} from '../tree/treeModel';
import { MemFileSystem } from '../fs/memFileSystem';
import type { WorkflowItem, UnitOperationItem } from '../lib/workflowDataLoader';

describe('buildWorkflowTree', () => {
  const data: WorkflowTreeData = {
    workflows: [
      { id: 'WD010', name: 'Design', description: 'd', category: 'Design' },
      { id: 'WB010', name: 'Build', description: 'b', category: 'Build' },
      { id: 'WD020', name: 'Design2', description: '', category: 'Design' },
    ] as WorkflowItem[],
    hwUnitOps: [
      { id: 'UHW010', name: 'Spin', description: 'x', equipment: 'Centrifuge' },
    ] as UnitOperationItem[],
    swUnitOps: [
      { id: 'USW010', name: 'Align', description: 'y', software: 'BWA' },
    ] as UnitOperationItem[],
  };

  it('produces three roots with counts', () => {
    const [wf, hw, sw] = buildWorkflowTree(data);
    expect(wf.label).toBe('Workflows [3]');
    expect(hw.label).toBe('HW Unit Operations [1]');
    expect(sw.label).toBe('SW Unit Operations [1]');
    expect(wf.kind).toBe('workflowRoot');
  });

  it('orders categories by DBTL and nests workflows', () => {
    const [wf] = buildWorkflowTree(data);
    const cats = wf.children!.map(c => c.label);
    expect(cats).toEqual(['Design [2]', 'Build [1]']);
    expect(wf.children![0].children!.map(w => w.label)).toEqual([
      'WD010: Design',
      'WD020: Design2',
    ]);
  });

  it('embeds equipment/software tooltip on unit operations', () => {
    const [, hw, sw] = buildWorkflowTree(data);
    expect(hw.children![0].tooltip).toContain('Equipment: Centrifuge');
    expect(sw.children![0].tooltip).toContain('Software: BWA');
  });

  it('sorts unknown categories AFTER the known DBTL order (not before Design)', () => {
    const withUnknown: WorkflowTreeData = {
      workflows: [
        { id: 'WX010', name: 'Misc', description: '', category: 'Zzz' },
        { id: 'WB010', name: 'Build', description: '', category: 'Build' },
        { id: 'WD010', name: 'Design', description: '', category: 'Design' },
        { id: 'WU010', name: 'Uncat', description: '', category: 'Uncategorized' },
      ] as WorkflowItem[],
      hwUnitOps: [],
      swUnitOps: [],
    };
    const [wf] = buildWorkflowTree(withUnknown);
    const cats = wf.children!.map(c => c.label);
    // Design/Build first (DBTL order), then unknowns alphabetically.
    expect(cats).toEqual(['Design [1]', 'Build [1]', 'Uncategorized [1]', 'Zzz [1]']);
  });
});

describe('buildSampleTree', () => {
  it('builds scope -> type -> sample -> detail levels from disk', async () => {
    const fs = new MemFileSystem();
    await fs.write(
      '/local/DNA.json',
      JSON.stringify({
        'DNA-1': {
          type: 'DNA',
          alias: 'plasmidA',
          descriptions: ['first'],
          sources: [],
        },
      })
    );

    const [local, global] = await buildSampleTree(
      fs,
      { local: '/local', global: '/global' },
      ['DNA', 'RNA']
    );

    expect(local.label).toBe('Samples (Local)');
    expect(global.label).toBe('Samples (Global)');

    const dnaType = local.children!.find(c => c.label.startsWith('DNA'))!;
    expect(dnaType.label).toBe('DNA [1]');
    expect(dnaType.color).toBeTruthy();

    const sample = dnaType.children![0];
    expect(sample.label).toBe('DNA-1 | plasmidA');
    expect(sample.children!.map(d => d.label)).toEqual([
      'alias: plasmidA',
      'description: first',
    ]);

    // Empty type shows a placeholder leaf.
    const rnaType = local.children!.find(c => c.label.startsWith('RNA'))!;
    expect(rnaType.label).toBe('RNA [0]');
    expect(rnaType.children![0].label).toBe('No samples');
  });
});
