/**
 * Event Scoring Engine (T04)
 * 
 * 목적:
 * - 이벤트별 중요도 점수를 계산하여 Core 이벤트 후보 선정
 * - A-B-C 계획의 "A. Report 이벤트 Recall 극대화" 지원
 * 
 * 점수 구성:
 * - Severity Score (0-40점): 수술/입원 > 중대검사 > 응급 > 외래
 * - Period Score (0-30점): 가입 전 3개월 > 2년 > 5년
 * - Relevance Score (0-20점): 청구병명 관련도
 * - Frequency Score (0-10점): 반복 횟수 기반
 * 
 * @module postprocess/eventScoringEngine
 */

import { logService } from '../utils/logger.js';

// 이벤트 타입별 중요도 점수
const SEVERITY_SCORES = {
  // 고위험 (40점)
  '수술': 40,
  '입원': 40,
  'surgery': 40,
  'hospitalization': 40,
  'admission': 40,
  
  // 중위험 (30점)
  '중대검사': 30,
  '조직검사': 30,
  'CT': 30,
  'MRI': 30,
  'PET': 30,
  'biopsy': 30,
  
  // 응급 (25점)
  '응급': 25,
  '응급실': 25,
  'emergency': 25,
  'ER': 25,
  
  // 외래/기타 (10점)
  '외래': 10,
  '진료': 10,
  '검사': 15,
  'outpatient': 10,
  'examination': 15,
};

// 기간별 점수 (가입일 기준)
const PERIOD_SCORES = {
  '3m': 30,  // 3개월 이내
  '2y': 20,  // 2년 이내
  '5y': 10,  // 5년 이내
  'over5y': 5, // 5년 초과
};

// 청구병명 관련도 점수
const RELEVANCE_SCORES = {
  exact: 20,      // 완전 일치
  related: 15,    // 관련 질환
  sameSystem: 10, // 동일 계통
  none: 0,        // 무관
};

// 반복 횟수별 점수
const FREQUENCY_SCORES = {
  high: 10,    // 5회 이상
  medium: 7,   // 3-4회
  low: 5,      // 1-2회
};

class EventScoringEngine {
  constructor() {
    this.enrollmentDate = null;
    this.claimDiagnosis = null;
    this.diagnosisSystemMap = new Map();
    this.initDiagnosisSystemMap();
  }

  /**
   * 진단 계통 매핑 초기화 (ICD-10 기준)
   */
  initDiagnosisSystemMap() {
    // 순환계 질환
    ['I00-I99', 'I10', 'I20', 'I21', 'I25', 'I50'].forEach(code => {
      this.diagnosisSystemMap.set(code.split('-')[0], 'circulatory');
    });
    
    // 신생물/종양
    ['C00-C99', 'D00-D09'].forEach(code => {
      this.diagnosisSystemMap.set(code.split('-')[0], 'neoplasm');
    });
    
    // 신경계
    ['G00-G99', 'I60', 'I61', 'I62', 'I63', 'I64', 'I69'].forEach(code => {
      this.diagnosisSystemMap.set(code.split('-')[0], 'nervous');
    });
    
    // 소화계
    ['K00-K99'].forEach(code => {
      this.diagnosisSystemMap.set(code.split('-')[0], 'digestive');
    });
    
    // 근골격계
    ['M00-M99'].forEach(code => {
      this.diagnosisSystemMap.set(code.split('-')[0], 'musculoskeletal');
    });
    
    // 내분비계
    ['E00-E99'].forEach(code => {
      this.diagnosisSystemMap.set(code.split('-')[0], 'endocrine');
    });
  }

  /**
   * 이벤트 점수 계산
   * @param {Object} event - 의료 이벤트
   * @param {Object} patientInfo - 환자 정보 (enrollmentDate 포함)
   * @param {Object} claimInfo - 청구 정보 (claimDiagnosis 포함)
   * @returns {Object} 점수 정보
   */
  calculateScore(event, patientInfo = {}, claimInfo = {}) {
    this.enrollmentDate = patientInfo.enrollmentDate
        || patientInfo.insuranceJoinDate
        || patientInfo.contractDate
        || patientInfo.joinDate;
    this.claimDiagnosis = claimInfo.claimDiagnosis || claimInfo.diagnosis;
    
    // 1. Severity Score (0-40점)
    const severityScore = this.getSeverityScore(event);
    
    // 2. Period Score (0-30점)
    const periodScore = this.getPeriodScore(event, patientInfo);
    
    // 3. Relevance Score (0-20점)
    const relevanceScore = this.getRelevanceScore(event, claimInfo);
    
    // 4. Frequency Score (0-10점)
    const frequencyScore = this.getFrequencyScore(event);
    
    const totalScore = severityScore + periodScore + relevanceScore + frequencyScore;
    
    return {
      totalScore,
      breakdown: {
        severityScore,
        periodScore,
        relevanceScore,
        frequencyScore,
      },
      tier: this.determineTier(totalScore),
      isCore: totalScore >= 40, // 40점 이상이면 Core 이벤트 (가입 전 검사도 포함)
    };
  }

  /**
   * Severity Score 계산 (0-40점)
   */
  getSeverityScore(event) {
    const eventType = event.eventType || event.type || '';
    const procedures = event.procedures || [];
    
    // 이벤트 타입으로 먼저 점수 확인
    for (const [key, score] of Object.entries(SEVERITY_SCORES)) {
      if (eventType.includes(key) || eventType.toLowerCase().includes(key.toLowerCase())) {
        return score;
      }
    }
    
    // 시술/검사 목록에서 확인
    for (const proc of procedures) {
      const procName = proc.name || proc;
      for (const [key, score] of Object.entries(SEVERITY_SCORES)) {
        if (procName.includes(key) || procName.toLowerCase().includes(key.toLowerCase())) {
          return score;
        }
      }
    }
    
    // 진단명에서 힌트 확인
    const diagnosis = event.diagnosis?.name || '';
    if (diagnosis.includes('암') || diagnosis.includes('악성') || diagnosis.includes('종양')) {
      return 40;
    }
    
    // 기본값
    return 10;
  }

  /**
   * Period Score 계산 (0-30점)
   */
  getPeriodScore(event, patientInfo) {
    const eventDate = this.parseDate(event.date);
    const enrollmentDate = this.parseDate(
      patientInfo.enrollmentDate || patientInfo.insuranceJoinDate || patientInfo.contractDate || patientInfo.joinDate
    );
    
    if (!eventDate || !enrollmentDate) {
      return 0;
    }
    
    // 가입 전 기간 계산 (일 단위)
    const diffDays = (enrollmentDate - eventDate) / (1000 * 60 * 60 * 24);
    
    if (diffDays < 0) {
      // 가입 후 이벤트
      return 0;
    }
    
    if (diffDays <= 90) { // 3개월 이내
      return PERIOD_SCORES['3m'];
    } else if (diffDays <= 730) { // 2년 이내
      return PERIOD_SCORES['2y'];
    } else if (diffDays <= 1825) { // 5년 이내
      return PERIOD_SCORES['5y'];
    } else {
      return PERIOD_SCORES['over5y'];
    }
  }

  /**
   * Relevance Score 계산 (0-20점)
   */
  getRelevanceScore(event, claimInfo) {
    const eventDiagnosis = event.diagnosis?.name || '';
    const eventCode = event.diagnosis?.code || '';
    const claimDiagnosis = claimInfo.claimDiagnosis || claimInfo.diagnosis || '';
    const claimCode = claimInfo.claimCode || '';
    
    if (!eventDiagnosis && !eventCode) {
      return 0;
    }
    
    // 완전 일치
    if (claimDiagnosis && eventDiagnosis.includes(claimDiagnosis)) {
      return RELEVANCE_SCORES.exact;
    }
    if (claimCode && eventCode.startsWith(claimCode.substring(0, 3))) {
      return RELEVANCE_SCORES.exact;
    }
    
    // 동일 계통 확인
    const eventSystem = this.getSystem(eventCode);
    const claimSystem = this.getSystem(claimCode);
    
    if (eventSystem && claimSystem && eventSystem === claimSystem) {
      return RELEVANCE_SCORES.sameSystem;
    }
    
    // 관련 키워드 확인
    const relatedKeywords = this.getRelatedKeywords(claimDiagnosis);
    for (const keyword of relatedKeywords) {
      if (eventDiagnosis.includes(keyword)) {
        return RELEVANCE_SCORES.related;
      }
    }
    
    return RELEVANCE_SCORES.none;
  }

  /**
   * Frequency Score 계산 (0-10점)
   */
  getFrequencyScore(event) {
    const frequency = event.frequency || event.visitCount || 1;
    
    if (frequency >= 5) {
      return FREQUENCY_SCORES.high;
    } else if (frequency >= 3) {
      return FREQUENCY_SCORES.medium;
    } else {
      return FREQUENCY_SCORES.low;
    }
  }

  /**
   * 진단 코드의 계통 확인
   */
  getSystem(code) {
    if (!code) return null;
    const prefix = code.charAt(0).toUpperCase();
    return this.diagnosisSystemMap.get(prefix) || null;
  }

  /**
   * 관련 키워드 추출
   */
  getRelatedKeywords(diagnosis) {
    if (!diagnosis) return [];
    
    const keywords = [];
    
    // 암 관련
    if (diagnosis.includes('암') || diagnosis.includes('악성')) {
      keywords.push('종양', '신생물', '전이', '항암');
    }
    
    // 심장 관련
    if (diagnosis.includes('심') || diagnosis.includes('heart')) {
      keywords.push('협심증', '심근경색', '관상동맥', '부정맥', '심부전');
    }
    
    // 뇌혈관 관련
    if (diagnosis.includes('뇌') || diagnosis.includes('stroke')) {
      keywords.push('뇌졸중', '뇌경색', '뇌출혈', '혈관');
    }
    
    // 당뇨 관련
    if (diagnosis.includes('당뇨')) {
      keywords.push('혈당', '인슐린', '합병증');
    }
    
    return keywords;
  }

  /**
   * 날짜 파싱
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    // YYYY-MM-DD 형식
    const match = String(dateStr).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    return null;
  }

  /**
   * 점수 기반 Tier 결정
   */
  determineTier(score) {
    if (score >= 70) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * 이벤트 배열에 점수 할당
   * @param {Array} events - 의료 이벤트 배열
   * @param {Object} patientInfo - 환자 정보
   * @param {Object} claimInfo - 청구 정보
   * @returns {Array} 점수가 할당된 이벤트 배열
   */
  scoreEvents(events, patientInfo = {}, claimInfo = {}) {
    logService.info(`[EventScoringEngine] ${events.length}개 이벤트 점수 계산 시작`);
    
    const scoredEvents = events.map(event => {
      const scoreInfo = this.calculateScore(event, patientInfo, claimInfo);
      return {
        ...event,
        score: scoreInfo.totalScore,
        scoreBreakdown: scoreInfo.breakdown,
        tier: scoreInfo.tier,
        isCore: scoreInfo.isCore,
      };
    });
    
    // 점수 기준 정렬 (내림차순)
    scoredEvents.sort((a, b) => b.score - a.score);
    
    const coreCount = scoredEvents.filter(e => e.isCore).length;
    logService.info(`[EventScoringEngine] 점수 계산 완료 - Core 이벤트: ${coreCount}개`);
    
    return scoredEvents;
  }

  /**
   * 상위 K개 이벤트 선택
   */
  getTopKEvents(events, k = 10) {
    const scored = this.scoreEvents(events);
    return scored.slice(0, k);
  }
}

// Singleton export
const eventScoringEngine = new EventScoringEngine();
export default eventScoringEngine;

// Named export
export { EventScoringEngine };
