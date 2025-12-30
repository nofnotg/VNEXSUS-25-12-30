// Medical text normalization utilities (ESM)
// - Hospital extraction & normalization
// - Diagnosis extraction & normalization
// - Record consolidation for same-day entries

import { logger } from '../logging/logger.js';
import { HOSPITAL_STOPWORDS, HOSPITAL_CANONICAL_MAP, DIAGNOSIS_SYNONYMS } from '../constants/medicalNormalization.js';

const deptTokens = [
  '내과','외과','피부과','안과','이비인후과','산부인과','소아과','정형외과','신경외과',
  '재활의학과','성형외과','비뇨기과','신경과','흉부외과','마취통증의학과','치과','한의과','한의원'
];

// Prefer core facility suffixes first, then secondary labels
const hospitalEntityPatternsPrimary = [
  /([가-힣A-Za-z0-9·\s]{2,30})(병원|의원|한의원|치과)/,
  /(병원|의원|한의원|치과)([가-힣A-Za-z0-9·\s]{2,30})/
];
const hospitalEntityPatternsSecondary = [
  /([가-힣A-Za-z0-9·\s]{2,30})(센터|클리닉)/,
  /(센터|클리닉)([가-힣A-Za-z0-9·\s]{2,30})/
];

export function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

export function normalizeHospitalName(name) {
  if (!name) return undefined;
  let n = normalizeWhitespace(name)
    .replace(/^[^가-힣A-Za-z]+/, '') // leading noise
    .replace(/\s*:\s*/g, ' ');
  // Trim trailing department tokens (e.g., "피부과")
  const deptRegex = new RegExp(`\\s(?:${deptTokens.join('|')})$`);
  n = n.replace(deptRegex, '');
  // Minor normalizations (common artifacts)
  n = n.replace(/\|/g, '');
  // Canonical mapping
  const canonical = HOSPITAL_CANONICAL_MAP.get(n) || HOSPITAL_CANONICAL_MAP.get(n.replace(/\s+/g, ''));
  n = canonical || n;
  return n.trim();
}

export function extractHospitalNormalized(text) {
  if (!text) return undefined;
  let matchedStopword = false;
  for (const p of hospitalEntityPatternsPrimary) {
    const m = text.match(p);
    if (m) {
      const raw = p === hospitalEntityPatternsPrimary[0] ? (m[1] + m[2]) : (m[2] + m[1]);
      const norm = normalizeHospitalName(raw);
      if (norm && norm.length >= 2) {
        if (!HOSPITAL_STOPWORDS.includes(norm)) return norm;
        matchedStopword = true;
      }
    }
  }
  // Try secondary labels if primary not found
  for (const p of hospitalEntityPatternsSecondary) {
    const m = text.match(p);
    if (m) {
      const raw = p === hospitalEntityPatternsSecondary[0] ? (m[1] + m[2]) : (m[2] + m[1]);
      const norm = normalizeHospitalName(raw);
      if (norm && norm.length >= 2) {
        if (!HOSPITAL_STOPWORDS.includes(norm)) return norm;
        matchedStopword = true;
      }
    }
  }
  // Fallback: simple token search
  if (!matchedStopword) {
    const simple = text.match(/[가-힣A-Za-z0-9·\s]{2,30}(?:병원|의원|한의원|치과|센터|클리닉)/);
    if (simple) {
      const norm = normalizeHospitalName(simple[0]);
      if (norm && !HOSPITAL_STOPWORDS.includes(norm)) return norm;
    }
  }
  return undefined;
}

// ICU/센터/클리닉 라벨 규칙
const icuAliases = [/\bICU\b/i, /\bCCU\b/i, /\bMICU\b/i, /\bSICU\b/i, /\bNICU\b/i];
const labelPatterns = [
  { label: 'ICU', patterns: icuAliases },
  { label: '센터', patterns: [/센터/] },
  { label: '클리닉', patterns: [/클리닉/] }
];

export function extractHospitalLabels(text) {
  if (!text) return [];
  const labels = new Set();
  for (const lp of labelPatterns) {
    for (const r of lp.patterns) {
      if (r.test(text)) {
        labels.add(lp.label);
        break;
      }
    }
  }
  return Array.from(labels);
}

export function extractHospitalWithLabels(text) {
  const name = extractHospitalNormalized(text);
  const labels = extractHospitalLabels(text);
  return { name, labels };
}

const diagnosisCues = [/추정진단/, /진단명/, /상병명/, /Impression/i, /Assessment/i, /Dx\.?/i];
// Accept broader ICD10 tokens, including common misformats like "I20).9", "E1168", "R074"
const icdCandidatePattern = /\b[A-Z][0-9]{2}(?:\.[0-9]{1,2}|\)[\. ]?[0-9]{1,2}|[0-9]{1,2})\b/;

export function normalizeIcdCode(raw) {
  if (!raw) return undefined;
  const cleaned = String(raw).replace(/[^A-Za-z0-9.]/g, "");
  // Already canonical: Letter + 2 digits + optional . + 1-2 digits
  if (/^[A-Z][0-9]{2}(?:\.[0-9]{1,2})?$/.test(cleaned)) return cleaned;
  // Case: Letter + 3-4 digits (e.g., R074 -> R07.4, I209 -> I20.9, E1168 -> E11.68)
  const m = cleaned.match(/^([A-Z])([0-9]{2})([0-9]{1,2})$/);
  if (m) {
    const letter = m[1];
    const head = m[2];
    const tail = m[3];
    return `${letter}${head}.${tail}`;
  }
  // Fallback to best-effort: remove stray ')' and ensure single dot
  const fallback = cleaned.replace(/\.+/, ".");
  return fallback;
}

export function extractIcdCodes(text) {
  if (!text) return [];
  const codes = new Set();
  const matches = String(text).match(new RegExp(icdCandidatePattern, 'g')) || [];
  for (const m of matches) {
    const norm = normalizeIcdCode(m);
    if (norm) codes.add(norm.toUpperCase());
  }
  return Array.from(codes).sort();
}

export function normalizeDiagnosisLine(line) {
  if (!line) return undefined;
  let s = normalizeWhitespace(line)
    .replace(/^(Impression|Assessment|Dx\.?|상병명|진단명|추정진단)\s*[:：-]?\s*/i, '');
  // Collapse repeated parenthetical tokens, e.g., "(Chest pain) (Chest pain) ..." -> single occurrence
  s = s.replace(/(\([^)]*\))(\s*\1)+/g, '$1');
  // Extract and normalize ICD code if present
  const icdRaw = s.match(icdCandidatePattern)?.[0];
  if (icdRaw) {
    const icd = normalizeIcdCode(icdRaw);
    s = s.replace(icdCandidatePattern, '').trim();
    s = `${s} (ICD: ${icd})`.trim();
  }
  // Apply diagnosis synonyms mapping on base token
  const token = s.split(/\s*[(),]/)[0]?.trim();
  const mapped = token ? DIAGNOSIS_SYNONYMS.get(token) : undefined;
  if (mapped) {
    s = s.replace(token, mapped);
  }
  return s || undefined;
}

export function extractDiagnosisNormalized(text) {
  if (!text) return undefined;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (diagnosisCues.some(c => c.test(line))) {
      const next = lines[i + 1]?.trim();
      const norm = normalizeDiagnosisLine(next || line);
      if (norm) return norm;
    }
  }
  // Fallback to first ICD-like token line
  const codeLine = lines.find(l => icdCandidatePattern.test(l));
  if (codeLine) return normalizeDiagnosisLine(codeLine);
  return undefined;
}

export function consolidateSameDayRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return records;
  const out = [];
  let current = null;
  for (const r of records) {
    const hospNorm = r.hospital ? normalizeHospitalName(r.hospital) : undefined;
    if (!current) {
      current = { ...r, hospital: hospNorm || r.hospital };
      continue;
    }
    const currHospNorm = current.hospital ? normalizeHospitalName(current.hospital) : undefined;
    const sameDate = current.date === r.date;
    const sameHosp = (currHospNorm || '') === (hospNorm || '');
    if (sameDate && (sameHosp || !currHospNorm || !hospNorm)) {
      current.content = (current.content || '') + '\n' + (r.content || '');
      current.reason = current.reason || r.reason;
      current.diagnosis = current.diagnosis || r.diagnosis;
      current.hospital = currHospNorm || hospNorm;
    } else {
      out.push(current);
      current = { ...r, hospital: hospNorm || r.hospital };
    }
  }
  if (current) out.push(current);
  logger.info({ event: 'consolidate_same_day_records', before: records.length, after: out.length });
  return out;
}

export default {
  normalizeHospitalName,
  extractHospitalNormalized,
  normalizeDiagnosisLine,
  extractDiagnosisNormalized,
  consolidateSameDayRecords,
  normalizeWhitespace
};
