import { describe, it, expect } from '@jest/globals';
import { validateDiseaseRequiredTests } from '../../src/modules/claims/service/diseaseTestValidationService.js';

describe('diseaseTestValidationService.validateDiseaseRequiredTests', () => {
  it('covers required tests for chest pain when ECG/Troponin present within timeframe', () => {
    const records = [
      { date: '2024-01-10', diagnosis: 'Chest pain (ICD: R07.9)', reason: 'Impression: chest discomfort' },
      { date: '2024-01-10', content: '12-lead ECG performed and interpreted' },
      { date: '2024-01-12', content: 'Lab: Troponin I elevated' }
    ];
    const rules = [
      { name: 'Chest pain evaluation', diseaseCodePattern: '^R07', requiredTests: [ { name: 'ECG' }, { name: 'Troponin', timeframeDays: 3 } ], severityLevel: 'moderate' }
    ];

    const result = validateDiseaseRequiredTests(records, rules);
    expect(result.summary.rulesApplied).toBe(1);
    expect(result.summary.anchorsTotal).toBe(1);
    expect(result.perRule[0].anchorsCount).toBe(1);
    const ecg = result.perRule[0].coverage.find(c => c.testName === 'ECG');
    const troponin = result.perRule[0].coverage.find(c => c.testName === 'Troponin');
    expect(ecg?.anchorsCovered).toBe(1);
    expect(ecg?.testsFoundWithinTimeframe).toBeGreaterThanOrEqual(1);
    expect(troponin?.anchorsCovered).toBe(1);
    expect(troponin?.testsFoundWithinTimeframe).toBeGreaterThanOrEqual(1);
  });

  it('marks anchors missing when required test not within timeframe', () => {
    const records = [
      { date: '2024-02-01', diagnosis: 'Type 2 diabetes mellitus (ICD: E11.9)' },
      { date: '2024-06-05', content: 'HbA1c measured' } // 124 days later, outside 90-day window
    ];
    const rules = [
      { name: 'Diabetes monitoring', diseaseCodePattern: '^E11', requiredTests: [ { name: 'HbA1c', timeframeDays: 90 } ], severityLevel: 'low' }
    ];

    const result = validateDiseaseRequiredTests(records, rules);
    expect(result.summary.rulesApplied).toBe(1);
    expect(result.perRule[0].anchorsCount).toBe(1);
    const a1c = result.perRule[0].coverage[0];
    expect(a1c.testsFoundTotal).toBeGreaterThanOrEqual(1);
    expect(a1c.testsFoundWithinTimeframe).toBe(0);
    expect(a1c.anchorsCovered).toBe(0);
    expect(a1c.anchorsMissing).toBe(1);
  });

  it('handles records without ICD code gracefully (no anchors)', () => {
    const records = [
      { date: '2024-03-10', diagnosis: 'Chest pain', content: 'Patient reports intermittent chest pressure' },
      { date: '2024-03-10', content: 'ECG normal' }
    ];
    const rules = [
      { name: 'Chest pain evaluation', diseaseCodePattern: '^R07', requiredTests: [ { name: 'ECG' } ] }
    ];

    const result = validateDiseaseRequiredTests(records, rules);
    expect(result.perRule[0].anchorsCount).toBe(0);
    const ecg = result.perRule[0].coverage[0];
    expect(ecg.anchorsCovered).toBe(0);
    expect(ecg.anchorsMissing).toBe(0); // no anchors => no missing
  });

  it('supports multiple anchors with partial coverage', () => {
    const records = [
      { date: '2024-04-01', diagnosis: 'Chest pain (ICD: R07.2)' },
      { date: '2024-04-03', diagnosis: 'Chest pain (ICD: R07.9)' },
      { date: '2024-04-01', content: 'ECG performed' } // covers first anchor same-day only
    ];
    const rules = [
      { name: 'Chest pain evaluation', diseaseCodePattern: '^R07', requiredTests: [ { name: 'ECG' } ] }
    ];
    const result = validateDiseaseRequiredTests(records, rules);
    expect(result.perRule[0].anchorsCount).toBe(2);
    const ecg = result.perRule[0].coverage[0];
    expect(ecg.anchorsCovered).toBe(1);
    expect(ecg.anchorsMissing).toBe(1);
  });

  it('does not throw when encountering invalid dates and logs warning', () => {
    const records = [
      { date: 'invalid-date', diagnosis: 'Chest pain (ICD: R07.9)' },
      { date: '2024-05-10', content: 'ECG performed' }
    ];
    const rules = [
      { name: 'Chest pain evaluation', diseaseCodePattern: '^R07', requiredTests: [ { name: 'ECG' } ] }
    ];
    const result = validateDiseaseRequiredTests(records, rules);
    expect(result.summary.rulesApplied).toBe(1);
    // anchors with invalid date are still counted as anchors (based on ICD), but coverage may be unaffected
    expect(result.perRule[0].anchorsCount).toBe(1);
    const ecg = result.perRule[0].coverage[0];
    expect(ecg.testsFoundTotal).toBeGreaterThanOrEqual(1);
  });
});

