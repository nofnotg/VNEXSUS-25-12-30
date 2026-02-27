/**
 * Critical Risk Rules Engine (T05)
 * 
 * 목적:
 * - 고위험 이벤트는 점수와 무관하게 항상 Core 레이어에 포함
 * - A-B-C 계획의 "B. 고위험 이벤트 Recall 보장" 지원
 * - Critical Risk Recall 95%+ 달성 목표
 * 
 * 절대규칙 대상:
 * - 종양/암 (ALL 기간)
 * - 심혈관 (ALL 기간)
 * - 뇌혈관 (ALL 기간)
 * - 입원/수술 (가입 전 5년)
 * - 중대검사 (가입 전 3개월)
 * 
 * @module postprocess/criticalRiskRules
 */

import { logService } from '../utils/logger.js';

// 종양/암 관련 절대규칙
const TUMOR_RULES = {
  keywords: ['암', '종양', '악성', '신생물', 'cancer', 'malignancy', '악성신생물', '전이', '림프종', '백혈병', '육종'],
  icdPrefixes: ['C', 'D0', 'D1', 'D2', 'D3', 'D4'],
  priority: 'CRITICAL',
  forceInclude: true,
  periodLimit: null, // ALL 기간
  category: 'tumor',
  label: '종양/암',
};

// 심혈관 관련 절대규칙
const CARDIOVASCULAR_RULES = {
  keywords: ['심근경색', '협심증', '관상동맥', 'MI', 'CAD', 'PCI', '스텐트', '심부전', '심장', '부정맥', '심근', '심막', '대동맥'],
  icdPrefixes: ['I20', 'I21', 'I22', 'I23', 'I24', 'I25', 'I30', 'I40', 'I42', 'I44', 'I45', 'I46', 'I47', 'I48', 'I49', 'I50'],
  procedures: ['CAG', 'PCI', 'CABG', '관상동맥조영술', '스텐트삽입술', '심장수술'],
  priority: 'CRITICAL',
  forceInclude: true,
  periodLimit: null, // ALL 기간
  category: 'cardiovascular',
  label: '심혈관',
};

// 뇌혈관 관련 절대규칙
const CEREBROVASCULAR_RULES = {
  keywords: ['뇌졸중', '뇌출혈', '뇌경색', 'stroke', 'CVA', '뇌혈관', '뇌동맥', '지주막하', '경막외', '경막하'],
  icdPrefixes: ['I60', 'I61', 'I62', 'I63', 'I64', 'I65', 'I66', 'I67', 'I68', 'I69', 'G45', 'G46'],
  exams: ['뇌CT', '뇌MRI', 'Brain CT', 'Brain MRI', 'MRA', '뇌혈관조영술'],
  priority: 'CRITICAL',
  forceInclude: true,
  periodLimit: null, // ALL 기간
  category: 'cerebrovascular',
  label: '뇌혈관',
};

// 입원/수술 절대규칙 (가입 전 5년)
const ADMISSION_SURGERY_RULES = {
  eventTypes: ['입원', '수술', 'hospitalization', 'surgery', 'admission', 'operation'],
  keywords: ['입원', '수술', '시술', '절제', '절개', '봉합', '이식'],
  priority: 'HIGH',
  forceInclude: true,
  periodLimit: '5Y', // 가입 전 5년
  category: 'admissionSurgery',
  label: '입원/수술',
};

// 중대검사 절대규칙 (가입 전 3개월)
const MAJOR_EXAM_RULES = {
  keywords: ['CT', 'MRI', '조직검사', 'Biopsy', 'PET', '내시경', '초음파', '혈관조영술', '골수검사'],
  exams: ['CT', 'MRI', 'PET-CT', '조직검사', '골수검사', '혈관조영술', '내시경'],
  priority: 'HIGH',
  forceInclude: true,
  periodLimit: '3M', // 가입 전 3개월
  category: 'majorExam',
  label: '중대검사',
};

// 모든 절대규칙 패턴
const CRITICAL_RISK_PATTERNS = {
  tumor: TUMOR_RULES,
  cardiovascular: CARDIOVASCULAR_RULES,
  cerebrovascular: CEREBROVASCULAR_RULES,
  admissionSurgery: ADMISSION_SURGERY_RULES,
  majorExam: MAJOR_EXAM_RULES,
};

class CriticalRiskEngine {
  constructor() {
    this.patterns = CRITICAL_RISK_PATTERNS;
    this.enrollmentDate = null;
  }

  /**
   * 이벤트의 Critical Risk 평가
   * @param {Object} event - 의료 이벤트
   * @param {Object} patientInfo - 환자 정보 (가입일 포함)
   * @returns {Object} Critical Risk 평가 결과
   */
  evaluateCriticalRisk(event, patientInfo = {}) {
    this.enrollmentDate = this.parseDate(
      patientInfo.enrollmentDate || patientInfo.insuranceJoinDate || patientInfo.contractDate || patientInfo.joinDate
    );
    
    for (const [category, rules] of Object.entries(this.patterns)) {
      if (this.matchesCriticalPattern(event, rules)) {
        // 기간 제한 확인
        if (rules.periodLimit && !this.isWithinPeriodLimit(event, rules.periodLimit)) {
          continue;
        }
        
        return {
          isCritical: true,
          category,
          label: rules.label,
          priority: rules.priority,
          forceInclude: rules.forceInclude,
          matchedRules: this.getMatchedRules(event, rules),
        };
      }
    }
    
    return {
      isCritical: false,
      category: null,
      label: null,
      priority: null,
      forceInclude: false,
      matchedRules: [],
    };
  }

  /**
   * 이벤트가 절대규칙 패턴에 매칭되는지 확인
   */
  matchesCriticalPattern(event, rules) {
    // 키워드 매칭
    if (rules.keywords && this.matchesKeywords(event, rules.keywords)) {
      return true;
    }
    
    // ICD 코드 프리픽스 매칭
    if (rules.icdPrefixes && this.matchesICDPrefix(event, rules.icdPrefixes)) {
      return true;
    }
    
    // 시술/검사 매칭
    if (rules.procedures && this.matchesProcedures(event, rules.procedures)) {
      return true;
    }
    if (rules.exams && this.matchesExams(event, rules.exams)) {
      return true;
    }
    
    // 이벤트 타입 매칭
    if (rules.eventTypes && rules.eventTypes.some(type => {
      const eventType = (event.eventType || event.type || '').toLowerCase();
      return eventType.includes(type.toLowerCase());
    })) {
      return true;
    }
    
    return false;
  }

  /**
   * 키워드 매칭
   */
  matchesKeywords(event, keywords) {
    const searchText = [
      event.diagnosis?.name || '',
      event.hospital || '',
      event.eventType || event.type || '',
      ...(event.procedures || []).map(p => p.name || p),
      event.description || '',
    ].join(' ').toLowerCase();
    
    return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
  }

  /**
   * ICD 코드 프리픽스 매칭
   */
  matchesICDPrefix(event, prefixes) {
    const code = (event.diagnosis?.code || '').toUpperCase();
    if (!code) return false;
    
    return prefixes.some(prefix => code.startsWith(prefix.toUpperCase()));
  }

  /**
   * 시술 매칭
   */
  matchesProcedures(event, procedures) {
    const eventProcedures = event.procedures || [];
    
    return eventProcedures.some(proc => {
      const procName = (proc.name || proc).toLowerCase();
      return procedures.some(p => procName.includes(p.toLowerCase()));
    });
  }

  /**
   * 검사 매칭
   */
  matchesExams(event, exams) {
    const searchText = [
      event.eventType || event.type || '',
      ...(event.procedures || []).map(p => p.name || p),
      event.description || '',
    ].join(' ').toLowerCase();
    
    return exams.some(exam => searchText.includes(exam.toLowerCase()));
  }

  /**
   * 기간 제한 확인
   */
  isWithinPeriodLimit(event, periodLimit) {
    if (!this.enrollmentDate) return true; // 가입일 없으면 통과
    
    const eventDate = this.parseDate(event.date);
    if (!eventDate) return true; // 날짜 없으면 통과
    
    // 가입 전 이벤트만 해당
    if (eventDate >= this.enrollmentDate) return false;
    
    const diffDays = (this.enrollmentDate - eventDate) / (1000 * 60 * 60 * 24);
    
    switch (periodLimit) {
      case '3M':
        return diffDays <= 90;
      case '2Y':
        return diffDays <= 730;
      case '5Y':
        return diffDays <= 1825;
      default:
        return true;
    }
  }

  /**
   * 매칭된 규칙 목록 반환
   */
  getMatchedRules(event, rules) {
    const matched = [];
    
    if (rules.keywords && this.matchesKeywords(event, rules.keywords)) {
      matched.push({ type: 'keyword', rule: 'keywords' });
    }
    
    if (rules.icdPrefixes && this.matchesICDPrefix(event, rules.icdPrefixes)) {
      matched.push({ type: 'icd', rule: 'icdPrefixes', code: event.diagnosis?.code });
    }
    
    if (rules.procedures && this.matchesProcedures(event, rules.procedures)) {
      matched.push({ type: 'procedure', rule: 'procedures' });
    }
    
    if (rules.exams && this.matchesExams(event, rules.exams)) {
      matched.push({ type: 'exam', rule: 'exams' });
    }
    
    return matched;
  }

  /**
   * 날짜 파싱
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    const match = String(dateStr).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    return null;
  }

  /**
   * 이벤트 배열에 Critical Risk 정보 추가
   * @param {Array} events - 의료 이벤트 배열
   * @param {Object} patientInfo - 환자 정보
   * @returns {Array} Critical Risk 정보가 추가된 이벤트 배열
   */
  evaluateEvents(events, patientInfo = {}) {
    logService.info(`[CriticalRiskEngine] ${events.length}개 이벤트 절대규칙 평가 시작`);
    
    let criticalCount = 0;
    
    const evaluatedEvents = events.map(event => {
      const riskInfo = this.evaluateCriticalRisk(event, patientInfo);
      
      if (riskInfo.isCritical) {
        criticalCount++;
      }
      
      return {
        ...event,
        criticalRisk: riskInfo,
        isCore: event.isCore || riskInfo.forceInclude, // 기존 Core 또는 절대규칙
      };
    });
    
    logService.info(`[CriticalRiskEngine] 평가 완료 - Critical 이벤트: ${criticalCount}개`);
    
    return evaluatedEvents;
  }

  /**
   * Critical 이벤트만 필터링
   */
  getCriticalEvents(events, patientInfo = {}) {
    const evaluated = this.evaluateEvents(events, patientInfo);
    return evaluated.filter(e => e.criticalRisk?.isCritical);
  }

  /**
   * 카테고리별 Critical 이벤트 그룹화
   */
  groupCriticalEventsByCategory(events, patientInfo = {}) {
    const evaluated = this.evaluateEvents(events, patientInfo);
    const critical = evaluated.filter(e => e.criticalRisk?.isCritical);
    
    const groups = {};
    
    critical.forEach(event => {
      const category = event.criticalRisk.category;
      if (!groups[category]) {
        groups[category] = {
          category,
          label: event.criticalRisk.label,
          events: [],
        };
      }
      groups[category].events.push(event);
    });
    
    return groups;
  }

  /**
   * Critical Risk 통계
   */
  getStatistics(events, patientInfo = {}) {
    const evaluated = this.evaluateEvents(events, patientInfo);
    const critical = evaluated.filter(e => e.criticalRisk?.isCritical);
    
    const byCategory = {};
    critical.forEach(event => {
      const category = event.criticalRisk.category;
      byCategory[category] = (byCategory[category] || 0) + 1;
    });
    
    return {
      totalEvents: events.length,
      criticalEvents: critical.length,
      criticalRate: events.length > 0 ? (critical.length / events.length * 100).toFixed(1) : 0,
      byCategory,
    };
  }
}

// Singleton export
const criticalRiskEngine = new CriticalRiskEngine();
export default criticalRiskEngine;

// Named export
export { CriticalRiskEngine, CRITICAL_RISK_PATTERNS };
