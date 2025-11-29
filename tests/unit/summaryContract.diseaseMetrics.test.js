/**
 * @jest-environment node
 */
import { buildSummaryContract } from '../../src/scripts/summaryContract.js';

describe('summaryContract diseaseValidation metrics', () => {
  test('includes aggregated disease metrics when present in summary items', () => {
    const input = {
      generatedAt: '2025-01-01T00:00:00.000Z',
      results: [
        {
          name: 'baseline',
          options: {},
          aggregate: { cases: 2, totals: { records: 5, episodes: 3 }, topGroups: [] },
          summary: [
            { file: 'a.txt', records: 2, episodes: 1, diagnosticGroups: [], hospitals: [], diseaseAnchors: 2, diseaseTestsWithinTimeframe: 1 },
            { file: 'b.txt', records: 3, episodes: 2, diagnosticGroups: [], hospitals: [], diseaseAnchors: 1, diseaseTestsWithinTimeframe: 3 }
          ]
        }
      ]
    };

    const out = buildSummaryContract(input);
    expect(out.profiles).toHaveLength(1);
    const dv = out.profiles[0].diseaseValidation;
    expect(dv).toEqual({ anchors: 3, testsWithinTimeframe: 4 });
    // ensure original metrics still intact and unchanged
    expect(out.profiles[0].metrics).toMatchObject({ cases: 2, records: 5, episodes: 3 });
  });
});

