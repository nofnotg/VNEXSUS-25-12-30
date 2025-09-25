/**
 * Timeline Intelligence Engine - 의료-보험 통합 시계열 분석 시스템
 * 
 * 혁신적 특징:
 * 1. 보험 심사 관점에서 최적화된 시계열 분석
 * 2. 이벤트 간 인과관계 및 연관성 자동 추론
 * 3. 중요도 기반 적응형 타임라인 생성
 */

import { MedicalEvent, EventType, DiagnosisInfo } from './hybridNER';
import { SmartChunk } from './smartChunker';

export interface TimelineEvent extends MedicalEvent {
  timelinePosition: number;
  relatedEvents: string[]; // 관련 이벤트 ID들
  causalRelations: CausalRelation[];
  insuranceImpact: InsuranceImpact;
  riskFactors: RiskFactor[];
  progressionStage: 'INITIAL' | 'PROGRESSION' | 'TREATMENT' | 'RECOVERY' | 'COMPLICATION';
}

export interface CausalRelation {
  targetEventId: string;
  relationType: 'CAUSES' | 'TRIGGERED_BY' | 'RELATED_TO' | 'FOLLOWS' | 'COMPLICATES';
  confidence: number;
  evidence: string;
}

export interface InsuranceImpact {
  claimRelevance: number; // 0-1
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  coverageCategory: string;
  exclusionRisk: number; // 면책 가능성
  preExistingCondition: boolean;
  waitingPeriodImpact: boolean;
}

export interface RiskFactor {
  factor: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  category: 'MEDICAL' | 'BEHAVIORAL' | 'ENVIRONMENTAL' | 'GENETIC';
  impact: string;
}

export interface TimelineAnalysis {
  events: TimelineEvent[];
  summary: TimelineSummary;
  riskAssessment: RiskAssessment;
  insuranceRecommendations: InsuranceRecommendation[];
  qualityMetrics: QualityMetrics;
}

export interface TimelineSummary {
  totalEvents: number;
  dateRange: { start: string; end: string };
  majorDiagnoses: DiagnosisInfo[];
  keyInstitutions: string[];
  treatmentProgression: string[];
  criticalEvents: TimelineEvent[];
}

export interface RiskAssessment {
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: RiskFactor[];
  preExistingConditions: string[];
  progressionPattern: 'STABLE' | 'IMPROVING' | 'WORSENING' | 'FLUCTUATING';
  complicationRisk: number;
}

export interface InsuranceRecommendation {
  type: 'APPROVAL' | 'REVIEW' | 'INVESTIGATION' | 'DENIAL';
  reason: string;
  evidence: string[];
  confidence: number;
  additionalInfo: string;
}

export interface QualityMetrics {
  completeness: number; // 정보 완성도
  consistency: number; // 일관성
  reliability: number; // 신뢰도
  coverage: number; // 커버리지
}

export interface TimelineConfig {
  claimDate: string;
  insuranceType: 'HEALTH' | 'LIFE' | 'DISABILITY' | 'ACCIDENT';
  lookbackPeriod: number; // 조회 기간 (일)
  riskThreshold: number;
  includeMinorEvents: boolean;
}

export class TimelineEngine {
  private config: TimelineConfig;
  
  // 질환별 진행 패턴
  private readonly DISEASE_PROGRESSIONS = {
    'C': { // 암
      stages: ['INITIAL', 'PROGRESSION', 'TREATMENT', 'RECOVERY'],
      riskLevel: 'CRITICAL',
      typicalProgression: ['진단', '병기결정', '치료계획', '수술/항암', '경과관찰']
    },
    'I21': { // 심근경색
      stages: ['INITIAL', 'TREATMENT', 'RECOVERY'],
      riskLevel: 'CRITICAL',
      typicalProgression: ['응급실', '심도자술', '입원치료', '재활', '외래추적']
    },
    'I63': { // 뇌경색
      stages: ['INITIAL', 'TREATMENT', 'RECOVERY'],
      riskLevel: 'CRITICAL',
      typicalProgression: ['응급실', '영상검사', '혈전용해', '입원치료', '재활']
    },
    'E11': { // 당뇨병
      stages: ['INITIAL', 'PROGRESSION', 'TREATMENT'],
      riskLevel: 'HIGH',
      typicalProgression: ['진단', '약물치료', '생활습관개선', '합병증검사', '지속관리']
    }
  };

  // 보험 관련 키워드 매핑
  private readonly INSURANCE_KEYWORDS = {
    EXCLUSION_RISK: ['선천성', '유전성', '자해', '음주', '약물남용'],
    WAITING_PERIOD: ['정신질환', '치매', '파킨슨', '뇌전증'],
    HIGH_CLAIM: ['암', '심장', '뇌혈관', '간경화', '신부전'],
    PRE_EXISTING: ['기왕력', '과거력', '가족력', '유전', '선천']
  };

  // 인과관계 추론 패턴
  private readonly CAUSAL_PATTERNS = [
    {
      pattern: /(합병증|부작용|후유증)/,
      relation: 'COMPLICATES',
      confidence: 0.8
    },
    {
      pattern: /(원인|유발|악화)/,
      relation: 'CAUSES',
      confidence: 0.7
    },
    {
      pattern: /(후|이후|다음)/,
      relation: 'FOLLOWS',
      confidence: 0.6
    },
    {
      pattern: /(관련|연관|동반)/,
      relation: 'RELATED_TO',
      confidence: 0.5
    }
  ];

  constructor(config: Partial<TimelineConfig> = {}) {
    this.config = {
      claimDate: new Date().toISOString().split('T')[0],
      insuranceType: 'HEALTH',
      lookbackPeriod: 1825, // 5년
      riskThreshold: 0.7,
      includeMinorEvents: false,
      ...config
    };
  }

  /**
   * 메인 타임라인 분석 함수
   */
  async analyzeTimeline(events: MedicalEvent[]): Promise<TimelineAnalysis> {
    // 1단계: 이벤트 전처리 및 필터링
    const filteredEvents = this.filterEventsByRelevance(events);
    
    // 2단계: 시계열 이벤트 생성
    const timelineEvents = await this.createTimelineEvents(filteredEvents);
    
    // 3단계: 인과관계 분석
    const eventsWithCausal = await this.analyzeCausalRelations(timelineEvents);
    
    // 4단계: 보험 영향도 분석
    const eventsWithInsurance = await this.analyzeInsuranceImpact(eventsWithCausal);
    
    // 5단계: 위험 요소 분석
    const eventsWithRisk = await this.analyzeRiskFactors(eventsWithInsurance);
    
    // 6단계: 진행 단계 분석
    const finalEvents = await this.analyzeProgressionStages(eventsWithRisk);
    
    // 7단계: 종합 분석 결과 생성
    const analysis = await this.generateComprehensiveAnalysis(finalEvents);
    
    return analysis;
  }

  /**
   * 관련성 기반 이벤트 필터링
   */
  private filterEventsByRelevance(events: MedicalEvent[]): MedicalEvent[] {
    const claimDate = new Date(this.config.claimDate);
    
    return events.filter(event => {
      const eventDate = new Date(event.serviceDate);
      const daysDiff = Math.abs((claimDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // 조회 기간 내 이벤트만 포함
      if (daysDiff > this.config.lookbackPeriod) return false;
      
      // 중요도가 낮은 이벤트 제외 (설정에 따라)
      if (!this.config.includeMinorEvents && event.importance === 'LOW') return false;
      
      // 보험 관련성이 있는 이벤트 우선 포함
      if (event.insuranceRelevance > 0.3) return true;
      
      // 중요 진단이 있는 이벤트 포함
      if (event.diagnosisCodes.some(d => d.severity === 'CRITICAL')) return true;
      
      return event.importance !== 'LOW';
    });
  }

  /**
   * 타임라인 이벤트 생성
   */
  private async createTimelineEvents(events: MedicalEvent[]): Promise<TimelineEvent[]> {
    // 날짜순 정렬
    const sortedEvents = events.sort((a, b) => 
      new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime()
    );
    
    return sortedEvents.map((event, index) => ({
      ...event,
      timelinePosition: index,
      relatedEvents: [],
      causalRelations: [],
      insuranceImpact: {
        claimRelevance: 0,
        riskLevel: 'LOW',
        coverageCategory: '',
        exclusionRisk: 0,
        preExistingCondition: false,
        waitingPeriodImpact: false
      },
      riskFactors: [],
      progressionStage: 'INITIAL'
    }));
  }

  /**
   * 인과관계 분석
   */
  private async analyzeCausalRelations(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    for (let i = 0; i < events.length; i++) {
      const currentEvent = events[i];
      
      // 이전 이벤트들과의 관계 분석
      for (let j = 0; j < i; j++) {
        const previousEvent = events[j];
        const relation = this.inferCausalRelation(previousEvent, currentEvent);
        
        if (relation) {
          currentEvent.causalRelations.push(relation);
          currentEvent.relatedEvents.push(previousEvent.id);
          previousEvent.relatedEvents.push(currentEvent.id);
        }
      }
      
      // 이후 이벤트들과의 관계 분석 (역방향)
      for (let k = i + 1; k < events.length; k++) {
        const futureEvent = events[k];
        const relation = this.inferCausalRelation(currentEvent, futureEvent);
        
        if (relation) {
          futureEvent.causalRelations.push({
            ...relation,
            targetEventId: currentEvent.id,
            relationType: this.reverseRelationType(relation.relationType)
          });
        }
      }
    }
    
    return events;
  }

  /**
   * 인과관계 추론
   */
  private inferCausalRelation(
    sourceEvent: TimelineEvent, 
    targetEvent: TimelineEvent
  ): CausalRelation | null {
    const combinedText = `${sourceEvent.description} ${targetEvent.description}`;
    
    // 패턴 매칭으로 관계 유형 결정
    for (const pattern of this.CAUSAL_PATTERNS) {
      if (pattern.pattern.test(combinedText)) {
        return {
          targetEventId: targetEvent.id,
          relationType: pattern.relation as 'CAUSES' | 'TRIGGERED_BY' | 'RELATED_TO' | 'FOLLOWS' | 'COMPLICATES',
          confidence: pattern.confidence,
          evidence: combinedText.match(pattern.pattern)?.[0] || ''
        };
      }
    }
    
    // 진단 코드 기반 관계 추론
    const sourceMainDiagnosis = sourceEvent.diagnosisCodes[0]?.code;
    const targetMainDiagnosis = targetEvent.diagnosisCodes[0]?.code;
    
    if (sourceMainDiagnosis && targetMainDiagnosis) {
      // 같은 질환군인 경우
      if (sourceMainDiagnosis.substring(0, 3) === targetMainDiagnosis.substring(0, 3)) {
        return {
          targetEventId: targetEvent.id,
          relationType: 'RELATED_TO',
          confidence: 0.6,
          evidence: `같은 질환군 (${sourceMainDiagnosis.substring(0, 3)})`
        };
      }
    }
    
    // 시간적 근접성 기반 관계
    const timeDiff = Math.abs(
      new Date(targetEvent.serviceDate).getTime() - 
      new Date(sourceEvent.serviceDate).getTime()
    ) / (1000 * 60 * 60 * 24);
    
    if (timeDiff <= 7 && sourceEvent.institution === targetEvent.institution) {
      return {
        targetEventId: targetEvent.id,
        relationType: 'FOLLOWS',
        confidence: 0.4,
        evidence: `시간적 근접성 (${Math.round(timeDiff)}일 차이)`
      };
    }
    
    return null;
  }

  /**
   * 보험 영향도 분석
   */
  private async analyzeInsuranceImpact(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    const claimDate = new Date(this.config.claimDate);
    
    for (const event of events) {
      const eventDate = new Date(event.serviceDate);
      const daysDiff = (claimDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // 청구 관련성 계산
      let claimRelevance = 0;
      if (daysDiff <= 90) claimRelevance += 0.4; // 최근 3개월
      if (daysDiff <= 30) claimRelevance += 0.3; // 최근 1개월
      
      // 중요 진단 가산점
      if (event.diagnosisCodes.some(d => d.severity === 'CRITICAL')) {
        claimRelevance += 0.3;
      }
      
      // 위험 수준 결정
      const riskLevel = this.determineRiskLevel(event);
      
      // 면책 위험도 계산
      const exclusionRisk = this.calculateExclusionRisk(event);
      
      // 기왕력 여부 판단
      const preExistingCondition = this.isPreExistingCondition(event, claimDate);
      
      // 면책기간 영향 판단
      const waitingPeriodImpact = this.hasWaitingPeriodImpact(event);
      
      event.insuranceImpact = {
        claimRelevance: Math.min(claimRelevance, 1.0),
        riskLevel,
        coverageCategory: this.determineCoverageCategory(event),
        exclusionRisk,
        preExistingCondition,
        waitingPeriodImpact
      };
    }
    
    return events;
  }

  /**
   * 위험 요소 분석
   */
  private async analyzeRiskFactors(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    for (const event of events) {
      const riskFactors: RiskFactor[] = [];
      
      // 의학적 위험 요소
      if (event.diagnosisCodes.some(d => d.code.startsWith('C'))) {
        riskFactors.push({
          factor: '악성 신생물',
          severity: 'HIGH',
          category: 'MEDICAL',
          impact: '생명 위험 및 고액 치료비'
        });
      }
      
      // 행동적 위험 요소
      if (/(흡연|음주|약물)/.test(event.description)) {
        riskFactors.push({
          factor: '생활습관 위험인자',
          severity: 'MEDIUM',
          category: 'BEHAVIORAL',
          impact: '질병 악화 및 합병증 위험'
        });
      }
      
      // 유전적 위험 요소
      if (/(가족력|유전|선천)/.test(event.description)) {
        riskFactors.push({
          factor: '유전적 소인',
          severity: 'MEDIUM',
          category: 'GENETIC',
          impact: '재발 위험 및 면책 가능성'
        });
      }
      
      event.riskFactors = riskFactors;
    }
    
    return events;
  }

  /**
   * 진행 단계 분석
   */
  private async analyzeProgressionStages(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    // 질환별로 그룹화
    const diseaseGroups = this.groupEventsByDisease(events);
    
    for (const [diseaseCode, diseaseEvents] of diseaseGroups) {
      const progression = this.DISEASE_PROGRESSIONS[diseaseCode.substring(0, 3)] || 
                         this.DISEASE_PROGRESSIONS[diseaseCode];
      
      if (progression) {
        this.assignProgressionStages(diseaseEvents, progression);
      }
    }
    
    return events;
  }

  /**
   * 종합 분석 결과 생성
   */
  private async generateComprehensiveAnalysis(events: TimelineEvent[]): Promise<TimelineAnalysis> {
    const summary = this.generateSummary(events);
    const riskAssessment = this.generateRiskAssessment(events);
    const recommendations = this.generateInsuranceRecommendations(events);
    const qualityMetrics = this.calculateQualityMetrics(events);
    
    return {
      events,
      summary,
      riskAssessment,
      insuranceRecommendations: recommendations,
      qualityMetrics
    };
  }

  // 유틸리티 메서드들
  private determineRiskLevel(event: TimelineEvent): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (event.diagnosisCodes.some(d => d.severity === 'CRITICAL')) return 'CRITICAL';
    if (event.eventType === 'SURGERY' || event.eventType === 'HOSPITALIZATION') return 'HIGH';
    if (event.diagnosisCodes.some(d => d.severity === 'MAJOR')) return 'MEDIUM';
    return 'LOW';
  }

  private calculateExclusionRisk(event: TimelineEvent): number {
    let risk = 0;
    
    for (const keyword of this.INSURANCE_KEYWORDS.EXCLUSION_RISK) {
      if (event.description.includes(keyword)) risk += 0.2;
    }
    
    return Math.min(risk, 1.0);
  }

  private isPreExistingCondition(event: TimelineEvent, claimDate: Date): boolean {
    const eventDate = new Date(event.serviceDate);
    const daysDiff = (claimDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // 가입 전 90일 이내 진단은 기왕력으로 간주
    return daysDiff > 90 && event.eventType === 'DIAGNOSIS';
  }

  private hasWaitingPeriodImpact(event: TimelineEvent): boolean {
    return this.INSURANCE_KEYWORDS.WAITING_PERIOD.some(keyword => 
      event.description.includes(keyword)
    );
  }

  private determineCoverageCategory(event: TimelineEvent): string {
    if (event.diagnosisCodes.some(d => d.code.startsWith('C'))) return '암보험';
    if (event.diagnosisCodes.some(d => d.code.startsWith('I'))) return '심혈관질환';
    if (event.eventType === 'SURGERY') return '수술비';
    if (event.eventType === 'HOSPITALIZATION') return '입원비';
    return '일반의료비';
  }

  private reverseRelationType(relationType: CausalRelation['relationType']): CausalRelation['relationType'] {
    const reverseMap: Record<CausalRelation['relationType'], CausalRelation['relationType']> = {
      'CAUSES': 'TRIGGERED_BY',
      'TRIGGERED_BY': 'CAUSES',
      'FOLLOWS': 'RELATED_TO',
      'COMPLICATES': 'RELATED_TO',
      'RELATED_TO': 'RELATED_TO'
    };
    return reverseMap[relationType] || 'RELATED_TO';
  }

  private groupEventsByDisease(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
    const groups = new Map<string, TimelineEvent[]>();
    
    for (const event of events) {
      for (const diagnosis of event.diagnosisCodes) {
        const key = diagnosis.code;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(event);
      }
    }
    
    return groups;
  }

  private assignProgressionStages(
    events: TimelineEvent[], 
    progression: any
  ): void {
    events.forEach((event, index) => {
      if (index < progression.stages.length) {
        event.progressionStage = progression.stages[index];
      } else {
        event.progressionStage = 'PROGRESSION';
      }
    });
  }

  private generateSummary(events: TimelineEvent[]): TimelineSummary {
    const dates = events.map(e => e.serviceDate).sort();
    const diagnoses = events.flatMap(e => e.diagnosisCodes)
      .filter(d => d.severity === 'CRITICAL' || d.severity === 'MAJOR');
    const institutions = [...new Set(events.map(e => e.institution))];
    const criticalEvents = events.filter(e => e.importance === 'HIGH');
    
    return {
      totalEvents: events.length,
      dateRange: { start: dates[0] || '', end: dates[dates.length - 1] || '' },
      majorDiagnoses: diagnoses,
      keyInstitutions: institutions,
      treatmentProgression: events.map(e => e.eventType),
      criticalEvents
    };
  }

  private generateRiskAssessment(events: TimelineEvent[]): RiskAssessment {
    const allRiskFactors = events.flatMap(e => e.riskFactors);
    const criticalEvents = events.filter(e => e.insuranceImpact.riskLevel === 'CRITICAL');
    
    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (criticalEvents.length > 0) overallRisk = 'CRITICAL';
    else if (allRiskFactors.some(r => r.severity === 'HIGH')) overallRisk = 'HIGH';
    else if (allRiskFactors.length > 0) overallRisk = 'MEDIUM';
    
    return {
      overallRisk,
      riskFactors: allRiskFactors,
      preExistingConditions: events
        .filter(e => e.insuranceImpact.preExistingCondition)
        .map(e => e.description),
      progressionPattern: 'STABLE', // 실제로는 더 복잡한 로직 필요
      complicationRisk: allRiskFactors.length * 0.1
    };
  }

  private generateInsuranceRecommendations(events: TimelineEvent[]): InsuranceRecommendation[] {
    const recommendations: InsuranceRecommendation[] = [];
    
    const highRiskEvents = events.filter(e => e.insuranceImpact.riskLevel === 'CRITICAL');
    const preExistingEvents = events.filter(e => e.insuranceImpact.preExistingCondition);
    
    if (highRiskEvents.length > 0) {
      recommendations.push({
        type: 'REVIEW',
        reason: '고위험 질환 발견',
        evidence: highRiskEvents.map(e => e.description),
        confidence: 0.8,
        additionalInfo: '전문의 소견서 및 추가 검사 결과 필요'
      });
    }
    
    if (preExistingEvents.length > 0) {
      recommendations.push({
        type: 'INVESTIGATION',
        reason: '기왕력 확인 필요',
        evidence: preExistingEvents.map(e => e.description),
        confidence: 0.7,
        additionalInfo: '가입 전 진료기록 확인 필요'
      });
    }
    
    return recommendations;
  }

  private calculateQualityMetrics(events: TimelineEvent[]): QualityMetrics {
    const totalEvents = events.length;
    const eventsWithDates = events.filter(e => e.serviceDate).length;
    const eventsWithInstitutions = events.filter(e => e.institution !== '알 수 없음').length;
    const eventsWithDiagnoses = events.filter(e => e.diagnosisCodes.length > 0).length;
    
    return {
      completeness: totalEvents > 0 ? eventsWithDates / totalEvents : 0,
      consistency: totalEvents > 0 ? eventsWithInstitutions / totalEvents : 0,
      reliability: totalEvents > 0 ? eventsWithDiagnoses / totalEvents : 0,
      coverage: Math.min(totalEvents / 10, 1.0) // 10개 이상이면 완전 커버리지
    };
  }
}

export default TimelineEngine;