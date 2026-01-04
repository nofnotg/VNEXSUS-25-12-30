/**
 * Conformity Calculator (정합성 계산기)
 * 
 * VNEXSUS 앱 생성 보고서와 Ground Truth (caseN_report.txt) 간 정합성 계산
 * 
 * 정합성 등급:
 * - 상 (High): 80~100%
 * - 중 (Medium): 60~79%
 * - 하 (Low): 0~59%
 * 
 * @version 1.0.0
 * @since 2026-01-03
 */

// 간단한 모듈별 로거
const logger = {
  info: (data) => console.log(`[INFO][ConformityCalculator] ${JSON.stringify(data)}`),
  warn: (data) => console.warn(`[WARN][ConformityCalculator] ${JSON.stringify(data)}`),
  error: (data) => console.error(`[ERROR][ConformityCalculator] ${JSON.stringify(data)}`)
};

/**
 * 정합성 가중치 정의
 * 날짜 정확도가 가장 중요 (40%)
 */
const WEIGHTS = {
  dateAccuracy: 0.40,      // 날짜 정확도 (모든 날짜가 정확히 추출되었는가)
  eventBinding: 0.30,      // 이벤트 바인딩 (날짜-이벤트 연결이 올바른가)
  diagnosisAccuracy: 0.15, // 진단명 정확도 (KCD 코드 + 병명 일치)
  treatmentAccuracy: 0.10, // 치료 내용 정확도 (수술/치료 정보 일치)
  hospitalInfo: 0.05       // 병원 정보 (병원명/진료과 일치)
};

/**
 * 날짜 패턴 정규식
 * YYYY.MM.DD, YYYY-MM-DD, YYYY/MM/DD 형식 지원
 */
const DATE_PATTERNS = [
  /\d{4}\.\d{2}\.\d{2}/g,   // 2024.09.27
  /\d{4}-\d{2}-\d{2}/g,     // 2024-09-27
  /\d{4}\/\d{2}\/\d{2}/g,   // 2024/09/27
  /\d{4}\.\d{1,2}\.\d{1,2}/g, // 2024.9.27
];

/**
 * KCD 코드 패턴 (질병분류코드)
 */
const KCD_PATTERN = /[A-Z]\d{2}(?:\.\d{1,2})?/g;

/**
 * 텍스트에서 모든 날짜 추출
 * @param {string} text - 분석할 텍스트
 * @returns {Set<string>} 정규화된 날짜 세트
 */
function extractDates(text) {
  if (!text || typeof text !== 'string') return new Set();
  
  const dates = new Set();
  
  for (const pattern of DATE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // 날짜 정규화: YYYY.MM.DD 형식으로 통일
        const normalized = normalizeDate(match);
        if (normalized && isValidDate(normalized)) {
          dates.add(normalized);
        }
      });
    }
  }
  
  return dates;
}

/**
 * 날짜 정규화 (YYYY.MM.DD 형식)
 * @param {string} dateStr - 원본 날짜 문자열
 * @returns {string|null} 정규화된 날짜
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // 구분자 통일
  const parts = dateStr.split(/[-./]/);
  if (parts.length !== 3) return null;
  
  const year = parts[0].padStart(4, '0');
  const month = parts[1].padStart(2, '0');
  const day = parts[2].padStart(2, '0');
  
  return `${year}.${month}.${day}`;
}

/**
 * 날짜 유효성 검사
 * @param {string} dateStr - YYYY.MM.DD 형식 날짜
 * @returns {boolean} 유효 여부
 */
function isValidDate(dateStr) {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return false;
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  // 합리적인 연도 범위 (1900~2100)
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  return true;
}

/**
 * KCD 코드 추출
 * @param {string} text - 분석할 텍스트
 * @returns {Set<string>} KCD 코드 세트
 */
function extractKcdCodes(text) {
  if (!text || typeof text !== 'string') return new Set();
  
  const matches = text.match(KCD_PATTERN);
  return new Set(matches || []);
}

/**
 * 두 세트 간 포함률 계산 (앱 출력이 GT를 얼마나 포함하는가)
 * @param {Set} appSet - 앱 출력 세트
 * @param {Set} gtSet - Ground Truth 세트
 * @returns {object} { rate, matched, total, missing }
 */
function calculateInclusionRate(appSet, gtSet) {
  if (gtSet.size === 0) {
    return { rate: 1.0, matched: 0, total: 0, missing: [] };
  }
  
  const matched = [...gtSet].filter(item => appSet.has(item));
  const missing = [...gtSet].filter(item => !appSet.has(item));
  
  return {
    rate: matched.length / gtSet.size,
    matched: matched.length,
    total: gtSet.size,
    missing
  };
}

/**
 * 정합성 점수 계산
 * @param {object} params - 계산 파라미터
 * @param {string} params.appReport - 앱 생성 보고서 텍스트
 * @param {string} params.groundTruth - Ground Truth 보고서 텍스트
 * @returns {object} 정합성 분석 결과
 */
export function calculateConformity(params) {
  const { appReport, groundTruth } = params;
  
  if (!appReport || !groundTruth) {
    logger.error({ event: 'conformity_calculation_failed', reason: 'Missing input' });
    return {
      score: 0,
      grade: '하',
      details: { error: 'Missing appReport or groundTruth' }
    };
  }
  
  // 1. 날짜 추출 및 비교
  const appDates = extractDates(appReport);
  const gtDates = extractDates(groundTruth);
  const dateResult = calculateInclusionRate(appDates, gtDates);
  
  // 2. KCD 코드 추출 및 비교 (진단명 대리 지표)
  const appKcd = extractKcdCodes(appReport);
  const gtKcd = extractKcdCodes(groundTruth);
  const kcdResult = calculateInclusionRate(appKcd, gtKcd);
  
  // 3. 점수 계산 (현재 날짜와 진단명만 측정 가능)
  // 이벤트 바인딩, 치료 내용, 병원 정보는 추후 확장
  const dateScore = dateResult.rate * 100;
  const diagnosisScore = kcdResult.rate * 100;
  
  // 가중 평균 계산 (현재 측정 가능한 항목 기준)
  const measuredWeights = {
    dateAccuracy: WEIGHTS.dateAccuracy,
    diagnosisAccuracy: WEIGHTS.diagnosisAccuracy
  };
  const totalWeight = Object.values(measuredWeights).reduce((a, b) => a + b, 0);
  
  const weightedScore = (
    (dateScore * measuredWeights.dateAccuracy) +
    (diagnosisScore * measuredWeights.diagnosisAccuracy)
  ) / totalWeight;
  
  // 등급 결정
  const grade = weightedScore >= 80 ? '상' : weightedScore >= 60 ? '중' : '하';
  
  const result = {
    score: Math.round(weightedScore * 100) / 100,
    grade,
    details: {
      dateAccuracy: {
        score: Math.round(dateScore * 100) / 100,
        appCount: appDates.size,
        gtCount: gtDates.size,
        matched: dateResult.matched,
        missingDates: dateResult.missing.slice(0, 10), // 최대 10개까지 표시
        weight: WEIGHTS.dateAccuracy
      },
      diagnosisAccuracy: {
        score: Math.round(diagnosisScore * 100) / 100,
        appCount: appKcd.size,
        gtCount: gtKcd.size,
        matched: kcdResult.matched,
        missingCodes: kcdResult.missing,
        weight: WEIGHTS.diagnosisAccuracy
      },
      unmeasured: {
        eventBinding: { note: '향후 구현 예정', weight: WEIGHTS.eventBinding },
        treatmentAccuracy: { note: '향후 구현 예정', weight: WEIGHTS.treatmentAccuracy },
        hospitalInfo: { note: '향후 구현 예정', weight: WEIGHTS.hospitalInfo }
      }
    },
    timestamp: new Date().toISOString()
  };
  
  logger.info({
    event: 'conformity_calculated',
    score: result.score,
    grade: result.grade,
    dateAccuracy: dateScore,
    diagnosisAccuracy: diagnosisScore
  });
  
  return result;
}

/**
 * 배치 정합성 계산
 * @param {Array} cases - [{ caseId, appReport, groundTruth }, ...]
 * @returns {object} 배치 분석 결과
 */
export function calculateBatchConformity(cases) {
  if (!Array.isArray(cases) || cases.length === 0) {
    return { results: [], summary: null };
  }
  
  const results = cases.map(c => ({
    caseId: c.caseId,
    ...calculateConformity({
      appReport: c.appReport,
      groundTruth: c.groundTruth
    })
  }));
  
  // 정합성 내림차순 정렬
  results.sort((a, b) => b.score - a.score);
  
  // 통계 계산
  const scores = results.map(r => r.score);
  const summary = {
    totalCases: results.length,
    avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
    maxScore: Math.max(...scores),
    minScore: Math.min(...scores),
    gradeDistribution: {
      상: results.filter(r => r.grade === '상').length,
      중: results.filter(r => r.grade === '중').length,
      하: results.filter(r => r.grade === '하').length
    },
    // 상대 기준 분류
    relativeTiers: classifyRelativeTiers(results)
  };
  
  logger.info({
    event: 'batch_conformity_completed',
    totalCases: summary.totalCases,
    avgScore: summary.avgScore,
    gradeDistribution: summary.gradeDistribution
  });
  
  return { results, summary };
}

/**
 * 상대 기준 상/중/하 분류
 * @param {Array} sortedResults - 정합성 내림차순 정렬된 결과
 * @returns {object} { high, medium, low } 각 티어의 케이스 ID 배열
 */
function classifyRelativeTiers(sortedResults) {
  const n = sortedResults.length;
  if (n === 0) return { high: [], medium: [], low: [] };
  
  // 상위 33%, 중위 34%, 하위 33%
  const highCutoff = Math.ceil(n * 0.33);
  const mediumCutoff = Math.ceil(n * 0.67);
  
  return {
    high: sortedResults.slice(0, highCutoff).map(r => ({
      caseId: r.caseId,
      score: r.score,
      grade: r.grade
    })),
    medium: sortedResults.slice(highCutoff, mediumCutoff).map(r => ({
      caseId: r.caseId,
      score: r.score,
      grade: r.grade
    })),
    low: sortedResults.slice(mediumCutoff).map(r => ({
      caseId: r.caseId,
      score: r.score,
      grade: r.grade
    }))
  };
}

/**
 * 샘플링: 각 티어에서 3개씩 선별
 * @param {object} relativeTiers - classifyRelativeTiers 결과
 * @returns {object} 샘플링된 케이스
 */
export function sampleFromTiers(relativeTiers) {
  const sample = (tier) => {
    if (tier.length <= 3) return tier;
    // 상위, 중간, 경계(하위) 1개씩
    return [
      tier[0],
      tier[Math.floor(tier.length / 2)],
      tier[tier.length - 1]
    ];
  };
  
  return {
    high: sample(relativeTiers.high),
    medium: sample(relativeTiers.medium),
    low: sample(relativeTiers.low)
  };
}

export default {
  calculateConformity,
  calculateBatchConformity,
  sampleFromTiers,
  extractDates,
  extractKcdCodes,
  WEIGHTS
};

