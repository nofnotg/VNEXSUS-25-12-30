import { describe, it, expect } from '@jest/globals';
import { quantizeWeights, buildVectorMeta, isometricProject } from '../../src/shared/utils/vectorMeta.js';

describe('vectorMeta utils', () => {
  it('quantizeWeights returns defaults and sums to 1.0', () => {
    const w = quantizeWeights({});
    expect(w).toEqual({ semantic: 0.3, time: 0.3, confidence: 0.4 });
    const sum = w.semantic + w.time + w.confidence;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('quantizeWeights rounds and normalizes equal rounding case', () => {
    const w = quantizeWeights({ semantic: 0.34, time: 0.33, confidence: 0.33 });
    expect(w).toEqual({ semantic: 0.4, time: 0.3, confidence: 0.3 });
    const sum = w.semantic + w.time + w.confidence;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('quantizeWeights clamps negatives and >1 values', () => {
    const w = quantizeWeights({ semantic: -1.0, time: 2.0, confidence: 0.0 });
    expect(w).toEqual({ semantic: 0.0, time: 1.0, confidence: 0.0 });
  });

  it('buildVectorMeta produces valid projection and components', () => {
    const organizedData = { groupedData: [{}, {}] };
    const finalReport = { sections: [{}, {}] };
    const massiveDateResult = {
      structuredGroups: [
        { label: 'A', date: '2020-01-01', confidence: 0.7 },
        { label: 'B', date: '2024-01-01', confidence: 0.9 },
      ],
      statistics: { averageConfidence: 0.8 }
    };
    const weights = { semantic: 0.5, time: 0.3, confidence: 0.2 };

    const meta = buildVectorMeta({ organizedData, massiveDateResult, finalReport, weights });
    expect(meta.weights).toEqual({ semantic: 0.5, time: 0.3, confidence: 0.2 });
    expect(Array.isArray(meta.projection3D)).toBe(true);
    expect(meta.projection3D).toHaveLength(3);
    for (const v of meta.projection3D) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // semantic placeholder leads to 0 on X component
    expect(meta.projection3D[0]).toBe(0);
    // components.confidence should be average of coverage(=1) and confidence(=0.8) => 0.9
    expect(meta.components.confidence).toBeCloseTo(0.9, 5);
    expect(Array.isArray(meta.meta.events)).toBe(true);
    expect(meta.meta.events.length).toBe(2);
  });

  it('isometricProject returns expected 2D projection rounded to 2 decimals', () => {
    const [x, y] = isometricProject([0.5, 0.2, 0.1]);
    expect(x).toBeCloseTo(0.35, 2);
    expect(y).toBeCloseTo(0.5, 2);
  });
});

