/**
 * Insurance Period Processor Service
 *
 * 보험기간 처리 및 선후관계 분석 서비스
 *
 * 핵심 비즈니스 로직:
 * - 보험 시작일만 중요 (만기일은 중요하지 않음)
 * - 사건 발생일과 보험 가입일의 선후관계 판단
 * - 사건 발생일 >= 보험 가입일 → 보상 가능
 * - 사건 발생일 < 보험 가입일 → 보상 불가 (기왕증)
 */

/**
 * 날짜 정규화
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // YYYY-MM-DDThh:mm:ss → YYYY-MM-DD
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0];
  }

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
 * Insurance Period Processor 클래스
 */
export class InsurancePeriodProcessor {
  /**
   * OCR 블록에서 보험기간 추출 (시작일만 반환)
   *
   * @param {Array} ocrBlocks - OCR 블록 배열
   * @returns {Array} 보험기간 배열 (시작일만 포함)
   */
  extractInsurancePeriods(ocrBlocks) {
    const periods = [];

    // 패턴 1: "보험기간: 2020.10.15 ~ 2025.10.15" 형식
    const periodPattern = /보험기간\s*:?\s*(\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2})\s*[~\-–—]\s*(\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2})/;

    // 패턴 2: "가입일", "계약일", "보장개시일"
    const startPattern = /(?:가입일|계약일|보장개시일)\s*:?\s*(\d{4}[\.\/-]\d{1,2}[\.\/-]\d{1,2})/;

    ocrBlocks.forEach(block => {
      const text = block.text || block.context || '';

      // 보험기간 패턴 매칭
      const periodMatch = text.match(periodPattern);
      if (periodMatch) {
        const startDate = normalizeDate(periodMatch[1]);
        // 종료일(만기일)은 무시 - 보험 심사에 불필요

        if (startDate) {
          periods.push({
            startDate: startDate,
            // endDate는 포함하지 않음 (만기일은 심사에 무관)
            type: 'insurance_start',
            context: text,
            importance: 'critical',  // 시작일은 핵심 정보
            score: 95,
            company: this._extractCompanyName(text),
            source: 'period_pattern'
          });
        }
      }

      // 가입일 단독 패턴 매칭
      const startMatch = text.match(startPattern);
      if (startMatch && !periodMatch) {  // 보험기간 패턴과 중복 방지
        const startDate = normalizeDate(startMatch[1]);

        if (startDate) {
          periods.push({
            startDate: startDate,
            type: 'insurance_start',
            context: text,
            importance: 'critical',
            score: 95,
            company: this._extractCompanyName(text),
            source: 'start_pattern'
          });
        }
      }
    });

    return periods;
  }

  /**
   * 보험사명 추출
   * @private
   */
  _extractCompanyName(text) {
    const companies = [
      '농협손해보험', 'NH농협', 'KB손해보험', '삼성화재', '현대해상',
      'AXA손해보험', 'DB손해보험', '메리츠화재', '한화손해보험',
      'MG손해보험', '롯데손해보험'
    ];

    for (const company of companies) {
      if (text.includes(company)) {
        return company;
      }
    }

    return null;
  }

  /**
   * 날짜 배열에서 보험 시작일 필터링
   *
   * @param {Array} dates - 날짜 배열
   * @returns {Array} 보험 시작일만 포함된 배열
   */
  filterInsuranceStartDates(dates) {
    return dates.filter(d => {
      const context = d.context || '';
      const type = d.type || '';

      // 명시적으로 보험 시작일인 경우
      if (type.includes('보험가입') || type.includes('보장개시') || type.includes('계약일')) {
        return true;
      }

      // 컨텍스트에 보험 관련 키워드 + 시작 관련 키워드
      const isInsuranceContext = /보험기간|가입일|계약일|보장개시/.test(context);
      const isNotEndDate = !/만기일|종료일|갱신일/.test(context);

      return isInsuranceContext && isNotEndDate;
    });
  }

  /**
   * 사건과 보험가입일 선후관계 분석
   *
   * @param {string} eventDate - 의료 사건 발생일 (YYYY-MM-DD)
   * @param {Array} insuranceStartDates - 보험 가입일 배열
   * @returns {object} 보상 가능 여부 및 이유
   */
  analyzeCoverageEligibility(eventDate, insuranceStartDates) {
    const normalizedEventDate = normalizeDate(eventDate);
    if (!normalizedEventDate) {
      return {
        eligible: null,
        reason: '사건 발생일 정보 없음',
        policies: []
      };
    }

    if (!insuranceStartDates || insuranceStartDates.length === 0) {
      return {
        eligible: null,
        reason: '보험 가입일 정보 없음',
        policies: []
      };
    }

    const eventDateObj = new Date(normalizedEventDate);

    // 보험 가입일 이후에 발생한 사건인지 확인
    const eligiblePolicies = insuranceStartDates.filter(policy => {
      const startDate = normalizeDate(policy.startDate);
      if (!startDate) return false;

      const startDateObj = new Date(startDate);

      // 사건 발생일 >= 보험 가입일 → 보상 가능
      return eventDateObj >= startDateObj;
    });

    // 가장 최근 가입일 (사건 이전)
    const mostRecentPolicy = eligiblePolicies.sort((a, b) => {
      return new Date(normalizeDate(b.startDate)) - new Date(normalizeDate(a.startDate));
    })[0];

    return {
      eligible: eligiblePolicies.length > 0,
      reason: eligiblePolicies.length > 0
        ? `보험 가입일(${normalizeDate(mostRecentPolicy.startDate)}) 이후 사건 발생 → 보상 가능`
        : `보험 가입 전 사건 발생 → 기왕증 가능성 (보상 불가)`,
      policies: eligiblePolicies,
      mostRecentPolicy: mostRecentPolicy || null,
      allPolicies: insuranceStartDates
    };
  }

  /**
   * 날짜 배열에서 보험 만기일 제거
   *
   * @param {Array} dates - 날짜 배열
   * @returns {Array} 만기일이 제거된 배열
   */
  removeInsuranceEndDates(dates) {
    return dates.filter(d => {
      const context = d.context || '';
      const type = d.type || '';

      // 명시적으로 만기일인 경우 제거
      if (type.includes('만기일') || type.includes('종료일')) {
        return false;
      }

      // 컨텍스트에 만기일 키워드가 있으면 제거
      if (/만기일|종료일/.test(context)) {
        return false;
      }

      return true;
    });
  }

  /**
   * 보험 관련 날짜 스코어 조정
   *
   * @param {Array} dates - 날짜 배열
   * @returns {Array} 스코어가 조정된 배열
   */
  adjustInsuranceScores(dates) {
    return dates.map(d => {
      const context = d.context || '';
      const type = d.type || '';

      // 보험 시작일 스코어 상향
      if (type.includes('보험가입') || type.includes('보장개시') || type.includes('계약일')) {
        return {
          ...d,
          score: (d.score || 50) * 1.5,  // 50% 증가
          importance: 'critical',
          adjustReason: '보험 시작일 - 핵심 정보'
        };
      }

      // 보험 만기일 스코어 하향
      if (type.includes('만기일') || type.includes('종료일')) {
        return {
          ...d,
          score: (d.score || 50) * 0.1,  // 90% 감소
          importance: 'low',
          adjustReason: '보험 만기일 - 심사 무관'
        };
      }

      // 보험 컨텍스트에서 시작일 추정
      if (/보험기간/.test(context) && !/만기일|종료일/.test(context)) {
        return {
          ...d,
          score: (d.score || 50) * 1.3,
          importance: 'high',
          adjustReason: '보험기간 컨텍스트 - 시작일 가능성'
        };
      }

      return d;
    });
  }

  /**
   * 종합 처리: 보험기간 추출 + 만기일 제거 + 스코어 조정
   *
   * @param {Array} dates - 날짜 배열
   * @returns {object} { processed: Array, stats: object }
   */
  process(dates) {
    const stats = {
      totalDates: dates.length,
      insuranceStartDates: 0,
      insuranceEndDatesRemoved: 0,
      scoresAdjusted: 0
    };

    // 1단계: 보험 시작일 필터링
    const startDates = this.filterInsuranceStartDates(dates);
    stats.insuranceStartDates = startDates.length;

    // 2단계: 만기일 제거
    const withoutEndDates = this.removeInsuranceEndDates(dates);
    stats.insuranceEndDatesRemoved = dates.length - withoutEndDates.length;

    // 3단계: 스코어 조정
    const adjusted = this.adjustInsuranceScores(withoutEndDates);
    stats.scoresAdjusted = adjusted.filter(d => d.adjustReason).length;

    return {
      processed: adjusted,
      stats,
      insuranceStartDates: startDates
    };
  }
}

/**
 * 팩토리 함수
 */
export function createInsurancePeriodProcessor() {
  return new InsurancePeriodProcessor();
}

export default InsurancePeriodProcessor;
