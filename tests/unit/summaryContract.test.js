/**
 * @jest-environment node
 */
import { buildSummaryContract } from '../../src/scripts/summaryContract.js';

describe('summaryContract', () => {
  test('builds fixed-format summary from comparison results', () => {
    const input = {
      generatedAt: '2025-01-01T00:00:00.000Z',
      results: [
        {
          name: 'baseline',
          options: {},
          aggregate: { cases: 2, totals: { records: 5, episodes: 3 }, topGroups: [{ group: 'Chest pain', count: 2 }] },
          summary: [
            { file: 'case1.txt', records: 2, episodes: 1, diagnosticGroups: ['Chest pain'], hospitals: ['서울병원'], claimWithinWindowRecords: 1 },
            { file: 'case2.txt', records: 3, episodes: 2, diagnosticGroups: ['Chest pain'], hospitals: ['부산의원'], claimWithinWindowRecords: 0 }
          ]
        }
      ]
    };

    const out = buildSummaryContract(input);
    expect(out.contractVersion).toBe('v1');
    expect(out.generatedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(out.profiles).toHaveLength(1);
    expect(out.profiles[0].name).toBe('baseline');
    expect(out.profiles[0].metrics).toEqual({ cases: 2, records: 5, episodes: 3, hospitalsUnique: 2, claimWithinWindowRecords: 1 });
    expect(out.profiles[0].topGroups).toEqual([{ group: 'Chest pain', count: 2 }]);
  });
});
