/**
 * 보험가입일 기준 날짜 플래그 시스템
 * 
 * 목적: 사용자가 보험가입일을 입력하면
 *      - 각 날짜 이벤트에 3개월/5년 이내 플래그 표시
 *      - 보험가입일 자체도 이벤트로 표시
 * 
 * 손해사정 실무 기반:
 *  - 3개월 이내: 고지의무 위반 / 기왕증 핵심 심사 구간
 *  - 5년 이내: 과거력 검토 대상
 */

/**
 * 두 날짜 사이의 개월 수 계산
 * @param {string} date1 - YYYY-MM-DD 형식
 * @param {string} date2 - YYYY-MM-DD 형식
 * @returns {number} 개월 수 (절대값)
 */
function getMonthsDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  return Math.abs(months);
}

/**
 * 두 날짜 사이의 일수 계산
 * @param {string} date1 - YYYY-MM-DD 형식
 * @param {string} date2 - YYYY-MM-DD 형식
 * @returns {number} 일수 (절대값)
 */
function getDaysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 날짜가 기준일 이전인지 확인
 * @param {string} targetDate - 확인할 날짜
 * @param {string} baseDate - 기준 날짜 (보험가입일)
 * @returns {boolean}
 */
function isBeforeDate(targetDate, baseDate) {
  return new Date(targetDate) < new Date(baseDate);
}

/**
 * 날짜가 기준일 이후인지 확인
 * @param {string} targetDate - 확인할 날짜
 * @param {string} baseDate - 기준 날짜 (보험가입일)
 * @returns {boolean}
 */
function isAfterDate(targetDate, baseDate) {
  return new Date(targetDate) > new Date(baseDate);
}

/**
 * 날짜가 기준일 기준 N개월 이내인지 확인
 * @param {string} targetDate - 확인할 날짜
 * @param {string} baseDate - 기준 날짜 (보험가입일)
 * @param {number} months - 개월 수
 * @returns {boolean}
 */
function isWithinMonths(targetDate, baseDate, months) {
  const daysDiff = getDaysDiff(targetDate, baseDate);
  const approxMonthsDiff = daysDiff / 30;
  return approxMonthsDiff <= months;
}

/**
 * 날짜가 기준일 기준 N년 이내인지 확인
 * @param {string} targetDate - 확인할 날짜
 * @param {string} baseDate - 기준 날짜 (보험가입일)
 * @param {number} years - 년수
 * @returns {boolean}
 */
function isWithinYears(targetDate, baseDate, years) {
  const daysDiff = getDaysDiff(targetDate, baseDate);
  const approxYearsDiff = daysDiff / 365;
  return approxYearsDiff <= years;
}

/**
 * 보험가입일 기준 플래그 생성
 * @param {string} eventDate - 이벤트 날짜 (YYYY-MM-DD)
 * @param {string} insuranceStartDate - 보험가입일 (YYYY-MM-DD)
 * @returns {object} 플래그 객체
 */
export function createInsuranceFlags(eventDate, insuranceStartDate) {
  if (!eventDate || !insuranceStartDate) {
    return {
      within3MonthsBefore: false,
      within5YearsBefore: false,
      within3MonthsAfter: false,
      isInsuranceStartDate: false,
      isBeforeInsurance: false,
      isAfterInsurance: false,
      daysDiff: null,
      position: 'unknown'
    };
  }

  const isBefore = isBeforeDate(eventDate, insuranceStartDate);
  const isAfter = isAfterDate(eventDate, insuranceStartDate);
  const isSameDate = eventDate === insuranceStartDate;
  const daysDiff = getDaysDiff(eventDate, insuranceStartDate);

  return {
    // 가입일 전 3개월 이내 (고지의무 위반 핵심 구간)
    within3MonthsBefore: isBefore && isWithinMonths(eventDate, insuranceStartDate, 3),
    
    // 가입일 전 5년 이내 (과거력 검토 대상)
    within5YearsBefore: isBefore && isWithinYears(eventDate, insuranceStartDate, 5),
    
    // 가입일 후 3개월 이내 (면책 기간 관련)
    within3MonthsAfter: isAfter && isWithinMonths(eventDate, insuranceStartDate, 3),
    
    // 보험가입일과 동일
    isInsuranceStartDate: isSameDate,
    
    // 가입일 이전/이후 여부
    isBeforeInsurance: isBefore,
    isAfterInsurance: isAfter,
    
    // 일수 차이
    daysDiff: isBefore ? -daysDiff : daysDiff,
    
    // 위치 표시 (UI용)
    position: isSameDate ? 'start' : (isBefore ? 'before' : 'after')
  };
}

/**
 * 이벤트 배열에 보험가입일 기준 플래그 추가
 * @param {Array} events - 날짜 이벤트 배열
 * @param {string} insuranceStartDate - 보험가입일 (YYYY-MM-DD)
 * @returns {Array} 플래그가 추가된 이벤트 배열
 */
export function flagEventsByInsuranceDate(events, insuranceStartDate) {
  if (!insuranceStartDate || !events || events.length === 0) {
    return events;
  }

  // 각 이벤트에 플래그 추가
  const flaggedEvents = events.map(event => {
    const flags = createInsuranceFlags(event.date, insuranceStartDate);
    
    return {
      ...event,
      insuranceFlags: flags,
      // 경고 레벨 (UI 표시용)
      warningLevel: getWarningLevel(flags)
    };
  });

  // 보험가입일이 이벤트 목록에 없으면 추가
  const hasInsuranceStartEvent = flaggedEvents.some(
    e => e.date === insuranceStartDate
  );

  if (!hasInsuranceStartEvent) {
    flaggedEvents.push({
      date: insuranceStartDate,
      type: '보험가입일',
      context: '보험가입일 (사용자 입력)',
      source: 'user_input',
      insuranceFlags: {
        within3MonthsBefore: false,
        within5YearsBefore: false,
        within3MonthsAfter: false,
        isInsuranceStartDate: true,
        isBeforeInsurance: false,
        isAfterInsurance: false,
        daysDiff: 0,
        position: 'start'
      },
      warningLevel: 'info'
    });
  }

  // 날짜순 정렬
  flaggedEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  return flaggedEvents;
}

/**
 * 플래그 기반 경고 레벨 결정
 * @param {object} flags - 보험 플래그 객체
 * @returns {string} 'critical' | 'warning' | 'info' | 'normal'
 */
function getWarningLevel(flags) {
  if (flags.isInsuranceStartDate) return 'info';
  if (flags.within3MonthsBefore) return 'critical';  // 가입일 전 3개월: 고지의무 핵심
  if (flags.within3MonthsAfter) return 'warning';   // 가입일 후 3개월: 면책기간
  if (flags.within5YearsBefore) return 'warning';   // 가입일 전 5년: 과거력
  return 'normal';
}

/**
 * 여러 보험 가입일에 대한 플래그 생성 (복수 보험 가입 케이스)
 * @param {Array} events - 날짜 이벤트 배열
 * @param {Array} insuranceDates - 보험가입일 배열 [{date, company, product}]
 * @returns {Array} 플래그가 추가된 이벤트 배열
 */
export function flagEventsByMultipleInsuranceDates(events, insuranceDates) {
  if (!insuranceDates || insuranceDates.length === 0) {
    return events;
  }

  let result = [...events];

  // 각 보험가입일에 대해 플래그 추가
  insuranceDates.forEach((insurance, idx) => {
    const insuranceKey = `insurance_${idx + 1}`;
    
    result = result.map(event => {
      const flags = createInsuranceFlags(event.date, insurance.date);
      
      return {
        ...event,
        [`${insuranceKey}_flags`]: {
          ...flags,
          company: insurance.company || '',
          product: insurance.product || ''
        }
      };
    });

    // 보험가입일 이벤트 추가
    const hasThisInsuranceEvent = result.some(e => e.date === insurance.date);
    if (!hasThisInsuranceEvent) {
      result.push({
        date: insurance.date,
        type: '보험가입일',
        context: `${insurance.company || ''} ${insurance.product || ''}`.trim() || '보험가입일',
        source: 'user_input',
        [`${insuranceKey}_flags`]: {
          isInsuranceStartDate: true,
          company: insurance.company || '',
          product: insurance.product || ''
        },
        warningLevel: 'info'
      });
    }
  });

  // 날짜순 정렬
  result.sort((a, b) => new Date(a.date) - new Date(b.date));

  return result;
}

/**
 * 플래그 요약 통계 생성
 * @param {Array} flaggedEvents - 플래그가 추가된 이벤트 배열
 * @returns {object} 요약 통계
 */
export function summarizeInsuranceFlags(flaggedEvents) {
  const summary = {
    total: flaggedEvents.length,
    within3MonthsBefore: 0,
    within5YearsBefore: 0,
    within3MonthsAfter: 0,
    beforeInsurance: 0,
    afterInsurance: 0,
    criticalEvents: [],
    warningEvents: []
  };

  flaggedEvents.forEach(event => {
    const flags = event.insuranceFlags;
    if (!flags) return;

    if (flags.within3MonthsBefore) {
      summary.within3MonthsBefore++;
      summary.criticalEvents.push(event);
    }
    if (flags.within5YearsBefore) summary.within5YearsBefore++;
    if (flags.within3MonthsAfter) {
      summary.within3MonthsAfter++;
      summary.warningEvents.push(event);
    }
    if (flags.isBeforeInsurance) summary.beforeInsurance++;
    if (flags.isAfterInsurance) summary.afterInsurance++;
  });

  return summary;
}

export default {
  createInsuranceFlags,
  flagEventsByInsuranceDate,
  flagEventsByMultipleInsuranceDates,
  summarizeInsuranceFlags,
  isWithinMonths,
  isWithinYears
};
