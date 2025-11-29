// Jest unit tests for CSV report utilities
import { generateComparisonCSV } from '../../src/shared/utils/csvReport.js';

describe('csvReport.generateComparisonCSV', () => {
  test('generates CSV with normalized hospitals and group counts', () => {
    const input = {
      results: [
        {
          name: 'baseline',
          summary: [
            {
              file: 'CaseA.txt',
              records: 10,
              episodes: 7,
              diagnosticGroups: ['digestive', 'endocrine', 'digestive'],
              hospitals: ['서울대학교병원 내원', '아산병원 응급', '강남세브란스병원 외래']
            },
            {
              file: 'CaseB.txt',
              records: 5,
              episodes: 4,
              diagnosticGroups: ['endocrine'],
              hospitals: ['이대목동병원 진료']
            }
          ]
        }
      ]
    };
    const csv = generateComparisonCSV(input);
    // Header should include union group columns
    expect(csv).toMatch(/config,file,records,episodes,groups_total/);
    expect(csv).toMatch(/groups_digestive/);
    expect(csv).toMatch(/groups_endocrine/);
    // Header should include claim metrics columns
    expect(csv).toMatch(/claim_within_window/);
    expect(csv).toMatch(/claim_total/);
    // Header should include disease validation columns
    expect(csv).toMatch(/disease_anchors/);
    expect(csv).toMatch(/disease_tests_within_timeframe/);

    // Normalized hospitals field should include canonical names
    expect(csv).toMatch(/서울대병원; 서울아산병원; 세브란스병원/);
    expect(csv).toMatch(/이대목동병원/);

    // Basic row values
    expect(csv).toMatch(/baseline,CaseA.txt,10,7/);
    expect(csv).toMatch(/baseline,CaseB.txt,5,4/);
    // Default claim/disease metric values should be 0 when not provided
    expect(csv).toMatch(/,0,0,0,0,/);
  });

  test('includes claim metrics values per row when provided', () => {
    const input = {
      results: [
        {
          name: 'merge_plus',
          summary: [
            {
              file: 'CaseC.txt',
              records: 8,
              episodes: 6,
              diagnosticGroups: ['respiratory'],
              hospitals: ['분당서울대학교병원 방문'],
              claimWithinWindowRecords: 2,
              claimTotalRecords: 3
            }
          ]
        }
      ]
    };
    const csv = generateComparisonCSV(input);
    expect(csv).toMatch(/claim_within_window/);
    expect(csv).toMatch(/claim_total/);
    expect(csv).toMatch(/disease_anchors/);
    expect(csv).toMatch(/disease_tests_within_timeframe/);
    // Row should include specific claim metric values
    expect(csv).toMatch(/merge_plus,CaseC.txt,8,6,1,.*1,2,3,0,0,/);
  });
});
