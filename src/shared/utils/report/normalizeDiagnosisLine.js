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

    // 0) Merge consecutive parentheses after the same outer term using a balanced parser
    // e.g., 협심증(angina)(angina pectoris) → 협심증(angina, angina pectoris)
    current = mergeConsecutiveParenGroups(current);

    // 0.5) Collapse nested duplicates inside a single parenthetical
    // Example: (diabetes mellitus (Diabetes Mellitus)) -> (Diabetes Mellitus)
    current = current.replace(/\(([^()]*)\s*\(\s*([^()]*)\s*\)\s*\)/g, (m, a, b) => {
      const aClean = a.trim().replace(/\s{2,}/g, ' ');
      const bClean = b.trim().replace(/\s{2,}/g, ' ');
      if (aClean.toLowerCase() === bClean.toLowerCase()) {
        const prefer = /[A-Z]/.test(bClean) && !/[A-Z]/.test(aClean) ? bClean : aClean;
        return `(${prefer})`;
      }
      return m;
    });

    // 1) Unify ICD code notation
    // e.g., (ICD코드: R074), ICD 코드 R074, ICD: R074 → (ICD: R074)
    current = current.replace(
      /(\(\s*ICD[\s]*코드\s*:\s*([A-Z][0-9A-Z]{2,})\s*\))|ICD\s*코드\s*[:\s]?\s*([A-Z][0-9A-Z]{2,})|ICD\s*[:\s]?\s*([A-Z][0-9A-Z]{2,})/g,
      (_, g1, code1, code2, code3) => {
        const code = code1 || code2 || code3;
        return `(ICD: ${code})`;
      }
    );

    // 1.1) Fix stray dot placed outside ICD parentheses and ensure proper subcode dot
    // Examples:
    //   ((ICD: I20).9 ...)  → (ICD: I20.9 ...)
    //   ((ICD: E11).68 ...) → (ICD: E11.68 ...)
    current = current.replace(
      /\(ICD:\s*([A-Z])\s*([0-9]{2})\s*\)\s*\.\s*([0-9A-Z]{1,2})/g,
      (_m, letter, major, minor) => `(ICD: ${letter}${major}.${minor})`
    );

    // 1.2) Ensure dot between major and minor ICD segments when missing
    // Examples:
    //   (ICD: R074)  → (ICD: R07.4)
    //   (ICD: E1168) → (ICD: E11.68)
    //   (ICD: I209)  → (ICD: I20.9)
    current = current.replace(
      /\(ICD:\s*([A-Z])\s*([0-9]{2})\s*([0-9A-Z]{1,2})\s*\)/g,
      (_m, letter, major, minor) => `(ICD: ${letter}${major}.${minor})`
    );

    // 2) Flatten nested parentheses inside any parenthetical by removing inner parens
    // Example: 당뇨병(Diabetes Mellitus (당뇨병)) → 당뇨병(Diabetes Mellitus 당뇨병)
    current = current.replace(/\(([^)]*)\)/g, (m, inner) => {
      let s = inner;
      let prev;
      do {
        prev = s;
        s = s.replace(/\(([^)]*)\)/g, '$1');
      } while (s !== prev);
      return `(${s.trim().replace(/\s{2,}/g, ' ')})`;
    });
    try { logger.info({ event: 'diagnosis_debug', stage: 'after_flatten', line: current }); } catch (_) {}

    // 2.6) Collapse immediately repeated phrases inside a parenthetical
    // Example: "diabetes mellitus diabetes mellitus" → "diabetes mellitus"
    current = current.replace(/\(([^)]*)\)/g, (m, inner) => {
      let s = inner;
      // Skip ICD segments to avoid corrupting codes
      if (/\bICD\b/i.test(s)) return m;
      s = s.replace(/\b([A-Za-z]+(?:\s+[A-Za-z]+)*)\b\s+\1\b/gi, '$1');
      return `(${s.trim().replace(/\s{2,}/g, ' ')})`;
    });

    // 2.7) Deduplicate English medical terms and rebuild parentheticals (case-insensitive, prefer title-case)
    current = current.replace(/\(([^)]*)\)/g, (m, inner) => {
      if (/\bICD\b/i.test(inner)) return m;
      const phrases = [...inner.matchAll(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g)].map((mm) => compressRepeatedPhrase(mm[0]));
      if (phrases.length === 0) return m;
      const canon = new Map(); // lower -> preferred display
      for (const p of phrases) {
        const key = p.toLowerCase();
        const prev = canon.get(key);
        if (!prev) canon.set(key, p);
        else {
          const preferred = /[A-Z]/.test(p) && !/[A-Z]/.test(prev) ? p : prev;
          canon.set(key, preferred);
        }
      }
      const rebuilt = Array.from(canon.values());
      return `(${rebuilt.join(', ')})`;
    });
    try { logger.info({ event: 'diagnosis_debug', stage: 'after_en_dedup', line: current }); } catch (_) {}

    // 2.5) Deduplicate inner terms within a single parenthetical (comma/semicolon/및/and)
    current = current.replace(/([가-힣A-Za-z][^()\s]{1,})\s*\(([^)]*)\)/g, (m, outer, inner) => {
      let content = inner.trim();
      // Split by common separators but keep multi-word terms intact
      const parts = content.split(/\s*(?:,|;|\s및\s|\sand\s)\s*/i).filter(Boolean);
      if (parts.length <= 1) return m; // nothing to dedup
      const seen = new Map(); // key -> preferred display
      for (const part of parts) {
        const key = part.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, part);
        } else {
          const prev = seen.get(key);
          const preferCurrent = /[A-Z]/.test(part) && !/[A-Z]/.test(prev);
          if (preferCurrent) seen.set(key, part);
        }
      }
      const joined = Array.from(seen.values()).join(', ');
      return joined ? `${outer}(${joined})` : outer;
    });

    // 3) Remove duplicate outside term repeated inside parentheses
    // e.g., 당뇨병(Diabetes Mellitus (당뇨병)) → 당뇨병(Diabetes Mellitus)
    current = current.replace(/([가-힣A-Za-z][^()\s]{1,})\s*\(([^)]*)\)/g, (m, outer, inner) => {
      const cleanedInner = inner.replace(new RegExp(escapeRegExp(outer), 'gi'), '').replace(/\s{2,}/g, ' ').trim();
      return cleanedInner.length > 0 ? `${outer}(${cleanedInner})` : outer;
    });
    try { logger.info({ event: 'diagnosis_debug', stage: 'after_remove_outer_dup', line: current }); } catch (_) {}

    // 3.5) Canonicalization step removed in favor of balanced merge (step 0)

    // Fix missing space after closed parenthesis before connectors
    // Re-apply English phrase deduplication post canonicalization
    current = current.replace(/\(([^)]*)\)/g, (m, inner) => {
      if (/\bICD\b/i.test(inner)) return m;
      const phrases = [...inner.matchAll(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g)].map((mm) => compressRepeatedPhrase(mm[0]));
      if (phrases.length === 0) return m;
      const canon = new Map();
      for (const p of phrases) {
        const k = p.toLowerCase();
        const prev = canon.get(k);
        if (!prev) canon.set(k, p);
        else if (/[A-Z]/.test(p) && !/[A-Z]/.test(prev)) canon.set(k, p);
      }
      return `(${Array.from(canon.values()).join(', ')})`;
    });
    current = current.replace(/\)(?=(및|그리고|and))/g, ') ');
    // Ensure a space after closing parenthesis when followed by a word character
    current = current.replace(/\)(?=[^\s,.;:!?])/g, ') ');
    // Sanitize: remove any accidental leading commas inside parentheses
    current = current.replace(/\(\s*,\s*/g, '(');
    try { logger.info({ event: 'diagnosis_debug', stage: 'after_spacing_fix', line: current }); } catch (_) {}

    // 4) Deduplicate repeated paired terms within the line
    // e.g., 고혈압(Hypertension) 및 고혈압(Hypertension) → 고혈압(Hypertension)
    const pairsSeen = new Set();
    current = current.replace(/([가-힣A-Za-z][^()\s]{1,})\s*\(([^)]*)\)/g, (m, outer, inner) => {
      // Remove inner duplicates of the outer term
      let cleanedInner = inner.replace(new RegExp(escapeRegExp(outer), 'gi'), '').trim();
      // Normalize spaces
      cleanedInner = cleanedInner.replace(/\s{2,}/g, ' ');
      const key = `${outer.toLowerCase().trim()}::${cleanedInner.toLowerCase()}`;
      if (pairsSeen.has(key)) return '';
      pairsSeen.add(key);
      return cleanedInner ? `${outer.trim()}(${cleanedInner})` : outer.trim();
    });
    // Remove empty parentheses introduced by inner cleanup
    current = current.replace(/\(\s*\)/g, '');
    // Remove accidental leading commas inside parentheses
    current = current.replace(/\(\s*,\s*/g, '(');
    current = current.replace(/\s{2,}/g, ' ').replace(/\s+(,|\.)(?!\S)/g, '$1');
    // Remove spaces before closing parenthesis
    current = current.replace(/\s+\)/g, ')');
    current = current.replace(/\s{2,}/g, ' ').trim();

    // 5) Final safeguard: ensure no nested parentheses remain anywhere
    for (let i = 0; i < 3; i++) {
      const before = current;
      current = current.replace(/\(([^)]*)\)/g, (m, inner) => {
        const flat = inner.replace(/\(([^)]*)\)/g, '$1').trim();
        return `(${flat})`;
      });
      if (current === before) break;
    }
    // Remove any orphan closing parentheses introduced by previous edits
    current = sanitizeParens(current);
    try { logger.info({ event: 'diagnosis_debug', stage: 'after_final_flatten', line: current }); } catch (_) {}

    // Re-run inner deduplication after flattening safeguard
    current = current.replace(/([가-힣A-Za-z][^()\s]{1,})\s*\(([^)]*)\)/g, (m, outer, inner) => {
      const parts = inner.split(/\s*(?:,|;|\s및\s|\sand\s)\s*/i).filter(Boolean);
      if (parts.length <= 1) return m;
      const seen = new Map();
      for (const part of parts) {
        const key = part.toLowerCase();
        if (!seen.has(key)) seen.set(key, part);
        else {
          const prev = seen.get(key);
          const preferCurrent = /[A-Z]/.test(part) && !/[A-Z]/.test(prev);
          if (preferCurrent) seen.set(key, part);
        }
      }
      const joined = Array.from(seen.values()).join(', ');
      return joined ? `${outer}(${joined})` : outer;
    });

    // Final enforcement: ensure English medical terms inside parentheses are unique (prefer title-case)
    current = current.replace(/\(([^)]*)\)/g, (m, inner) => {
      if (/\bICD\b/i.test(inner)) return m;
      const phrases = [...inner.matchAll(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g)].map((mm) => mm[0]);
      if (phrases.length === 0) return m;
      const canon = new Map();
      for (const p of phrases) {
        const k = p.toLowerCase();
        const prev = canon.get(k);
        if (!prev) canon.set(k, p);
        else if (/[A-Z]/.test(p) && !/[A-Z]/.test(prev)) canon.set(k, p);
      }
      const rebuilt = Array.from(canon.values()).join(', ');
      return `(${rebuilt})`;
    });
    try { logger.info({ event: 'diagnosis_debug', stage: 'after_final_en_dedup', line: current }); } catch (_) {}

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

function extractTopLevelParenContents(s) {
  const contents = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') {
      if (depth > 0) cur += ch;
      depth++;
      if (depth === 1) cur = '';
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        contents.push(cur);
        cur = '';
      } else if (depth > 0) {
        cur += ch;
      }
    } else {
      if (depth > 0) cur += ch;
    }
  }
  return contents;
}

function readBalancedParen(s, startIdx) {
  // startIdx must point to '('
  let depth = 0;
  let i = startIdx;
  let buf = '';
  for (; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') {
      depth++;
      if (depth > 1) buf += ch;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { content: buf, end: i };
      }
      buf += ch;
    } else {
      if (depth > 0) buf += ch;
    }
  }
  return null; // unbalanced
}

function preferDisplay(prev, curr) {
  const prevHasTitle = /[A-Z]/.test(prev);
  const currHasTitle = /[A-Z]/.test(curr);
  if (currHasTitle && !prevHasTitle) return curr;
  return prev;
}
function compressRepeatedPhrase(p) {
  const words = p.trim().split(/\s+/);
  if (words.length >= 4 && words.length % 2 === 0) {
    const half = words.length / 2;
    const a = words.slice(0, half).join(' ').toLowerCase();
    const b = words.slice(half).join(' ').toLowerCase();
    if (a === b) return words.slice(0, half).join(' ');
  }
  return p.replace(/\b([A-Za-z]+(?:\s+[A-Za-z]+)+)\b(?:\s+\1\b)+/gi, '$1');
}

function splitInnerParts(s) {
  return s.split(/\s*(?:,|;|\s및\s|\sand\s)\s*/i).filter(Boolean);
}

function flattenAllParens(s) {
  let prev;
  let cur = s;
  do {
    prev = cur;
    cur = cur.replace(/\(([^)]*)\)/g, ' $1 ');
  } while (cur !== prev);
  return cur;
}

function sanitizeParens(s) {
  let depth = 0;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') {
      depth++;
      out += ch;
    } else if (ch === ')') {
      if (depth > 0) {
        depth--;
        out += ch;
      } else {
        // drop unmatched closing paren
      }
    } else {
      out += ch;
    }
  }
  // drop unmatched open parens at the end by trimming
  if (depth > 0) {
    // remove trailing unmatched '('
    out = out.replace(/\(+$/g, '');
  }
  return out;
}

function mergeConsecutiveParenGroups(line) {
  let i = 0;
  let result = '';
  let changed = false;
  const outerRegex = /([가-힣A-Za-z][^()\s]{1,})\s*\(/g;
  while (i < line.length) {
    outerRegex.lastIndex = i;
    const m = outerRegex.exec(line);
    if (!m) {
      result += line.slice(i);
      break;
    }
    const start = m.index;
    const outer = m[1];
    const firstParenIdx = outerRegex.lastIndex - 1; // points to '('
    // Copy preceding segment
    result += line.slice(i, start);
    // Read first group
    const g1 = readBalancedParen(line, firstParenIdx);
    if (!g1) {
      // Unbalanced - fallback: copy the rest and stop
      result += line.slice(start);
      break;
    }
    let endIdx = g1.end + 1;
    const groups = [g1.content];
    // Collect successive groups immediately following
    while (true) {
      // Skip spaces
      while (endIdx < line.length && /\s/.test(line[endIdx])) endIdx++;
      if (line[endIdx] !== '(') break;
      const g = readBalancedParen(line, endIdx);
      if (!g) break;
      groups.push(g.content);
      endIdx = g.end + 1;
    }
    if (groups.length < 2) {
      // No consecutive groups, copy original and continue
      result += line.slice(start, endIdx);
      i = endIdx;
      continue;
    }
    // If any is ICD, keep them separate (append after merged display)
    const icdTail = groups
      .filter((c) => /\bICD\b/i.test(c))
      .map((c) => `(${c})`)
      .join(' ');
    const normalGroups = groups.filter((c) => !/\bICD\b/i.test(c));
    // Build tokens
    const seen = new Map();
    for (const content of normalGroups) {
      const flat = flattenAllParens(content).trim();
      const parts = splitInnerParts(flat);
      for (let sp of parts) {
        let cleaned = sp.replace(new RegExp(escapeRegExp(outer), 'gi'), '').trim();
        cleaned = cleaned.replace(/\(\s*\)/g, '').trim();
        if (!cleaned) continue;
        cleaned = cleaned.replace(/\s{2,}/g, ' ');
        // Extract English phrases; if present, prefer deduping by phrases only
        const enPhrases = [...cleaned.matchAll(/[A-Za-z]+(?:\s+[A-Za-z]+)*/g)].map((mm) => compressRepeatedPhrase(mm[0].trim()));
        if (enPhrases.length > 0) {
          for (const phrase of enPhrases) {
            if (!phrase) continue;
            const k = phrase.toLowerCase();
            if (!seen.has(k)) seen.set(k, phrase);
            else seen.set(k, preferDisplay(seen.get(k), phrase));
          }
        } else {
          const key = cleaned.toLowerCase();
          if (!seen.has(key)) seen.set(key, cleaned);
          else seen.set(key, preferDisplay(seen.get(key), cleaned));
        }
      }
    }
    const display = Array.from(seen.values()).join(', ');
    if (display) {
      try { logger.info({ event: 'diagnosis_debug', stage: 'merge_display', outer, display }); } catch (_) {}
      const tailSpace = /\s/.test(line[endIdx - 1]) ? '' : '';
      result += `${outer}(${display})${icdTail ? ' ' + icdTail : ''}`;
      changed = true;
    } else {
      // Nothing to display, keep original
      result += line.slice(start, endIdx);
    }
    i = endIdx;
  }
  return changed ? result : line;
}
