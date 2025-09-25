/**
 * Period Filter Module
 * 
 * 기간, 신뢰도, 태그 등을 기준으로 타임라인 이벤트를 필터링하는 모듈
 */

import { MedicalTimeline, TimelineEvent } from './eventGrouper.js';

// 간단한 필터링을 위한 함수 추가
export function filterTimeline(tl, options) {
  const {start, end, excludeTags=[]} = options;
  
  // 날짜 문자열을 Date 객체로 변환하여 비교
  return tl.filter(ev => {
    // 날짜 변환
    const evDate = new Date(ev.date);
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    
    // 날짜 필터링
    const okDate = (!startDate || evDate >= startDate) && (!endDate || evDate <= endDate);
    
    // 태그 필터링
    const okTag = !ev.tags || !ev.tags.some(t => excludeTags.includes(t));
    
    return okDate && okTag;
  });
}

// 기간 프리셋 정의
export enum PeriodPreset {
  ThreeMonths = '3m',
  OneYear = '1y',
  TwoYears = '2y',
  ThreeYears = '3y',
  FourYears = '4y',
  FiveYears = '5y',
  Custom = 'custom'
}

// 필터 옵션 인터페이스
export interface FilterOptions {
  // 기간 필터
  periodPreset: PeriodPreset;
  // 시작일 (YYYY-MM-DD, 커스텀 기간인 경우)
  startDate?: string;
  // 종료일 (YYYY-MM-DD, 커스텀 기간인 경우)
  endDate?: string;
  // 기준일 (보험 가입일 등, 미래 기준으로 3개월 등에 사용)
  referenceDate?: string;
  // 최소 신뢰도 (0.0 ~ 1.0)
  minConfidence?: number;
  // 제외할 태그 (이 태그가 있는 이벤트는 제외)
  excludeTags?: string[];
  // 포함할 태그 (이 태그 중 하나가 있는 이벤트만 포함)
  includeTags?: string[];
  // 병원 필터 (이 병원 이벤트만 포함)
  hospitals?: string[];
  // 키워드 검색
  searchQuery?: string;
}

// 필터 결과 인터페이스
export interface FilterResult {
  // 필터링된 이벤트
  events: TimelineEvent[];
  // 원본 이벤트 대비 필터링된 비율
  filterRatio: number;
  // 적용된 필터 요약
  appliedFilters: {
    period: string;
    confidence: number;
    excludedTags: string[];
    includedTags: string[];
    hospitals: string[];
    searchQuery?: string;
  };
}

class PeriodFilter {
  /**
   * 타임라인을 필터링
   */
  public filterTimeline(timeline: MedicalTimeline, options: FilterOptions): FilterResult {
    // 기본 옵션 설정
    const defaultOptions: FilterOptions = {
      periodPreset: PeriodPreset.FiveYears,
      minConfidence: 0.5,
      excludeTags: [],
      includeTags: [],
      hospitals: []
    };
    
    // 옵션 병합
    const finalOptions = { ...defaultOptions, ...options };
    
    // 날짜 범위 계산
    const { startDate, endDate } = this.calculateDateRange(
      finalOptions.periodPreset,
      finalOptions.startDate,
      finalOptions.endDate,
      finalOptions.referenceDate
    );
    
    // 이벤트 필터링
    let filteredEvents = timeline.events.filter(event => {
      // 1. 날짜 범위 필터
      if (startDate && event.date < startDate) return false;
      if (endDate && event.date > endDate) return false;
      
      // 2. 신뢰도 필터
      if (finalOptions.minConfidence && event.confidence < finalOptions.minConfidence) return false;
      
      // 3. 제외 태그 필터
      if (finalOptions.excludeTags && finalOptions.excludeTags.length > 0) {
        if (event.tags && event.tags.some(tag => finalOptions.excludeTags!.includes(tag))) {
          return false;
        }
      }
      
      // 4. 포함 태그 필터
      if (finalOptions.includeTags && finalOptions.includeTags.length > 0) {
        if (!event.tags || !event.tags.some(tag => finalOptions.includeTags!.includes(tag))) {
          return false;
        }
      }
      
      // 5. 병원 필터
      if (finalOptions.hospitals && finalOptions.hospitals.length > 0) {
        if (!event.hospital || !finalOptions.hospitals.includes(event.hospital)) {
          return false;
        }
      }
      
      return true;
    });
    
    // 검색 쿼리 필터 (키워드 검색)
    if (finalOptions.searchQuery && finalOptions.searchQuery.trim()) {
      const query = finalOptions.searchQuery.toLowerCase();
      filteredEvents = filteredEvents.filter(event => 
        event.rawText.toLowerCase().includes(query)
      );
    }
    
    // 결과 생성
    return {
      events: filteredEvents,
      filterRatio: timeline.events.length > 0 
        ? filteredEvents.length / timeline.events.length 
        : 0,
      appliedFilters: {
        period: this.getPeriodDescription(
          finalOptions.periodPreset, 
          startDate, 
          endDate, 
          finalOptions.referenceDate
        ),
        confidence: finalOptions.minConfidence || 0,
        excludedTags: finalOptions.excludeTags || [],
        includedTags: finalOptions.includeTags || [],
        hospitals: finalOptions.hospitals || [],
        searchQuery: finalOptions.searchQuery
      }
    };
  }
  
  /**
   * 기간 프리셋 기반으로 날짜 범위 계산
   */
  private calculateDateRange(
    preset: PeriodPreset,
    customStartDate?: string,
    customEndDate?: string,
    referenceDate?: string
  ): { startDate: string; endDate: string } {
    const today = new Date();
    let startDate = '';
    let endDate = today.toISOString().slice(0, 10); // 오늘 (YYYY-MM-DD)
    
    // 기준일이 있는 경우 사용
    const refDate = referenceDate 
      ? new Date(referenceDate) 
      : today;
    
    switch (preset) {
      case PeriodPreset.ThreeMonths:
        // 기준일로부터 3개월 전
        const threeMonthsAgo = new Date(refDate);
        threeMonthsAgo.setMonth(refDate.getMonth() - 3);
        startDate = threeMonthsAgo.toISOString().slice(0, 10);
        endDate = refDate.toISOString().slice(0, 10);
        break;
        
      case PeriodPreset.OneYear:
        // 기준일로부터 1년 전
        const oneYearAgo = new Date(refDate);
        oneYearAgo.setFullYear(refDate.getFullYear() - 1);
        startDate = oneYearAgo.toISOString().slice(0, 10);
        endDate = refDate.toISOString().slice(0, 10);
        break;
        
      case PeriodPreset.TwoYears:
        // 기준일로부터 2년 전
        const twoYearsAgo = new Date(refDate);
        twoYearsAgo.setFullYear(refDate.getFullYear() - 2);
        startDate = twoYearsAgo.toISOString().slice(0, 10);
        endDate = refDate.toISOString().slice(0, 10);
        break;
        
      case PeriodPreset.ThreeYears:
        // 기준일로부터 3년 전
        const threeYearsAgo = new Date(refDate);
        threeYearsAgo.setFullYear(refDate.getFullYear() - 3);
        startDate = threeYearsAgo.toISOString().slice(0, 10);
        endDate = refDate.toISOString().slice(0, 10);
        break;
        
      case PeriodPreset.FourYears:
        // 기준일로부터 4년 전
        const fourYearsAgo = new Date(refDate);
        fourYearsAgo.setFullYear(refDate.getFullYear() - 4);
        startDate = fourYearsAgo.toISOString().slice(0, 10);
        endDate = refDate.toISOString().slice(0, 10);
        break;
        
      case PeriodPreset.FiveYears:
        // 기준일로부터 5년 전
        const fiveYearsAgo = new Date(refDate);
        fiveYearsAgo.setFullYear(refDate.getFullYear() - 5);
        startDate = fiveYearsAgo.toISOString().slice(0, 10);
        endDate = refDate.toISOString().slice(0, 10);
        break;
        
      case PeriodPreset.Custom:
        // 사용자 지정 기간
        startDate = customStartDate || '';
        endDate = customEndDate || today.toISOString().slice(0, 10);
        break;
    }
    
    return { startDate, endDate };
  }
  
  /**
   * 기간 설명 텍스트 생성
   */
  private getPeriodDescription(
    preset: PeriodPreset,
    startDate: string,
    endDate: string,
    referenceDate?: string
  ): string {
    // 기준일 텍스트 (가입일, 오늘 등)
    const refDateText = referenceDate 
      ? `가입일(${this.formatDate(referenceDate)})` 
      : '오늘';
    
    switch (preset) {
      case PeriodPreset.ThreeMonths:
        return `${refDateText}로부터 3개월`;
      case PeriodPreset.OneYear:
        return `${refDateText}로부터 1년`;
      case PeriodPreset.TwoYears:
        return `${refDateText}로부터 2년`;
      case PeriodPreset.ThreeYears:
        return `${refDateText}로부터 3년`;
      case PeriodPreset.FourYears:
        return `${refDateText}로부터 4년`;
      case PeriodPreset.FiveYears:
        return `${refDateText}로부터 5년`;
      case PeriodPreset.Custom:
        return `${this.formatDate(startDate)} ~ ${this.formatDate(endDate)}`;
      default:
        return '전체 기간';
    }
  }
  
  /**
   * 날짜 포맷 (YYYY-MM-DD → YYYY년 MM월 DD일)
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    return `${parts[0]}년 ${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
  }
  
  /**
   * 보험 가입일 기준 3개월/5년 여부 확인
   */
  public classifyEventsByInsuranceDate(
    events: TimelineEvent[],
    insuranceDate: string
  ): { within3Months: TimelineEvent[]; within5Years: TimelineEvent[]; beyond5Years: TimelineEvent[] } {
    const insDate = new Date(insuranceDate);
    
    // 3개월, 5년 기준일 계산
    const threeMonthsBeforeIns = new Date(insDate);
    threeMonthsBeforeIns.setMonth(insDate.getMonth() - 3);
    
    const fiveYearsBeforeIns = new Date(insDate);
    fiveYearsBeforeIns.setFullYear(insDate.getFullYear() - 5);
    
    // 각 기간별 분류
    const within3Months: TimelineEvent[] = [];
    const within5Years: TimelineEvent[] = [];
    const beyond5Years: TimelineEvent[] = [];
    
    events.forEach(event => {
      const eventDate = new Date(event.date);
      
      if (eventDate >= threeMonthsBeforeIns && eventDate <= insDate) {
        within3Months.push(event);
      } else if (eventDate >= fiveYearsBeforeIns && eventDate < threeMonthsBeforeIns) {
        within5Years.push(event);
      } else if (eventDate < fiveYearsBeforeIns) {
        beyond5Years.push(event);
      }
    });
    
    return { within3Months, within5Years, beyond5Years };
  }
}

// 싱글톤 인스턴스
export const periodFilter = new PeriodFilter();

export default periodFilter; 