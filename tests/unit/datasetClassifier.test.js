import { describe, it, expect } from '@jest/globals';
import { classifyDataset } from '../../src/shared/utils/datasetClassifier.js';

describe('datasetClassifier', () => {
  it('labels claims when type or tag indicates insurance', () => {
    const evs = [{ type: 'ClaimSubmitted', tags: [] }];
    const res = classifyDataset(evs, {});
    expect(res.label).toBe('claims');
    expect(res.summary.eventCount).toBe(1);
  });

  it('labels medical_timeline for diagnosis/procedure types', () => {
    const evs = [
      { type: 'Diagnosis', tags: [] },
      { type: 'Procedure', tags: [] },
    ];
    const res = classifyDataset(evs, {});
    expect(res.label).toBe('medical_timeline');
  });

  it('labels genetic when genetic tag present', () => {
    const evs = [{ type: 'Other', tags: ['genetic'] }];
    const res = classifyDataset(evs, {});
    expect(res.label).toBe('genetic');
    expect(res.tags).toContain('genetic');
  });

  it('labels genetic when patientInfo indicates dna and no events', () => {
    const res = classifyDataset([], { dna: true });
    expect(res.label).toBe('genetic');
    expect(res.tags).toContain('genetic');
    expect(res.summary.eventCount).toBe(0);
  });

  it('aggregates and deduplicates tags (case-insensitive)', () => {
    const evs = [
      { type: 'Claim', tags: ['insurance'] },
      { type: 'Claim', tags: ['Insurance'] },
    ];
    const res = classifyDataset(evs, {});
    expect(res.tags.filter(t => t === 'insurance').length).toBe(1);
    expect(res.label).toBe('claims');
  });

  it('summary hospitals/dates deduplicate and dates limit to 50', () => {
    const events = Array.from({ length: 60 }).map((_, i) => ({
      type: 'Other',
      tags: [],
      hospital: i % 2 === 0 ? 'A Hospital' : 'B Hospital',
      date: `2020-01-${String((i % 30) + 1).padStart(2, '0')}`,
    }));
    const res = classifyDataset(events, {});
    expect(new Set(res.summary.hospitals).size).toBe(2);
    // unique by date value, here only 30 unique days
    expect(res.summary.dates.length).toBe(30);
  });
});
