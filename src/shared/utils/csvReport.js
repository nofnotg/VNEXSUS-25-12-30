// CSV report utilities (ESM)
// - generateComparisonCSV: flatten comparison JSON to CSV string
// Input accepts either the full comparison JSON {generatedAt, results: [...]}
// or a single result object {name, summary: [...]} or a raw summary array.

import { extractHospitalNormalized } from './medicalText.js';
import { REPORT_COLUMNS, groupColumn, BASE_HEADER_COLUMNS } from '../constants/reportColumns.js';

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function ensureArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function collectGroupUnion(results) {
  const set = new Set();
  for (const r of results) {
    for (const item of r.summary ?? []) {
      for (const g of ensureArray(item.diagnosticGroups)) {
        if (g) set.add(g);
      }
    }
  }
  return Array.from(set).sort();
}

export function generateComparisonCSV(input, options = {}) {
  const opts = { includeHospitalsNormalized: true, ...options };
  const normalizedResults = normalizeInputToResults(input);
  const groupUnion = collectGroupUnion(normalizedResults);

  const header = [
    ...BASE_HEADER_COLUMNS.slice(0, 5),
    ...groupUnion.map(g => groupColumn(g)),
    ...BASE_HEADER_COLUMNS.slice(5),
    ...(opts.includeHospitalsNormalized ? [REPORT_COLUMNS.hospitals_normalized] : [])
  ];

  const rows = [];
  for (const r of normalizedResults) {
    const config = r.name ?? 'unknown';
    for (const item of r.summary ?? []) {
      const groups = ensureArray(item.diagnosticGroups);
      const hospitals = ensureArray(item.hospitals);
      const groupCounts = new Map();
      for (const g of groupUnion) groupCounts.set(g, 0);
      for (const g of groups) if (g && groupCounts.has(g)) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);

      const normalizedHospitals = opts.includeHospitalsNormalized
        ? Array.from(
            new Set(
              hospitals
                .map(h => extractHospitalNormalized(String(h)))
                .filter(Boolean)
            )
          ).join('; ')
        : '';

      const row = [
        config,
        item.file ?? '',
        item.records ?? 0,
        item.episodes ?? 0,
        groups.length,
        ...groupUnion.map(g => groupCounts.get(g) ?? 0),
        hospitals.length,
        Number(item.claimWithinWindowRecords ?? 0),
        Number(item.claimTotalRecords ?? 0),
        Number(item.diseaseAnchors ?? 0),
        Number(item.diseaseTestsWithinTimeframe ?? 0),
        ...(opts.includeHospitalsNormalized ? [normalizedHospitals] : [])
      ];
      rows.push(row.map(csvEscape).join(','));
    }
  }

  return [header.map(csvEscape).join(','), ...rows].join('\n');
}

function normalizeInputToResults(input) {
  if (!input) return [];
  // Full file JSON
  if (Array.isArray(input.results)) {
    return input.results;
  }
  // Single result object
  if (typeof input === 'object' && Array.isArray(input.summary)) {
    return [input];
  }
  // Raw summary array
  if (Array.isArray(input)) {
    return [{ name: 'unknown', summary: input }];
  }
  return [];
}

export default {
  generateComparisonCSV
};
