/**
 * Phase 3: Recency Scoring (시간적 중요도)
 *
 * 목표: 청구일 기준 기간별 차등 점수
 * - 3개월 이내: 압도적 중요도 (고지의무 위반, 기왕증 판단 핵심)
 * - 1년 이내: 높은 중요도
 * - 5년 이내: 중요 (과거력 검토 범위)
 * - 10년 이내: 보통
 * - 10년 초과: 낮은 관련성
 */

/**
 * 청구일 기준 시간적 중요도 점수 계산
 * @param {string} date - YYYY-MM-DD 형식
 * @param {string} claimDate - 청구일 (YYYY-MM-DD 형식, 없으면 현재일)
 * @returns {object} { score: number, period: string, monthsDiff: number }
 */
export function calculateRecencyScore(date, claimDate = null) {
  const dateObj = new Date(date);
  const claimObj = claimDate ? new Date(claimDate) : new Date();

  const daysDiff = Math.abs((claimObj - dateObj) / (1000 * 60 * 60 * 24));
  const monthsDiff = daysDiff / 30;

  let score;
  let period;

  // 손해사정 실무 기반 점수
  if (monthsDiff <= 3) {
    // 3개월 이내: 압도적 중요도 (고지의무/기왕증)
    score = 50;  // ⬆️ 최고점
    period = '3개월 이내';
  } else if (monthsDiff <= 12) {
    // 1년 이내: 높은 중요도
    score = 35;
    period = '1년 이내';
  } else if (monthsDiff <= 60) {
    // 5년 이내: 중요 (과거력 검토 범위)
    score = 20;
    period = '5년 이내';
  } else if (monthsDiff <= 120) {
    // 10년 이내
    score = 10;
    period = '10년 이내';
  } else {
    // 10년 초과
    score = 5;
    period = '10년 초과';
  }

  return {
    score,
    period,
    monthsDiff: Math.round(monthsDiff),
    daysDiff: Math.round(daysDiff)
  };
}

/**
 * 청구일 추정 (GT 보고서에서 추출 또는 기본값 사용)
 * @param {object} caseInfo - 케이스 정보
 * @returns {string} YYYY-MM-DD 형식
 */
export function estimateClaimDate(caseInfo) {
  // GT 보고서에서 청구일 추출 로직 (추후 구현)
  // 현재는 현재일 사용
  return new Date().toISOString().split('T')[0];
}

/**
 * 날짜 배열에 시간적 중요도 점수 부여
 * @param {Array} dates - 날짜 배열
 * @param {string} claimDate - 청구일
 * @returns {Array} 점수가 추가된 날짜 배열
 */
export function scoreByRecency(dates, claimDate = null) {
  return dates.map(item => {
    const recency = calculateRecencyScore(item.date, claimDate);

    return {
      ...item,
      recencyScore: recency.score,
      recencyPeriod: recency.period,
      monthsFromClaim: recency.monthsDiff,
      daysFromClaim: recency.daysDiff
    };
  });
}

/**
 * 시간적 중요도 기준 필터링
 * @param {Array} dates - 날짜 배열
 * @param {number} minScore - 최소 recency score
 * @returns {Array} 필터링된 날짜 배열
 */
export function filterByRecency(dates, minScore = 10) {
  return dates.filter(item => (item.recencyScore || 0) >= minScore);
}
