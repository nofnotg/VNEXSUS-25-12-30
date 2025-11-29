// Claim section markers and synonyms (ESM)
// Centralized constants for detecting claim-related sections in case text.

export const CLAIM_SECTION_TOKENS = [
  '청구사항',
  '청구',
  '보험청구',
  '보험',
  'CLAIM',
  'CLAIMS',
  'CLAIM SECTION'
];

// Bracket styles frequently used in section headers
export const SECTION_BRACKET_LEFT = ['[', '【', '<', '〈', '(', '〔', '［'];
export const SECTION_BRACKET_RIGHT = [']', '】', '>', '〉', ')', '〕', '］'];

// Generic non-claim section tokens to detect boundaries
export const GENERIC_SECTION_TOKENS = [
  '진료기록', '진료 내역', '검사결과', '방문기록', '의사소견', '소견',
  '병력', '과거력', '처방', '투약', '치료', '입원', '퇴원', '검사',
  '요약', 'Summary', 'Diagnosis', 'Impression', 'Assessment'
];

