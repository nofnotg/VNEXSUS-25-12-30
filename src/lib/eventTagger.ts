/**
 * Event Tagger Module
 * 
 * OCR 파싱 이벤트에 태그를 자동으로 부착하는 모듈
 */

import { ParsedEvent } from './ocrParser.js';
import diseaseCodeIndex, { DiseaseCode } from './codeIndex.js';
import { isExcluded, isImportant } from '../modules/tagFilter.js';

// 태그 정의
export const TAG_TYPES = {
  DX_CONFIRMED: 'dx_confirmed',   // 확진 진단
  SX_PERFORMED: 'sx_performed',   // 수술 시행
  IP_EVENT: 'ip_event',           // 입원 관련 이벤트
  FU_NEEDED: 'fu_needed',         // 추적 관찰 필요
  MED_ADMIN: 'med_admin',         // 약물 투여
  NURSING: 'nursing',             // 간호 기록
  ROUTINE_MED: 'routine_med',     // 일상 약물
  DX_GENERAL: 'dx_general',       // 진단 일반
  EXCLUDE: 'exclude',             // 제외 항목
  IMPORTANT: 'important'          // 중요 항목
};

// 각 태그의 표시 이름
export const TAG_LABELS = {
  [TAG_TYPES.DX_CONFIRMED]: '진단',
  [TAG_TYPES.SX_PERFORMED]: '수술',
  [TAG_TYPES.IP_EVENT]: '입원',
  [TAG_TYPES.FU_NEEDED]: '추적관찰',
  [TAG_TYPES.MED_ADMIN]: '약물투여',
  [TAG_TYPES.NURSING]: '간호기록',
  [TAG_TYPES.ROUTINE_MED]: '일상약물',
  [TAG_TYPES.DX_GENERAL]: '진단일반',
  [TAG_TYPES.EXCLUDE]: '제외항목',
  [TAG_TYPES.IMPORTANT]: '중요항목'
};

// 태그 별 배지 색상
export const TAG_COLORS = {
  [TAG_TYPES.DX_CONFIRMED]: 'danger',
  [TAG_TYPES.SX_PERFORMED]: 'warning',
  [TAG_TYPES.IP_EVENT]: 'primary',
  [TAG_TYPES.FU_NEEDED]: 'info',
  [TAG_TYPES.MED_ADMIN]: 'success',
  [TAG_TYPES.NURSING]: 'secondary',
  [TAG_TYPES.ROUTINE_MED]: 'light',
  [TAG_TYPES.DX_GENERAL]: 'secondary',
  [TAG_TYPES.EXCLUDE]: 'dark',
  [TAG_TYPES.IMPORTANT]: 'danger'
};

// 태깅 결과
export interface TaggingResult {
  event: ParsedEvent;
  addedTags: string[];
  matchedCodes: DiseaseCode[];
  matchedPatterns: {
    [tag: string]: string[];
  };
}

class EventTagger {
  // 태그 패턴 정의
  private tagPatterns = {
    [TAG_TYPES.SX_PERFORMED]: [
      /(?:수술|절제|제거|치환|고정|성형|술|이식|개통|교정|개창|봉합|재건|복원|재활|복강경)/,
      /(?:Op\.?|Operation|Arthroscopy|Surgery|Intervention|amputation|arthroplasty|implant)/i,
      /(?:성형술|절개술|절제술|제거술|교정술|이식술|봉합술|교체술|치환술|복원술|고정술|재건술|형성술|성형술)/
    ],
    [TAG_TYPES.IP_EVENT]: [
      /(?:입원|퇴원|전동|전과|전실|재원|병실|병동|중환자실|응급실|ER)/,
      /(?:Admission|Discharge|Transfer|ICU|ER|Ward|Hospitalization)/i
    ],
    [TAG_TYPES.FU_NEEDED]: [
      /(?:의심|추정|관찰|follow\s?up|f\/u|경과관찰|관찰요망|주의관찰|재검사|확인필요|평가필요|지속관찰|추적검사|재평가)/i,
      /(?:필요시|정밀검사|지속적|관찰중|의뢰|상담요망|권고|권유|재방문|※|NB|Note)/
    ],
    [TAG_TYPES.MED_ADMIN]: [
      /(?:항암제|항암|면역|스테로이드|주사|정맥주사|점적|투여|처방|처치|시술)/,
      /(?:chemo(?:therapy)?|steroid|immunoglobulin|injection|IV|administration|medication)/i,
      /(?:mg\/kg|ml\/hr|unit\/kg|ampule|ample|cc)/i
    ],
    [TAG_TYPES.NURSING]: [
      /(?:간호|체온|맥박|혈압|호흡|활력징후|영양|위생|배뇨|배변|체위|상태|의식|섭취량|배출량)/,
      /(?:vital\s?sign|bp|temperature|pulse|respiration|nursing|care|hygiene)/i
    ],
    [TAG_TYPES.ROUTINE_MED]: [
      /(?:타이레놀|아세트아미노펜|이부프로펜|아스피린|연고|파스|밴드|거즈|소독)/,
      /(?:tylenol|acetaminophen|ibuprofen|aspirin|nsaid|advil|motrin|ointment|patch)/i,
      /(?:비타민|종합비타민|영양제)/
    ]
  };

  /**
   * 이벤트에 태그 부착
   */
  public async tagEvent(event: ParsedEvent): Promise<TaggingResult> {
    const taggingResult: TaggingResult = {
      event,
      addedTags: [],
      matchedCodes: [],
      matchedPatterns: {}
    };
    
    // 기존 태그가 없는 경우 초기화
    if (!event.tags) {
      event.tags = [];
    }
    
    // 질병 코드 탐지 (DX_CONFIRMED 태그)
    await this.detectDiseaseCodes(event, taggingResult);
    
    // 패턴 기반 태그 적용
    this.applyPatternTags(event, taggingResult);
    
    return taggingResult;
  }
  
  /**
   * 여러 이벤트에 태그 일괄 부착
   */
  public async tagEvents(events: ParsedEvent[]): Promise<TaggingResult[]> {
    const results: TaggingResult[] = [];
    
    for (const event of events) {
      const result = await this.tagEvent(event);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * 텍스트에서 질병 코드 탐지 및 DX_CONFIRMED 태그 부착
   */
  private async detectDiseaseCodes(event: ParsedEvent, result: TaggingResult): Promise<void> {
    // 질병 코드 인덱스가 초기화되지 않은 경우 초기화
    await diseaseCodeIndex.initialize();
    
    // 텍스트에서 질병 코드 추출
    const matchedCodes = await diseaseCodeIndex.extractCodesFromText(event.rawText);
    
    if (matchedCodes.length > 0) {
      // DX_CONFIRMED 태그 추가
      if (!event.tags.includes(TAG_TYPES.DX_CONFIRMED)) {
        event.tags.push(TAG_TYPES.DX_CONFIRMED);
        result.addedTags.push(TAG_TYPES.DX_CONFIRMED);
      }
      
      // 매칭된 코드 저장
      result.matchedCodes = matchedCodes;
    }
  }
  
  /**
   * 패턴 기반 태그 부착
   */
  private applyPatternTags(event: ParsedEvent, result: TaggingResult): void {
    const text = event.rawText.toLowerCase();
    
    // DX_CONFIRMED를 제외한 모든 태그에 대해 패턴 검사
    for (const [tagType, patterns] of Object.entries(this.tagPatterns)) {
      if (tagType === TAG_TYPES.DX_CONFIRMED) continue; // 이미 처리됨
      
      const matchedExpressions: string[] = [];
      
      // 모든 패턴 검사
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          matchedExpressions.push(...matches);
          
          // 태그가 아직 추가되지 않은 경우 추가
          if (!event.tags.includes(tagType)) {
            event.tags.push(tagType);
            result.addedTags.push(tagType);
          }
        }
      }
      
      // 매칭된 표현 저장
      if (matchedExpressions.length > 0) {
        result.matchedPatterns[tagType] = Array.from(new Set(matchedExpressions));
      }
    }
    
    // 제외/중요 태그 적용
    if (isExcluded(event)) {
      if (!event.tags.includes(TAG_TYPES.EXCLUDE)) {
        event.tags.push(TAG_TYPES.EXCLUDE);
        result.addedTags.push(TAG_TYPES.EXCLUDE);
      }
    }
    
    if (isImportant(event)) {
      if (!event.tags.includes(TAG_TYPES.IMPORTANT)) {
        event.tags.push(TAG_TYPES.IMPORTANT);
        result.addedTags.push(TAG_TYPES.IMPORTANT);
      }
    }
  }
  
  /**
   * 태그 제거
   */
  public removeTags(event: ParsedEvent, tagsToRemove: string[]): string[] {
    if (!event.tags) {
      event.tags = [];
      return [];
    }
    
    const removedTags: string[] = [];
    
    for (const tag of tagsToRemove) {
      const index = event.tags.indexOf(tag);
      if (index !== -1) {
        event.tags.splice(index, 1);
        removedTags.push(tag);
      }
    }
    
    return removedTags;
  }
  
  /**
   * 태그 수동 추가
   */
  public addTags(event: ParsedEvent, tagsToAdd: string[]): string[] {
    if (!event.tags) {
      event.tags = [];
    }
    
    const addedTags: string[] = [];
    
    for (const tag of tagsToAdd) {
      if (!Object.values(TAG_TYPES).includes(tag)) {
        console.warn(`유효하지 않은 태그: ${tag}`);
        continue;
      }
      
      if (!event.tags.includes(tag)) {
        event.tags.push(tag);
        addedTags.push(tag);
      }
    }
    
    return addedTags;
  }

  // 진단 태그 추가
  private addDiagnosisTag(event: ParsedEvent): void {
    // 진단 관련 패턴
    const diagnosisPatterns = [
      /진단(\s|:|：|）|)/,
      /dx|diagnosis/i,
      /진찰(\s|:|：|）|)소견/,
      /진찰 (결과|소견)/,
      /(진단명|상병명|상병코드)(\s|:|：|）|)/,
      /assessment/i
    ];
    
    // 확진 패턴
    const confirmedPatterns = [
      /확진/,
      /(최종|최초|) *(진단|소견|결과)/,
      /병명/,
      /(?<!\S)(A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z)\d{2}/
    ];
    
    // 이벤트 텍스트
    const text = event.rawText.toLowerCase();
    
    // 진단 패턴 확인
    const hasDiagnosisPattern = diagnosisPatterns.some(pattern => pattern.test(text));
    
    // 확진 패턴 확인
    const hasConfirmedPattern = confirmedPatterns.some(pattern => pattern.test(text));
    
    // 태그 배열이 없으면 초기화
    if (!event.tags) {
      event.tags = [];
    }
    
    // 진단 태그 추가
    if (hasDiagnosisPattern) {
      if (!event.tags.includes(TAG_TYPES.DX_GENERAL)) {
        event.tags.push(TAG_TYPES.DX_GENERAL);
      }
    }
    
    // 확진 태그 추가
    if (hasConfirmedPattern) {
      if (!event.tags.includes(TAG_TYPES.DX_CONFIRMED)) {
        event.tags.push(TAG_TYPES.DX_CONFIRMED);
      }
    }
  }
}

// 싱글톤 인스턴스
export const eventTagger = new EventTagger();

export default eventTagger; 