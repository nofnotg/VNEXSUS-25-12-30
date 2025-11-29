// Summary contract builder (ESM)
// Formalizes a fixed-format summary from outpatient episodes comparison results.

import { logger } from '../shared/logging/logger.js';

export function buildSummaryContract(input) {
  if (!input || !Array.isArray(input.results)) {
    throw new Error('Invalid input: results array is required');
  }

  const profiles = input.results.map((p) => {
    const cases = Number(p.aggregate?.cases || 0);
    const records = Number(p.aggregate?.totals?.records || 0);
    const episodes = Number(p.aggregate?.totals?.episodes || 0);

    // Compute unique hospitals across all cases for this profile
    const hospitalsSet = new Set();
    let claimWithinWindowTotal = 0;
    let diseaseAnchorsTotal = 0;
    let diseaseTestsWithinTimeframeTotal = 0;
    for (const s of (p.summary || [])) {
      for (const h of (s.hospitals || [])) hospitalsSet.add(h);
      claimWithinWindowTotal += Number(s.claimWithinWindowRecords || 0);
      diseaseAnchorsTotal += Number(s.diseaseAnchors || 0);
      diseaseTestsWithinTimeframeTotal += Number(s.diseaseTestsWithinTimeframe || 0);
    }

    return {
      name: String(p.name || 'unknown'),
      options: p.options || {},
      metrics: {
        cases,
        records,
        episodes,
        hospitalsUnique: hospitalsSet.size,
        claimWithinWindowRecords: claimWithinWindowTotal
      },
      diseaseValidation: {
        anchors: diseaseAnchorsTotal,
        testsWithinTimeframe: diseaseTestsWithinTimeframeTotal
      },
      topGroups: Array.isArray(p.aggregate?.topGroups) ? p.aggregate.topGroups.map(x => ({ group: x.group, count: x.count })) : []
    };
  });

  const out = {
    contractVersion: 'v1',
    generatedAt: input.generatedAt || new Date().toISOString(),
    profiles
  };

  logger.info({ event: 'summary_contract_built', profileCount: profiles.length });
  return out;
}

export default { buildSummaryContract };
