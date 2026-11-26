import { describe, expect, it } from 'vitest';
import { listUnitOpBlocks } from '../sections/scanInsert';
import { createWorkflowContent } from '../lib/workflowStructure';
import { placeWorkflowPresetSteps, workflowPresetSteps } from '../lib/workflowPreset';

describe('workflow presets (#575)', () => {
  it('keeps reusable sections and puts them into a fresh workflow without prior records', () => {
    const source = [
      '---', 'labnote_id: LN-OLDNOTE1', '---', '',
      '### [USW010 A] Tuning',
      '#### Meta', "Start_date: '2020-01-01'",
      '#### Input', 'DNA-1',
      '#### Parameters', 'threads: 4',
      '#### Environment', 'CPU only',
      '#### Method', 'Run the benchmark.', 'DNA-2', '![[old-scan.jpg]]', '@issue;ISS-1; Old issue',
      '[Prior issue](https://github.com/example/repo/issues/1)',
      '#### Output', 'old-result.csv', '',
      '### [UHW010 B]', '#### Method', 'Prepare the worksheet.',
    ].join('\n');
    const preset = workflowPresetSteps(source, ['DNA']);
    expect(preset.map(step => step.bodies)).toEqual([
      { Parameters: 'threads: 4', Environment: 'CPU only', Method: 'Run the benchmark.' },
      { Method: 'Prepare the worksheet.' },
    ]);
    const fresh = createWorkflowContent({ id: 'WT020', name: 'Test', description: '' }, 'Next', undefined, { noteId: 'LN-NEWNOTE1' });
    const note = placeWorkflowPresetSteps(fresh, preset, 'Next');
    expect(listUnitOpBlocks(note).map(op => op.opId)).toEqual(['USW010', 'UHW010']);
    expect(note).toContain('LN-NEWNOTE1');
    expect(note).toContain('#### Parameters\nthreads: 4');
    expect(note).toContain('#### Method\nPrepare the worksheet.');
    expect(note).not.toMatch(/DNA-\d|OLDNOTE|old-scan|old-result|ISS-1|2020-01-01/);
  });
});
