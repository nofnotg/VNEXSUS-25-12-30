// Claims rules initial seeds (ESM)
// Centralized rule data: disclosure windows, disease test rules, summary field rules.

export const DISCLOSURE_WINDOW_RULES = [
  { name: 'General claim disclosure window', eventType: 'claim', windowDays: 90, anchorField: 'date' }
];

export const DISEASE_TEST_RULES = [
  {
    name: 'Chest pain evaluation',
    diseaseCodePattern: '^R07',
    requiredTests: [
      { name: 'ECG' },
      { name: 'Troponin', timeframeDays: 3 }
    ],
    severityLevel: 'moderate'
  },
  {
    name: 'Diabetes monitoring',
    diseaseCodePattern: '^E11',
    requiredTests: [
      { name: 'HbA1c', timeframeDays: 90 }
    ],
    severityLevel: 'low'
  }
];

export const SUMMARY_FIELD_RULES = [
  { field: 'cases', compute: 'aggregateMetric', includeIfClaim: true, includeIfNotClaim: true },
  { field: 'records', compute: 'aggregateMetric', includeIfClaim: true, includeIfNotClaim: true },
  { field: 'episodes', compute: 'aggregateMetric', includeIfClaim: true, includeIfNotClaim: true },
  { field: 'hospitalsUnique', compute: 'aggregateMetric', includeIfClaim: true, includeIfNotClaim: true },
  { field: 'topGroups', compute: 'listTopGroups' }
];

export default {
  DISCLOSURE_WINDOW_RULES,
  DISEASE_TEST_RULES,
  SUMMARY_FIELD_RULES
};

