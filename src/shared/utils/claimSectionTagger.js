// Claim section detection helpers (ESM)
// Pure utilities to detect claim-related section headers and generic section boundaries.

import { CLAIM_SECTION_TOKENS, SECTION_BRACKET_LEFT, SECTION_BRACKET_RIGHT, GENERIC_SECTION_TOKENS } from '../constants/claimSections.js';

const joinAlternation = (arr) => arr.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

// Build bracketed header regex like [청구사항], 【청구】, <CLAIM>, etc.
const BRACKETED_HEADER = new RegExp(
  `^\s*(?:${joinAlternation(SECTION_BRACKET_LEFT)})\s*([\u3131-\u318E\uAC00-\uD7A3A-Za-z0-9\s]{1,40})\s*(?:${joinAlternation(SECTION_BRACKET_RIGHT)})\s*$`
);

// Plain header like "청구사항:", "# 청구", "CLAIM SECTION"
const PLAIN_HEADER = new RegExp(
  `^\s*(?:[#]{0,3}\s*)?([\u3131-\u318E\uAC00-\uD7A3A-Za-z0-9\s]{1,40})\s*(?:[:：])?\s*$`
);

export function isClaimSectionHeader(line) {
  if (!line) return false;
  const s = String(line).trim();
  const m1 = s.match(BRACKETED_HEADER);
  const m2 = s.match(PLAIN_HEADER);
  const token = (m1?.[1] || m2?.[1] || '').trim().toLowerCase();
  if (!token) {
    // Fallback: permissive English detection when no header format is used
    const lower = s.toLowerCase();
    if (s.startsWith('#')) {
      return lower.includes('claim') || lower.includes('청구');
    }
    return /\bclaim\b/.test(lower);
  }
  return CLAIM_SECTION_TOKENS.some(t => token.includes(t.toLowerCase()));
}

export function isAnySectionHeader(line) {
  if (!line) return false;
  const s = String(line).trim();
  const m1 = s.match(BRACKETED_HEADER);
  const m2 = s.match(PLAIN_HEADER);
  const token = (m1?.[1] || m2?.[1] || '').trim().toLowerCase();
  if (!token) {
    const lower = s.toLowerCase();
    // Fallback: treat obvious claim/generic labels without bracket/heading markers as headers
    if (/\bclaim\b/.test(lower) || lower.includes('청구') || lower.includes('진료') || lower.includes('검사')) {
      return true;
    }
    return false;
  }
  // If matches claim tokens, it's still a section header
  if (CLAIM_SECTION_TOKENS.some(t => token.includes(t.toLowerCase()))) return true;
  // Otherwise check generic tokens to avoid false positives on normal sentences
  return GENERIC_SECTION_TOKENS.some(t => token.includes(t.toLowerCase()));
}

// Tag events with isClaim flag based on whether any content line was inside a claim section.
export function tagEventsWithClaimFlag(events, text) {
  if (!Array.isArray(events) || !text) return events;
  const lines = String(text).split('\n');
  let inClaim = false;

  // Precompute line-level claim state
  const claimByLine = lines.map(line => {
    const headerClaim = isClaimSectionHeader(line);
    const headerAny = isAnySectionHeader(line);
    if (headerAny) {
      inClaim = headerClaim; // toggle at each header
      return inClaim;
    }
    return inClaim;
  });

  // If events have start/end indices, use them; else fallback by scanning content lines
  return events.map(ev => {
    let isClaim = false;
    const contentLines = String(ev.content || '').split('\n');
    // Fallback: try to locate each content line in original text and check its claim state
    for (const cl of contentLines) {
      const idx = lines.findIndex(l => l.trim() === cl.trim());
      if (idx >= 0 && claimByLine[idx]) { isClaim = true; break; }
    }
    // Secondary fallback: explicit claim keyword cues inside event content
    if (!isClaim) {
      const lower = String(ev.content || '').toLowerCase();
      if (lower.includes('청구') || /\bclaim\b/.test(lower) || lower.includes('보험')) {
        isClaim = true;
      }
    }
    return { ...ev, isClaim };
  });
}

export default {
  isClaimSectionHeader,
  isAnySectionHeader,
  tagEventsWithClaimFlag
};
