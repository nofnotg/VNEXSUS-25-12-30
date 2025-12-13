import { logger } from '../../../shared/logging/logger';
import { MEDICAL_KEYWORDS } from '../../../shared/constants/medical';
import type { KeyInfoExtraction, Metrics } from '../types/index.ts';

// 날짜 패턴(ocrParser의 로직과 유사한 범용 패턴)
const DATE_REGEXES: RegExp[] = [
  /\b(20\d{2})[-.\/]\d{1,2}[-.\/]\d{1,2}\b/g,
  /\b\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2}\b/g,
  /\b(20\d{2})년\s*\d{1,2}월\s*\d{1,2}일\b/g,
  /\b\d{2}년\s*\d{1,2}월\s*\d{1,2}일\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
];

// 병원명 힌트
const HOSPITAL_HINT = /(병원|의원|한의원|치과|메디컬센터|센터)/g;

// 금액 패턴
const AMOUNT_REGEX = /(\d{1,3}(?:,\d{3})+|\d+)(?=\s*원|\s*KRW)/g;

// Levenshtein 거리 계산(문자 단위 정확도)
export function charAccuracy(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  const dp = Array.from({ length: lenA + 1 }, () => new Array<number>(lenB + 1).fill(0));
  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  const dist = dp[lenA][lenB];
  const maxLen = Math.max(lenA, lenB);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

export function extractKeyInfo(text: string): KeyInfoExtraction {
  const amounts = Array.from(text.matchAll(AMOUNT_REGEX)).map(m => m[0]);
  const dates = DATE_REGEXES.flatMap(r => Array.from(text.matchAll(r)).map(m => m[0]));
  const hospitals = Array.from(text.matchAll(HOSPITAL_HINT)).map(m => m[0]);
  const allTerms = new Set<string>();
  const lower = text.toLowerCase();
  // 간단한 포함 검색(한국어는 소문자 개념이 적어 원문 그대로도 사용)
  const allMedicalKeywords: readonly string[] = [
    ...MEDICAL_KEYWORDS.DISEASES,
    ...MEDICAL_KEYWORDS.SYMPTOMS,
    ...MEDICAL_KEYWORDS.TREATMENTS,
  ].map(String);
  for (const kw of allMedicalKeywords) {
    if (text.includes(kw)) allTerms.add(kw);
  }
  return { amounts, dates, hospitals, medicalTerms: Array.from(allTerms) };
}

// 구조 유지 점수(간접 지표): 헤더/섹션 유사도 기반 0..1
export function structureScore(original: string, generated: string): number {
  const HEADERS = ['개요', '보험', '진단', '치료', '경과', '결론', '요약'];
  const countMatch = (txt: string) => HEADERS.reduce((acc, h) => acc + (txt.includes(h) ? 1 : 0), 0);
  const o = countMatch(original);
  const g = countMatch(generated);
  if (o === 0) return g > 0 ? 0.5 : 0; // 원문에 헤더 없음
  const ratio = Math.min(1, g / o);
  return ratio;
}

// 표/이미지 인식률(텍스트가 거의 없는 페이지 비율 역수) — 입력으로 페이지별 텍스트 길이 배열을 받는 설계가 이상적이나, 여기서는 텍스트 기준 간접 추정
export function tableImageRecognitionFromText(text: string): number {
  // 표 키워드 존재를 가점
  const hasTable = /표\s*\d+|표\s|table/gi.test(text);
  const length = text.length;
  if (length === 0) return 0;
  const base = Math.min(1, Math.log10(length + 10) / 5);
  return Math.min(1, base + (hasTable ? 0.1 : 0));
}

export function computeMetrics(originalText: string, generatedText: string): Metrics {
  try {
    const charAcc = charAccuracy(originalText || '', generatedText || '');
    const struct = structureScore(originalText || '', generatedText || '');
    const tableImg = tableImageRecognitionFromText(generatedText || '');
    return {
      charAccuracy: charAcc,
      structureScore: struct,
      tableImageRecognition: tableImg,
    };
  } catch (error) {
    const err = error as Error;
    logger.error({ event: 'METRIC_COMPUTE_ERROR', error: { name: err.name, message: err.message, stack: err.stack } });
    return {};
  }
}

export function compareKeyInfo(originalText: string, generatedText: string): Metrics['keyInfoAccuracy'] {
  const orig = extractKeyInfo(originalText || '');
  const gen = extractKeyInfo(generatedText || '');

  const pr = (found: string[], total: string[]) => {
    const setFound = new Set(found.map(s => s.trim()));
    const setTotal = new Set(total.map(s => s.trim()));
    let inter = 0;
    setFound.forEach(s => { if (setTotal.has(s)) inter++; });
    const precision = setFound.size === 0 ? 0 : inter / setFound.size;
    const recall = setTotal.size === 0 ? 0 : inter / setTotal.size;
    return { precision, recall };
  };

  const amountPR = pr(gen.amounts, orig.amounts);
  const datePR = pr(gen.dates, orig.dates);
  const hospitalPR = pr(gen.hospitals, orig.hospitals);
  const medPR = pr(gen.medicalTerms, orig.medicalTerms);

  return {
    amountPrecision: amountPR.precision,
    datePrecision: datePR.precision,
    hospitalRecall: hospitalPR.recall,
    medicalTermRecall: medPR.recall,
  };
}
