// Diagnosis line normalization utility
// - Remove duplicate translations within parentheses
// - Flatten nested parentheses inside parentheses
// - Unify ICD code notation to (ICD: CODE)
// - Deduplicate repeated paired terms within a single line
// ESM module

import { logger } from '../../logging/logger.js';

/**
 * Normalize diagnosis-related phrasing in a full report text.
 * Focuses on minimal, safe post-processing without altering semantics.
 * @param {string} text
 * @returns {{ normalizedText: string, stats: { adjustments: number } }}
 */
export function normalizeDiagnosisLines(text) {
  let adjustments = 0;

  if (typeof text !== 'string' || text.length === 0) {
    return { normalizedText: text || '', stats: { adjustments } };
  }

  const lines = text.split(/\r?\n/);

  const normalizedLines = lines.map((line) => {
    let current = line;
    const original = line;

    // Apply only when the line is likely diagnosis-related or contains parentheses
    const isDiagnosisContext = /진단|병명|증상/.test(current) || /\([^)]*\)/.test(current);
    if (!isDiagnosisContext) return current;

    // 1) Unify ICD code notation
    // e.g., (ICD코드: R074), ICD 코드 R074, ICD: R074 → (ICD: R074)
    current = current.replace(
      /(\(\s*ICD[\s]*코드\s*:\s*([A-Z][0-9A-Z]{2,})\s*\))|ICD\s*코드\s*[:\s]?\s*([A-Z][0-9A-Z]{2,})|ICD\s*[:\s]?\s*([A-Z][0-9A-Z]{2,})/g,
      (_, g1, code1, code2, code3) => {
        const code = code1 || code2 || code3;
        return `(ICD: ${code})`;
      }
    );

    // 2) Flatten nested parentheses inside a single parenthetical
    // Remove inner (...) groups inside a (...) block: (A (B) C) → (A B C)
    current = current.replace(/\(([^()]*)\)/g, (m, inner) => {
      const flattened = inner.replace(/\([^()]*\)/g, (mm) => mm.replace(/[()]/g, ''));
      return `(${flattened.trim().replace(/\s{2,}/g, ' ')})`;
    });

    // 3) Remove duplicate outside term repeated inside parentheses
    // e.g., 당뇨병(Diabetes Mellitus (당뇨병)) → 당뇨병(Diabetes Mellitus)
    current = current.replace(/([가-힣A-Za-z][^()\s]{1,})\s*\(([^)]*)\)/g, (m, outer, inner) => {
      const cleanedInner = inner.replace(new RegExp(escapeRegExp(outer), 'gi'), '').replace(/\s{2,}/g, ' ').trim();
      return cleanedInner.length > 0 ? `${outer}(${cleanedInner})` : outer;
    });

    // 4) Deduplicate repeated paired terms within the line
    // e.g., 고혈압(Hypertension) 및 고혈압(Hypertension) → 고혈압(Hypertension)
    const pairsSeen = new Set();
    current = current.replace(/([가-힣A-Za-z][^()\s]{1,})\s*\(([^)]*)\)/g, (m, outer, inner) => {
      const key = `${outer.toLowerCase().trim()}::${inner.toLowerCase().trim()}`;
      if (pairsSeen.has(key)) return '';
      pairsSeen.add(key);
      const trimmedInner = inner.trim().replace(/\s{2,}/g, ' ');
      return `${outer.trim()}(${trimmedInner})`;
    });
    // Remove empty parentheses introduced by inner cleanup
    current = current.replace(/\(\s*\)/g, '');
    current = current.replace(/\s{2,}/g, ' ').replace(/\s+(,|\.)(?!\S)/g, '$1');
    // Remove spaces before closing parenthesis
    current = current.replace(/\s+\)/g, ')');
    current = current.replace(/\s{2,}/g, ' ').trim();

    if (current !== original) adjustments++;
    return current;
  });

  const normalizedText = normalizedLines.join('\n');
  try {
    logger.info({ event: 'diagnosis_normalization', adjustments });
  } catch (_) {
    // logger failures should not affect processing
  }
  return { normalizedText, stats: { adjustments } };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
