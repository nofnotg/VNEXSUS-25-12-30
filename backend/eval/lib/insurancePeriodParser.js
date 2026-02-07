/**
 * Phase 4: Insurance Period Parser
 *
 * 목표: "보험기간 YYYY-MM-DD ~ YYYY-MM-DD"에서 시작일만 중요하게 처리
 * - 보험가입일(시작일): 최고 중요도 (보상 가능 여부 판단의 핵심)
 * - 보험만기일(종료일): 최소 중요도 (보험 심사에 무관)
 *
 * 비즈니스 로직:
 * - 보험 심사 판단 기준: 사건 발생일과 보험 가입일의 선후관계
 * - 사건 발생일 >= 보험 가입일 → 보상 가능
 * - 사건 발생일 < 보험 가입일 → 보상 불가 (기왕증)
 * - 만기일은 선후관계 판단에 무관
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
          relevance: 'CRITICAL',  // 최고 중요도
          score: 95,  // 보험 가입일은 핵심 정보
          type: '보험가입일',
          importance: 'critical'  // 심사 필수
        },
        insuranceEndDate: {
          date: endDate,
          relevance: 'VERY_LOW',  // 최소 중요도
          score: 5,  // 만기일은 거의 무시
          type: '보험만기일',
          importance: 'low'  // 심사 무관
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
          relevance: 'CRITICAL',
          score: 95,
          type: '보험가입일',
          importance: 'critical'
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
          relevance: 'VERY_LOW',
          score: 5,
          type: '보험만기일',
          importance: 'low'
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
