/**
 * Phase 7: Comprehensive Scoring System
 *
 * 목표: 모든 요소를 통합한 최종 점수 산출
 * - 타입 점수 (0-100)
 * - 시간적 중요도 (0-50)
 * - 컨텍스트 점수 (-30 ~ +30)
 * - 빈도 점수 (0-20)
 * - 특수 처리 (보험만기일 페널티, 문서 메타데이터 페널티)
 */

/**
 * 날짜 빈도 계산 (같은 날짜가 여러 번 나타날 경우)
 * @param {Array} dates - 날짜 배열
 * @returns {Map} 날짜별 빈도
 */
function calculateFrequency(dates) {
  const frequencyMap = new Map();

  dates.forEach(item => {
    const count = frequencyMap.get(item.date) || 0;
    frequencyMap.set(item.date, count + 1);
  });

  return frequencyMap;
}

/**
 * 빈도 점수 계산
 * @param {number} frequency - 날짜 출현 빈도
 * @returns {number} 0-20 점수
 */
function getFrequencyScore(frequency) {
  if (frequency >= 3) return 20;
  if (frequency >= 2) return 10;
  return 0;
}

/**
 * 종합 점수 계산
 * @param {object} dateInfo - 날짜 정보 (모든 Phase의 점수 포함)
 * @param {number} frequency - 날짜 빈도
 * @returns {object} { finalScore: number, relevance: string, breakdown: object }
 */
export function calculateComprehensiveScore(dateInfo, frequency = 1) {
  let score = 0;
  const breakdown = {};

  // 1. 타입 점수 (0-100)
  const typeScore = dateInfo.typeScore || 20; // 기본값 20 (기타)
  score += typeScore;
  breakdown.typeScore = typeScore;

  // 2. 시간적 중요도 (0-50)
  const recencyScore = dateInfo.recencyScore || 0;
  score += recencyScore;
  breakdown.recencyScore = recencyScore;

  // 3. 컨텍스트 점수 (-30 ~ +30)
  const contextScore = dateInfo.contextScore || 0;
  score += contextScore;
  breakdown.contextScore = contextScore;

  // 4. 빈도 점수 (0-20)
  const frequencyScore = getFrequencyScore(frequency);
  score += frequencyScore;
  breakdown.frequencyScore = frequencyScore;

  // 5. 문서 메타데이터 페널티 (-30)
  const metadataPenalty = dateInfo.metadataPenalty || 0;
  score += metadataPenalty;
  breakdown.metadataPenalty = metadataPenalty;

  // 6. 특수 처리: 보험만기일 대폭 페널티
  if (dateInfo.isInsuranceEnd || dateInfo.normalizedType === '보험만기일') {
    const insuranceEndPenalty = -50;
    score += insuranceEndPenalty;
    breakdown.insuranceEndPenalty = insuranceEndPenalty;
  }

  // 7. 특수 보너스: 보험가입일
  if (dateInfo.isInsuranceStart || dateInfo.normalizedType === '보험가입일') {
    const insuranceStartBonus = 10;
    score += insuranceStartBonus;
    breakdown.insuranceStartBonus = insuranceStartBonus;
  }

  // 최종 점수
  const finalScore = Math.max(0, Math.min(200, score)); // 0-200 범위로 제한

  // Relevance 등급
  let relevance;
  if (finalScore >= 80) {
    relevance = 'CRITICAL';
  } else if (finalScore >= 60) {
    relevance = 'HIGH';
  } else if (finalScore >= 40) {
    relevance = 'MEDIUM';
  } else if (finalScore >= 20) {
    relevance = 'LOW';
  } else {
    relevance = 'FILTER';
  }

  return {
    finalScore,
    relevance,
    breakdown
  };
}

/**
 * 날짜 배열에 종합 점수 부여
 * @param {Array} dates - 날짜 배열 (모든 Phase의 점수 포함)
 * @returns {Array} 종합 점수가 추가된 날짜 배열
 */
export function scoreComprehensively(dates) {
  // 빈도 계산
  const frequencyMap = calculateFrequency(dates);

  // 각 날짜에 종합 점수 부여
  const scored = dates.map(item => {
    const frequency = frequencyMap.get(item.date) || 1;
    const comprehensiveScore = calculateComprehensiveScore(item, frequency);

    return {
      ...item,
      frequency,
      finalScore: comprehensiveScore.finalScore,
      relevance: comprehensiveScore.relevance,
      scoreBreakdown: comprehensiveScore.breakdown
    };
  });

  // 최종 점수로 정렬 (내림차순)
  scored.sort((a, b) => b.finalScore - a.finalScore);

  return scored;
}

/**
 * Relevance 기준 필터링
 * @param {Array} dates - 종합 점수가 부여된 날짜 배열
 * @param {string} minRelevance - 최소 relevance ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'FILTER')
 * @returns {object} { kept: Array, filtered: Array }
 */
export function filterByRelevance(dates, minRelevance = 'LOW') {
  const relevanceOrder = {
    'CRITICAL': 5,
    'HIGH': 4,
    'MEDIUM': 3,
    'LOW': 2,
    'FILTER': 1
  };

  const minLevel = relevanceOrder[minRelevance] || 2;

  const kept = dates.filter(item => {
    const itemLevel = relevanceOrder[item.relevance] || 1;
    return itemLevel >= minLevel;
  });

  const filtered = dates.filter(item => {
    const itemLevel = relevanceOrder[item.relevance] || 1;
    return itemLevel < minLevel;
  });

  return { kept, filtered };
}

/**
 * 점수 임계값 기준 필터링
 * @param {Array} dates - 종합 점수가 부여된 날짜 배열
 * @param {number} minScore - 최소 점수 (기본값: 20)
 * @returns {object} { kept: Array, filtered: Array }
 */
export function filterByScore(dates, minScore = 20) {
  const kept = dates.filter(item => item.finalScore >= minScore);
  const filtered = dates.filter(item => item.finalScore < minScore);

  return { kept, filtered };
}
