// Centralized report column keys and helpers (ESM)
// Keep keys stable to avoid breaking CSV/HTML consumers.

export const REPORT_COLUMNS = {
  config: 'config',
  file: 'file',
  records: 'records',
  episodes: 'episodes',
  groups_total: 'groups_total',
  hospitals_total: 'hospitals_total',
  claim_within_window: 'claim_within_window',
  claim_total: 'claim_total',
  disease_anchors: 'disease_anchors',
  disease_tests_within_timeframe: 'disease_tests_within_timeframe',
  hospitals_normalized: 'hospitals_normalized',
};

// Build a column key for a diagnostic group
export const groupColumn = (name) => `groups_${name}`;

// Predicate to check if a given column key is a group column
export const isGroupColumn = (column) => column.startsWith('groups_');

// Base header columns shared across CSV/HTML reports, excluding groups and optional fields
export const BASE_HEADER_COLUMNS = [
  REPORT_COLUMNS.config,
  REPORT_COLUMNS.file,
  REPORT_COLUMNS.records,
  REPORT_COLUMNS.episodes,
  REPORT_COLUMNS.groups_total,
  REPORT_COLUMNS.hospitals_total,
  REPORT_COLUMNS.claim_within_window,
  REPORT_COLUMNS.claim_total,
  REPORT_COLUMNS.disease_anchors,
  REPORT_COLUMNS.disease_tests_within_timeframe,
];

export default {
  REPORT_COLUMNS,
  groupColumn,
  isGroupColumn,
  BASE_HEADER_COLUMNS,
};

