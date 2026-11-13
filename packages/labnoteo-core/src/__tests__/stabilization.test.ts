import { describe, it, expect } from 'vitest';
import { planDateInsertion } from '../sections/frontMatter';
import { planIssueMarkerInsertion, parseIssueMarkers } from '../lib/issueMarker';

describe('stabilization regressions', () => {
  const unit = '### [UHW010 Spin] one\n#### Meta\n- Start_date: today\n#### Input\n- sample\n#### Method\nspin';
  it('protects Meta properties, including selections starting before Meta', () => {
    const to = unit.indexOf('today') + 2;
    expect(planIssueMarkerInsertion(unit, unit.indexOf('Start_date'), to, 'ISS-test')).toEqual({ reason: 'meta' });
    expect(planIssueMarkerInsertion(unit, 0, to, 'ISS-test')).toEqual({ reason: 'meta' });
    expect(planIssueMarkerInsertion('Start_date: discuss this', 0, 0, 'ISS-test', 'topic')).not.toHaveProperty('reason');
  });
  it('keeps selected prose and multiple lines when inserting a date', () => {
    expect(planDateInsertion('keep\nthis text', 0, 14, '2026-11-13')).toEqual({ from: 14, to: 14, text: ' 2026-11-13' });
  });
});
