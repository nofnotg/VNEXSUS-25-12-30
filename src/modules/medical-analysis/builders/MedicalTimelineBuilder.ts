/**
 * Medical Timeline Builder
 *
 * 추출된 날짜를 의료 이벤트로 변환하고 타임라인 생성
 * - 날짜 → 이벤트 타입 분류
 * - 이벤트 정렬 및 검증
 * - 타임라인 시각화 데이터 생성
 */

import { ExtractedDate } from '../service/enhancedDateExtractor';
import { logger } from '../../../shared/logging/logger';

export type MedicalEventType =
  | 'insurance_contract' // 보험 계약
  | 'insurance_start' // 보험 시작
  | 'insurance_end' // 보험 종료
  | 'accident' // 사고 발생
  | 'hospital_visit' // 병원 내원
  | 'hospital_admission' // 입원
  | 'hospital_discharge' // 퇴원
  | 'diagnosis' // 진단
  | 'examination' // 검사
  | 'surgery' // 수술
  | 'claim' // 청구
  | 'unknown'; // 알 수 없음

export interface MedicalEvent {
  date: string; // YYYY-MM-DD
  type: MedicalEventType;
  description: string;
  source: 'ocr' | 'llm';
  confidence: number;
  context?: string;
}

export interface PatientInfo {
  name?: string;
  insuranceCompany?: string;
  policyNumber?: string;
}

export interface InsurancePeriod {
  start?: string;
  end?: string;
}

export interface MedicalTimeline {
  patientInfo: PatientInfo;
  insurancePeriod: InsurancePeriod;
  events: MedicalEvent[];
  summary: string;
  isValid: boolean;
  warnings: string[];
}

/**
 * Medical Timeline Builder
 */
export class MedicalTimelineBuilder {
  /**
   * 타임라인 생성
   */
  async buildTimeline(
    extractedDates: ExtractedDate[],
    additionalContext?: {
      patientInfo?: PatientInfo;
      rawText?: string;
    }
  ): Promise<MedicalTimeline> {
    const startTime = Date.now();

    try {
      logger.info({
        event: 'timeline_build_start',
        dateCount: extractedDates.length,
      });

      // 1. 날짜 → 이벤트 변환
      const events = this.convertToEvents(extractedDates);

      // 2. 이벤트 정렬 (날짜순)
      const sortedEvents = this.sortEvents(events);

      // 3. 보험 기간 추출
      const insurancePeriod = this.extractInsurancePeriod(sortedEvents);

      // 4. 타임라인 검증
      const warnings = this.validateTimeline(sortedEvents, insurancePeriod);

      // 5. 요약 생성
      const summary = this.generateSummary(sortedEvents, insurancePeriod);

      const processingTime = Date.now() - startTime;

      logger.info({
        event: 'timeline_build_success',
        eventCount: sortedEvents.length,
        processingTime,
        warnings: warnings.length,
      });

      return {
        patientInfo: additionalContext?.patientInfo || {},
        insurancePeriod,
        events: sortedEvents,
        summary,
        isValid: warnings.length === 0,
        warnings,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error({
        event: 'timeline_build_error',
        error: error as Error,
        processingTime,
      });

      throw error;
    }
  }

  /**
   * 날짜 → 이벤트 변환
   */
  private convertToEvents(dates: ExtractedDate[]): MedicalEvent[] {
    return dates.map((d) => ({
      date: d.date,
      type: this.classifyEventType(d.type, d.context),
      description: this.generateDescription(d.type, d.context),
      source: d.source,
      confidence: d.confidence,
      context: d.context,
    }));
  }

  /**
   * 이벤트 타입 분류
   */
  private classifyEventType(type: string, context: string): MedicalEventType {
    const contextLower = context.toLowerCase();
    const typeLower = type.toLowerCase();

    // 보험 관련
    if (typeLower.includes('계약') || typeLower.includes('가입')) {
      return 'insurance_contract';
    }
    if (typeLower.includes('시작') || typeLower.includes('보험_시작')) {
      return 'insurance_start';
    }
    if (typeLower.includes('종료') || typeLower.includes('보험_종료') || typeLower.includes('만기')) {
      return 'insurance_end';
    }

    // 사고
    if (typeLower.includes('사고') || contextLower.includes('사고')) {
      return 'accident';
    }

    // 병원
    if (typeLower.includes('내원') || contextLower.includes('내원')) {
      return 'hospital_visit';
    }
    if (typeLower.includes('입원') || contextLower.includes('입원')) {
      return 'hospital_admission';
    }
    if (typeLower.includes('퇴원') || contextLower.includes('퇴원')) {
      return 'hospital_discharge';
    }

    // 진료
    if (typeLower.includes('진단') || contextLower.includes('진단')) {
      return 'diagnosis';
    }
    if (typeLower.includes('검사') || contextLower.includes('검사')) {
      return 'examination';
    }
    if (typeLower.includes('수술') || contextLower.includes('수술')) {
      return 'surgery';
    }

    // 청구
    if (typeLower.includes('청구') || contextLower.includes('청구')) {
      return 'claim';
    }

    return 'unknown';
  }

  /**
   * 설명 생성
   */
  private generateDescription(type: string, context: string): string {
    // 타입에서 한글 라벨 추출
    if (type.includes('_')) {
      const parts = type.split('_');
      return parts.join(' ');
    }

    // 문맥에서 핵심 키워드 추출
    const keywords = ['보험', '계약', '사고', '내원', '입원', '퇴원', '진단', '검사', '수술', '청구'];
    for (const keyword of keywords) {
      if (context.includes(keyword)) {
        return keyword;
      }
    }

    return '날짜';
  }

  /**
   * 이벤트 정렬
   */
  private sortEvents(events: MedicalEvent[]): MedicalEvent[] {
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 보험 기간 추출
   */
  private extractInsurancePeriod(events: MedicalEvent[]): InsurancePeriod {
    const startEvent = events.find((e) => e.type === 'insurance_start');
    const endEvent = events.find((e) => e.type === 'insurance_end');

    return {
      start: startEvent?.date,
      end: endEvent?.date,
    };
  }

  /**
   * 타임라인 검증
   */
  private validateTimeline(events: MedicalEvent[], insurancePeriod: InsurancePeriod): string[] {
    const warnings: string[] = [];

    // 1. 이벤트 순서 검증
    const contractEvent = events.find((e) => e.type === 'insurance_contract');
    const accidentEvent = events.find((e) => e.type === 'accident');
    const hospitalEvent = events.find(
      (e) => e.type === 'hospital_visit' || e.type === 'hospital_admission'
    );

    if (contractEvent && accidentEvent) {
      if (contractEvent.date > accidentEvent.date) {
        warnings.push('⚠️ 계약일이 사고일보다 늦습니다');
      }
    }

    if (accidentEvent && hospitalEvent) {
      if (accidentEvent.date > hospitalEvent.date) {
        warnings.push('⚠️ 사고일이 병원 내원일보다 늦습니다');
      }
    }

    // 2. 보험 기간 검증
    if (insurancePeriod.start && insurancePeriod.end) {
      if (insurancePeriod.start > insurancePeriod.end) {
        warnings.push('⚠️ 보험 시작일이 종료일보다 늦습니다');
      }

      // 사고가 보험 기간 내인지 확인
      if (accidentEvent) {
        if (
          accidentEvent.date < insurancePeriod.start ||
          accidentEvent.date > insurancePeriod.end
        ) {
          warnings.push('⚠️ 사고일이 보험 기간 밖입니다');
        }
      }
    }

    // 3. 입원/퇴원 검증
    const admissionEvent = events.find((e) => e.type === 'hospital_admission');
    const dischargeEvent = events.find((e) => e.type === 'hospital_discharge');

    if (admissionEvent && dischargeEvent) {
      if (admissionEvent.date > dischargeEvent.date) {
        warnings.push('⚠️ 입원일이 퇴원일보다 늦습니다');
      }
    }

    // 4. 중복 날짜 검증
    const dateMap = new Map<string, MedicalEvent[]>();
    for (const event of events) {
      if (!dateMap.has(event.date)) {
        dateMap.set(event.date, []);
      }
      dateMap.get(event.date)!.push(event);
    }

    for (const [date, eventsOnDate] of dateMap.entries()) {
      if (eventsOnDate.length > 3) {
        warnings.push(`⚠️ ${date}에 ${eventsOnDate.length}개의 이벤트가 있습니다 (중복 가능성)`);
      }
    }

    return warnings;
  }

  /**
   * 요약 생성
   */
  private generateSummary(events: MedicalEvent[], insurancePeriod: InsurancePeriod): string {
    const lines: string[] = [];

    // 보험 기간
    if (insurancePeriod.start && insurancePeriod.end) {
      lines.push(`📋 보험 기간: ${insurancePeriod.start} ~ ${insurancePeriod.end}`);
    }

    // 주요 이벤트 수
    const eventCounts: Record<string, number> = {};
    for (const event of events) {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    }

    const summaryItems: string[] = [];
    if (eventCounts.accident) summaryItems.push(`사고 ${eventCounts.accident}건`);
    if (eventCounts.hospital_admission) summaryItems.push(`입원 ${eventCounts.hospital_admission}건`);
    if (eventCounts.surgery) summaryItems.push(`수술 ${eventCounts.surgery}건`);
    if (eventCounts.claim) summaryItems.push(`청구 ${eventCounts.claim}건`);

    if (summaryItems.length > 0) {
      lines.push(`📊 주요 이벤트: ${summaryItems.join(', ')}`);
    }

    // 전체 이벤트 수
    lines.push(`📅 총 ${events.length}개의 날짜 추출됨`);

    return lines.join('\n');
  }

  /**
   * HTML 타임라인 생성 (시각화)
   */
  generateHTMLTimeline(timeline: MedicalTimeline): string {
    const eventIcons: Record<MedicalEventType, string> = {
      insurance_contract: '📝',
      insurance_start: '🟢',
      insurance_end: '🔴',
      accident: '⚠️',
      hospital_visit: '🏥',
      hospital_admission: '🛏️',
      hospital_discharge: '🚪',
      diagnosis: '🩺',
      examination: '🔬',
      surgery: '⚕️',
      claim: '💰',
      unknown: '❓',
    };

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>의료 이벤트 타임라인</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    .summary { background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .timeline { position: relative; padding-left: 40px; }
    .timeline::before { content: ''; position: absolute; left: 15px; top: 0; bottom: 0; width: 2px; background: #ddd; }
    .event { position: relative; margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px; border-left: 4px solid #4CAF50; }
    .event-icon { position: absolute; left: -32px; width: 30px; height: 30px; background: white; border: 2px solid #4CAF50; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; }
    .event-date { font-weight: bold; color: #4CAF50; }
    .event-type { color: #666; font-size: 14px; }
    .event-context { color: #999; font-size: 12px; margin-top: 5px; }
    .warning { background: #fff3cd; border-left-color: #ffc107; padding: 10px; margin: 10px 0; border-radius: 5px; }
    .insurance-period { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 의료 이벤트 타임라인</h1>

    <div class="summary">
      ${timeline.summary.replace(/\n/g, '<br>')}
    </div>

    ${
      timeline.insurancePeriod.start || timeline.insurancePeriod.end
        ? `
    <div class="insurance-period">
      <strong>📋 보험 기간</strong><br>
      시작: ${timeline.insurancePeriod.start || '미상'}<br>
      종료: ${timeline.insurancePeriod.end || '미상'}
    </div>
    `
        : ''
    }

    ${
      timeline.warnings.length > 0
        ? `
    <div class="warning">
      <strong>⚠️ 주의사항:</strong><br>
      ${timeline.warnings.join('<br>')}
    </div>
    `
        : ''
    }

    <h2>📅 이벤트 타임라인</h2>
    <div class="timeline">
      ${timeline.events
        .map(
          (event) => `
        <div class="event">
          <div class="event-icon">${eventIcons[event.type]}</div>
          <div class="event-date">${event.date}</div>
          <div class="event-type">${event.description} (${event.type})</div>
          ${event.context ? `<div class="event-context">📝 ${event.context}</div>` : ''}
          <div class="event-context">신뢰도: ${(event.confidence * 100).toFixed(1)}% | 소스: ${event.source}</div>
        </div>
      `
        )
        .join('')}
    </div>
  </div>
</body>
</html>
    `;

    return html;
  }
}

// 싱글톤 인스턴스
let builderInstance: MedicalTimelineBuilder | null = null;

export function getMedicalTimelineBuilder(): MedicalTimelineBuilder {
  if (!builderInstance) {
    builderInstance = new MedicalTimelineBuilder();
  }
  return builderInstance;
}
