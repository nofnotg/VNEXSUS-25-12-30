/**
 * Phase 4: Insurance Period Parser
 *
 * 목표: "보험기간 YYYY-MM-DD ~ YYYY-MM-DD"에서 시작일만 중요하게 처리
 * - 보험가입일(시작일): 최고 중요도
 * - 보험만기일(종료일): 낮은 중요도
 */

/**
 * 날짜 정규화 (다양한 형식 → YYYY-MM-DD)
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DD (이미 정규화됨)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  // YYYY.MM.DD → YYYY-MM-DD
  if (dateStr.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
    return dateStr.replace(/\./g, '-');
  }

  // YYYY/MM/DD → YYYY-MM-DD
  if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
    return dateStr.replace(/\//g, '-');
  }

  // YYYY.M.D → YYYY-MM-DD (월/일 패딩)
  const match = dateStr.match(/^(\d{4})[\.\/-](\d{1,2})[\.\/-](\d{1,2})$/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * 보험기간 파싱
 * 패턴: "보험기간 2021-03-24 ~ 2069-03-24" 또는 "보험기간: 2021.03.24 ~ 2069.03.24"
 *
 * @param {string} context - 날짜 주변 컨텍스트
 * @param {Array} allDates - 해당 컨텍스트에서 추출된 모든 날짜들
 * @returns {object|null} { insuranceStartDate, insuranceEndDate } 또는 null
 */
export function parseInsurancePeriod(context, allDates = []) {
  if (!context) return null;

  // 패턴 1: "보험기간 YYYY-MM-DD ~ YYYY-MM-DD"
  const periodPattern = /보험기간\s*:?\s*(\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2})\s*[~\-–—]\s*(\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2})/;
  const match = context.match(periodPattern);

  if (match) {
    const startDate = normalizeDate(match[1]);  // 보험가입일 (중요!)
    const endDate = normalizeDate(match[2]);    // 보험만기일 (중요하지 않음)

    if (startDate && endDate) {
      return {
        insuranceStartDate: {
          date: startDate,
          relevance: 'HIGH',
          score: 85,
          type: '보험가입일'
        },
        insuranceEndDate: {
          date: endDate,
          relevance: 'LOW',
          score: 15,
          type: '보험만기일'
        }
      };
    }
  }

  // 패턴 2: "가입일: YYYY.MM.DD" 단독
  const startPattern = /(?:가입일|계약일|보장개시일)\s*:?\s*(\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2})/;
  const startMatch = context.match(startPattern);

  if (startMatch) {
    const startDate = normalizeDate(startMatch[1]);
    if (startDate) {
      return {
        insuranceStartDate: {
          date: startDate,
          relevance: 'HIGH',
          score: 85,
          type: '보험가입일'
        }
      };
    }
  }

  // 패턴 3: "만기일: YYYY.MM.DD" 단독
  const endPattern = /(?:만기일|종료일)\s*:?\s*(\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2})/;
  const endMatch = context.match(endPattern);

  if (endMatch) {
    const endDate = normalizeDate(endMatch[1]);
    if (endDate) {
      return {
        insuranceEndDate: {
          date: endDate,
          relevance: 'LOW',
          score: 15,
          type: '보험만기일'
        }
      };
    }
  }

  return null;
}

/**
 * 날짜 배열에서 보험기간 분리 처리
 * @param {Array} dates - 날짜 배열
 * @returns {object} { processed: Array, stats: object }
 */
export function processInsurancePeriods(dates) {
  const processed = [];
  const stats = {
    insuranceStartDates: 0,
    insuranceEndDates: 0,
    adjusted: 0
  };

  dates.forEach(item => {
    const periodInfo = parseInsurancePeriod(item.context, [item.date]);

    if (periodInfo) {
      // 보험기간이 파싱된 경우
      if (periodInfo.insuranceStartDate && periodInfo.insuranceStartDate.date === item.date) {
        // 보험가입일 (시작일)
        processed.push({
          ...item,
          type: '보험가입일',
          normalizedType: '보험가입일',
          isInsuranceStart: true,
          isInsuranceEnd: false,
          insurancePeriodParsed: true
        });
        stats.insuranceStartDates++;
        stats.adjusted++;
      } else if (periodInfo.insuranceEndDate && periodInfo.insuranceEndDate.date === item.date) {
        // 보험만기일 (종료일)
        processed.push({
          ...item,
          type: '보험만기일',
          normalizedType: '보험만기일',
          isInsuranceStart: false,
          isInsuranceEnd: true,
          insurancePeriodParsed: true
        });
        stats.insuranceEndDates++;
        stats.adjusted++;
      } else {
        // 보험기간 컨텍스트지만 날짜가 매칭 안됨
        processed.push(item);
      }
    } else {
      // 보험기간 아님
      processed.push(item);
    }
  });

  return { processed, stats };
}
