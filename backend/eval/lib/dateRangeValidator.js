/**
 * Phase 1: Date Range Validation
 *
 * 목표: 명백한 오류 제거
 * - 2000년 이전 날짜 제거 (의미있는 과거 범위 초과)
 * - 미래 날짜 처리 (보험만기일 vs 일반 미래 날짜 구분)
 */

const DATE_VALIDATION = {
  MIN_YEAR: 2000,  // 의미있는 과거 범위
  MAX_YEAR: new Date().getFullYear() + 1,  // 현재년도 + 1년 (예약일 허용)
};

/**
 * 보험만기일인지 판단
 */
function isInsuranceEndDate(context, type) {
  if (!context) return false;

  const lowerContext = context.toLowerCase();

  // 명시적 보험만기일 키워드
  const endKeywords = ['만기', '종료일', '보험기간.*~', '~\\s*\\d{4}', '소멸'];

  // 타입이 보험만기면 확실
  if (type && type.includes('만기')) {
    return true;
  }

  // 컨텍스트 분석
  return endKeywords.some(kw => {
    const regex = new RegExp(kw, 'i');
    return regex.test(lowerContext);
  });
}

/**
 * 날짜 범위 검증
 * @param {string} date - YYYY-MM-DD 형식
 * @param {string} context - 날짜 주변 컨텍스트
 * @param {string} type - 날짜 타입
 * @returns {object} { valid: boolean, reason?: string, relevance?: string, specialType?: string }
 */
export function validateDateRange(date, context = '', type = '') {
  if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return { valid: false, reason: 'INVALID_FORMAT' };
  }

  const year = parseInt(date.split('-')[0]);
  const month = parseInt(date.split('-')[1]);
  const day = parseInt(date.split('-')[2]);

  // 기본 유효성 검증
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, reason: 'INVALID_DATE' };
  }

  // 1. 과거 범위 초과 → 제거
  if (year < DATE_VALIDATION.MIN_YEAR) {
    return { valid: false, reason: 'TOO_OLD' };
  }

  // 2. 미래 날짜 처리
  if (year > DATE_VALIDATION.MAX_YEAR) {
    // 보험만기일인 경우 → 낮은 중요도로 분류 (제거 아님)
    if (isInsuranceEndDate(context, type)) {
      return {
        valid: true,
        relevance: 'LOW',
        specialType: 'insuranceEndDate'
      };
    }
    // 일반 미래 날짜 → 제거
    return { valid: false, reason: 'FUTURE_DATE' };
  }

  // 3. 유효한 날짜
  return { valid: true };
}

/**
 * 날짜 배열 검증
 */
export function validateDates(dates) {
  const results = {
    valid: [],
    filtered: [],
    stats: {
      total: dates.length,
      validCount: 0,
      tooOld: 0,
      futureDate: 0,
      invalidFormat: 0,
      insuranceEndDate: 0
    }
  };

  dates.forEach(item => {
    const validation = validateDateRange(item.date, item.context, item.type);

    if (validation.valid) {
      results.valid.push({
        ...item,
        validation
      });
      results.stats.validCount++;

      if (validation.specialType === 'insuranceEndDate') {
        results.stats.insuranceEndDate++;
      }
    } else {
      results.filtered.push({
        ...item,
        filterReason: validation.reason
      });

      if (validation.reason === 'TOO_OLD') results.stats.tooOld++;
      if (validation.reason === 'FUTURE_DATE') results.stats.futureDate++;
      if (validation.reason === 'INVALID_FORMAT') results.stats.invalidFormat++;
    }
  });

  return results;
}
