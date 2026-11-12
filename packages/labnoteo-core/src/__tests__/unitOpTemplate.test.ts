/**
 * #575: a software unit operation put Output right after Input, while a lab
 * one keeps it after Method. Both now read in the order the work happens.
 */
import { describe, it, expect } from 'vitest';
import {
  buildHwUnitOpMarkdown,
  buildHwUnitOpSections,
  buildSwUnitOpMarkdown,
  buildSwUnitOpSections,
} from '../lib/unitOpTemplate';

const META = { experimenter: 'Dr. Kim', dateTime: '2026-11-13 10:00' };
const INFO = { opId: 'USW010', opName: 'Align', opDescription: 'step' };
const headings = (md: string): string[] => [...md.matchAll(/^#### (.+)$/gm)].map(m => m[1]);

describe('unit operation templates', () => {
  it('puts the Output of a software unit operation after its Method, as in a lab one', () => {
    expect(headings(buildSwUnitOpMarkdown(INFO, META))).toEqual([
      'Meta',
      'Input',
      'Parameters',
      'Environment',
      'Method',
      'Output',
      'QC Metrics',
      'Discussion',
    ]);
    const hw = headings(buildHwUnitOpMarkdown({ ...INFO, opId: 'UHW010' }, META));
    expect(hw.indexOf('Output')).toBe(hw.indexOf('Method') + 1);
  });

  it('builds the same sections for the document model as for the inserted text', () => {
    expect(buildSwUnitOpSections(META).map(s => s.heading)).toEqual(headings(buildSwUnitOpMarkdown(INFO, META)));
    expect(buildHwUnitOpSections(META).map(s => s.heading)).toEqual(
      headings(buildHwUnitOpMarkdown({ ...INFO, opId: 'UHW010' }, META))
    );
  });
});
