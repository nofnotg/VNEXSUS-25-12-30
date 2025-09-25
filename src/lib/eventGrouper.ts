/**
 * Event Grouper Module
 * 
 * 날짜별/병원별로 이벤트를 그룹화하고 정렬하는 모듈
 */

import { ParsedEvent } from './ocrParser.js';

// 타임라인 이벤트 인터페이스
export interface TimelineEvent extends ParsedEvent {
  // 병합 소스 이벤트들 (원본 보존)
  sourceEvents?: ParsedEvent[];
  // 병합된 이벤트 수
  mergedCount?: number;
}

// 보고서에서 사용할 타임라인 이벤트 인터페이스
export interface ReportTimelineEvent extends TimelineEvent {
  hospital: string;
}

// 타임라인 인터페이스
export interface MedicalTimeline {
  events: TimelineEvent[];
  startDate: string;
  endDate: string;
  hospitals: string[];
  tags: string[];
}

class EventGrouper {
  /**
   * 이벤트 정렬 및 그룹화
   */
  public groupEvents(events: ParsedEvent[]): MedicalTimeline {
    if (!events || events.length === 0) {
      return this.createEmptyTimeline();
    }
    
    // 날짜 기준 오름차순 정렬
    const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
    
    // 병원별 그룹화 및 병합
    const mergedEvents = this.mergeEventsByHospital(sortedEvents) as ReportTimelineEvent[];
    
    // 타임라인 메타데이터 구성
    const startDate = mergedEvents[0]?.date || '';
    const endDate = mergedEvents[mergedEvents.length - 1]?.date || '';
    
    // 모든 병원 목록 추출
    const hospitals = new Set<string>();
    mergedEvents.forEach(event => {
      if (event.hospital) {
        hospitals.add(event.hospital);
      }
    });
    
    // 모든 태그 목록 추출
    const tags = new Set<string>();
    mergedEvents.forEach(event => {
      if (event.tags) {
        event.tags.forEach(tag => tags.add(tag));
      }
    });
    
    return {
      events: mergedEvents,
      startDate,
      endDate,
      hospitals: Array.from(hospitals),
      tags: Array.from(tags)
    };
  }
  
  /**
   * 동일 날짜 + 동일 병원 이벤트 병합
   */
  private mergeEventsByHospital(sortedEvents: ParsedEvent[]): ReportTimelineEvent[] {
    if (sortedEvents.length <= 1) {
      return sortedEvents as ReportTimelineEvent[];
    }
    
    const mergedEvents: ReportTimelineEvent[] = [];
    let currentGroup: ParsedEvent[] = [sortedEvents[0]];
    
    for (let i = 1; i < sortedEvents.length; i++) {
      const currentEvent = sortedEvents[i];
      const previousEvent = currentGroup[0];
      
      // 같은 날짜 및 같은 병원인 경우 그룹화
      if (
        currentEvent.date === previousEvent.date && 
        (
          (currentEvent.hospital && currentEvent.hospital === previousEvent.hospital) ||
          (!currentEvent.hospital && !previousEvent.hospital)
        )
      ) {
        currentGroup.push(currentEvent);
      } else {
        // 이전 그룹 병합 및 저장
        const mergedEvent = this.mergeSameHospitalEvents(currentGroup);
        mergedEvents.push(mergedEvent);
        
        // 새 그룹 시작
        currentGroup = [currentEvent];
      }
    }
    
    // 마지막 그룹 처리
    if (currentGroup.length > 0) {
      const mergedEvent = this.mergeSameHospitalEvents(currentGroup);
      mergedEvents.push(mergedEvent);
    }
    
    return mergedEvents;
  }
  
  /**
   * 같은 병원의 같은 날짜 이벤트들을 하나로 병합
   */
  private mergeSameHospitalEvents(events: ParsedEvent[]): ReportTimelineEvent {
    if (events.length === 1) {
      const event = events[0] as ReportTimelineEvent;
      event.sourceEvents = [{ ...events[0] }];
      event.mergedCount = 1;
      return event;
    }
    
    // 첫 번째 이벤트를 기반으로 병합
    const baseEvent = events[0];
    const mergedTexts: string[] = events.map(e => e.rawText);
    
    // 블록 병합
    const mergedBlocks = events.flatMap(e => e.blocks);
    
    // 페이지 인덱스 병합
    const pageIndices = new Set<number>();
    events.forEach(event => {
      event.pageIndices.forEach(idx => pageIndices.add(idx));
    });
    
    // 태그 병합
    const tags = new Set<string>();
    events.forEach(event => {
      if (event.tags) {
        event.tags.forEach(tag => tags.add(tag));
      }
    });
    
    // 신뢰도 평균 계산
    const totalConfidence = events.reduce((sum, event) => sum + event.confidence, 0);
    const avgConfidence = totalConfidence / events.length;
    
    // 병합된 이벤트 생성
    const mergedEvent: ReportTimelineEvent = {
      date: baseEvent.date,
      hospital: baseEvent.hospital || '알 수 없음',
      rawText: mergedTexts.join('\n\n'),
      blocks: mergedBlocks,
      confidence: avgConfidence,
      pageIndices: Array.from(pageIndices).sort(),
      tags: Array.from(tags),
      originalDateString: baseEvent.originalDateString,
      sourceEvents: events.map(e => ({ ...e })), // 원본 이벤트 복사
      mergedCount: events.length
    };
    
    return mergedEvent;
  }
  
  /**
   * 빈 타임라인 생성
   */
  private createEmptyTimeline(): MedicalTimeline {
    return {
      events: [],
      startDate: '',
      endDate: '',
      hospitals: [],
      tags: []
    };
  }
  
  /**
   * 타임라인 이벤트 내용 인덱싱 (검색용)
   */
  public createSearchIndex(timeline: MedicalTimeline): Map<string, number[]> {
    const searchIndex = new Map<string, number[]>();
    
    timeline.events.forEach((event, eventIndex) => {
      // 텍스트를 단어로 분할
      const words = event.rawText.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .split(/\s+/)
        .filter(word => word.length >= 2);
      
      // 중복 제거
      const uniqueWords = Array.from(new Set(words));
      
      // 인덱스 추가
      uniqueWords.forEach(word => {
        if (searchIndex.has(word)) {
          searchIndex.get(word)!.push(eventIndex);
        } else {
          searchIndex.set(word, [eventIndex]);
        }
      });
    });
    
    return searchIndex;
  }
  
  /**
   * 키워드로 타임라인에서 이벤트 검색
   */
  public searchTimelineEvents(
    timeline: MedicalTimeline, 
    searchIndex: Map<string, number[]>, 
    query: string
  ): TimelineEvent[] {
    if (!query.trim()) {
      return [];
    }
    
    // 검색어를 단어로 분할
    const searchWords = query.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(word => word.length >= 2);
    
    if (searchWords.length === 0) {
      return [];
    }
    
    // 각 단어에 대한 이벤트 인덱스 배열 가져오기
    const matchingSets = searchWords.map(word => {
      return new Set(searchIndex.get(word) || []);
    });
    
    // 모든 단어가 포함된 이벤트 인덱스 찾기 (교집합)
    let resultIndices: number[] = [];
    
    if (matchingSets.length > 0) {
      // 첫 번째 세트로 시작
      resultIndices = Array.from(matchingSets[0]);
      
      // 다른 세트와 교집합 계산
      for (let i = 1; i < matchingSets.length; i++) {
        resultIndices = resultIndices.filter(idx => matchingSets[i].has(idx));
      }
    }
    
    // 결과 이벤트 반환
    return resultIndices.map(idx => timeline.events[idx]);
  }
}

// 싱글톤 인스턴스
export const eventGrouper = new EventGrouper();

export default eventGrouper; 