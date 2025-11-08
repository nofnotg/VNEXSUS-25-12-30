/**
 * Hybrid NER Pipeline - 로컬 NER + GPT Anchor Judge 통합 시스템
 * 
 * 혁신적 특징:
 * 1. 로컬 LoRA NER로 1차 필터링하여 비용 절감
 * 2. GPT-4o Anchor Judge로 복잡한 컨텍스트 판단
 * 3. 의료-보험 도메인 특화 이벤트 추출
 */

import { MedicalGeneExtractor } from '../../backend/services/core-engine/enhanced/geneExtractor.cjs';
import { SmartChunk } from './smartChunker';

export interface MedicalEvent {
  id: string;
  serviceDate: string;
  recordDate?: string;
  institution: string;
  eventType: EventType;
  description: string;
  diagnosisCodes: DiagnosisInfo[];
  procedures: ProcedureInfo[];
  medications: MedicationInfo[];
  anchors: AnchorInfo;
  confidence: number;
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  insuranceRelevance: number;
  rawText: string;
}

export interface DiagnosisInfo {
  code: string;
  name: string;
  category: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
}

export interface ProcedureInfo {
  code?: string;
  name: string;
  type: 'SURGERY' | 'EXAMINATION' | 'TREATMENT' | 'OTHER';
}

export interface MedicationInfo {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

export interface AnchorInfo {
  temporal: string[];
  spatial: string[];
  medical: string[];
  causal: string[];
  isAnchorBlock: boolean;
  anchorConfidence: number;
}

export type EventType = 
  | 'MEDICAL_VISIT'
  | 'DIAGNOSIS' 
  | 'EXAMINATION'
  | 'HOSPITALIZATION'
  | 'SURGERY'
  | 'MEDICATION'
  | 'TREATMENT'
  | 'INSURANCE'
  | 'CLAIM'
  | 'OTHER';

export interface NERResult {
  entities: {
    dates: string[];
    institutions: string[];
    diagnoses: string[];
    procedures: string[];
    medications: string[];
    persons: string[];
  };
  confidence: number;
}

export interface AnchorJudgment {
  isAnchor: boolean;
  anchorType: 'TEMPORAL' | 'SPATIAL' | 'MEDICAL' | 'CAUSAL' | 'NONE';
  confidence: number;
  reason: string;
  suggestedEventType: EventType;
}

export class HybridNER {
  private geneExtractor: MedicalGeneExtractor;
  
  // 로컬 NER 패턴 (LoRA 모델 대체용 규칙 기반)
  private readonly NER_PATTERNS = {
    DATES: [
      /\d{4}[-.]\d{1,2}[-.]\d{1,2}/g,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
      /\d{1,2}[-.]\d{1,2}[-.]\d{4}/g
    ],
    INSTITUTIONS: [
      /(\S+대학교병원)/g,
      /(\S+병원)/g,
      /(\S+의원)/g,
      /(\S+클리닉)/g,
      /(\S+센터)/g,
      /(\S+손해보험)/g
    ],
    DIAGNOSIS_CODES: /([A-Z]\d{2})(\.\d{1,2})?/g,
    MEDICATIONS: [
      /(\S+정)/g,
      /(\S+캡슐)/g,
      /(\S+시럽)/g,
      /(\S+주사)/g
    ],
    PROCEDURES: [
      /(CT|MRI|초음파|내시경|X-ray|엑스레이)\s*검사/g,
      /(수술|시술|절제술|이식술)/g,
      /(생검|조직검사)/g
    ]
  };

  // 중요 질환 분류
  private readonly CRITICAL_DIAGNOSES = {
    'C': 'CRITICAL', // 암
    'I21': 'CRITICAL', // 심근경색
    'I63': 'CRITICAL', // 뇌경색
    'I61': 'CRITICAL', // 뇌출혈
    'E10': 'MAJOR', // 제1형 당뇨
    'E11': 'MAJOR', // 제2형 당뇨
    'I10': 'MAJOR', // 고혈압
    'J45': 'MAJOR'  // 천식
  };

  // Anchor Judge 프롬프트
  private readonly ANCHOR_JUDGE_PROMPT = `
당신은 의료 문서 분석 전문가입니다. 주어진 문장이 새로운 의료 이벤트의 시작점(Anchor)인지 판단해주세요.

Anchor 판단 기준:
1. TEMPORAL: 새로운 날짜나 시간 정보가 포함된 경우
2. SPATIAL: 새로운 병원이나 진료과 정보가 나타난 경우  
3. MEDICAL: 새로운 진단, 검사, 치료가 시작되는 경우
4. CAUSAL: 이전 이벤트와 인과관계가 있는 새로운 사건

응답 형식:
{
  "isAnchor": boolean,
  "anchorType": "TEMPORAL|SPATIAL|MEDICAL|CAUSAL|NONE",
  "confidence": 0.0-1.0,
  "reason": "판단 근거",
  "suggestedEventType": "이벤트 유형"
}
`;

  constructor() {
    this.geneExtractor = new MedicalGeneExtractor();
  }

  /**
   * 메인 하이브리드 NER 처리 함수
   */
  async processChunks(chunks: SmartChunk[]): Promise<MedicalEvent[]> {
    const events: MedicalEvent[] = [];
    
    for (const chunk of chunks) {
      try {
        // 1단계: 로컬 NER로 기본 엔티티 추출
        const nerResult = await this.performLocalNER(chunk.raw);
        
        // 2단계: 문장 단위로 분할하여 Anchor 판단
        const sentences = this.splitIntoSentences(chunk.raw);
        const anchorResults = await this.performAnchorJudgment(sentences);
        
        // 3단계: 이벤트 구성 및 병합
        const chunkEvents = await this.constructEvents(
          chunk, 
          nerResult, 
          anchorResults, 
          sentences
        );
        
        events.push(...chunkEvents);
      } catch (error) {
        console.error(`Error processing chunk ${chunk.idx}:`, error);
        // 에러 발생 시 기본 이벤트 생성
        const fallbackEvent = this.createFallbackEvent(chunk);
        events.push(fallbackEvent);
      }
    }
    
    // 4단계: 이벤트 병합 및 정제
    return this.mergeAndRefineEvents(events);
  }

  /**
   * 로컬 NER 수행 (LoRA 모델 시뮬레이션)
   */
  private async performLocalNER(text: string): Promise<NERResult> {
    const entities = {
      dates: this.extractByPatterns(text, this.NER_PATTERNS.DATES),
      institutions: this.extractByPatterns(text, this.NER_PATTERNS.INSTITUTIONS),
      diagnoses: this.extractDiagnosisCodes(text),
      procedures: this.extractByPatterns(text, this.NER_PATTERNS.PROCEDURES),
      medications: this.extractByPatterns(text, this.NER_PATTERNS.MEDICATIONS),
      persons: this.extractPersonNames(text)
    };
    
    // 추출된 엔티티 수를 기반으로 신뢰도 계산
    const totalEntities = Object.values(entities).reduce((sum, arr) => sum + arr.length, 0);
    const confidence = Math.min(totalEntities * 0.1, 0.9);
    
    return { entities, confidence };
  }

  /**
   * GPT-4o를 활용한 Anchor 판단
   */
  private async performAnchorJudgment(sentences: string[]): Promise<AnchorJudgment[]> {
    const judgments: AnchorJudgment[] = [];
    
    for (const sentence of sentences) {
      try {
        // GPT-4o 함수 호출 모드로 Anchor 판단
        const prompt = `${this.ANCHOR_JUDGE_PROMPT}\n\n분석할 문장: "${sentence}"`;
        
        const response = await this.geneExtractor.callOpenAIApi([
          { role: 'system', content: this.ANCHOR_JUDGE_PROMPT },
          { role: 'user', content: `분석할 문장: "${sentence}"` }
        ]);
        
        const judgment = this.parseAnchorJudgment(response);
        judgments.push(judgment);
        
      } catch (error) {
        console.warn(`Anchor judgment failed for sentence: ${sentence}`, error);
        // 실패 시 기본 판단
        judgments.push({
          isAnchor: false,
          anchorType: 'NONE',
          confidence: 0.1,
          reason: 'Analysis failed',
          suggestedEventType: 'OTHER'
        });
      }
    }
    
    return judgments;
  }

  /**
   * 이벤트 구성 및 생성
   */
  private async constructEvents(
    chunk: SmartChunk,
    nerResult: NERResult,
    anchorResults: AnchorJudgment[],
    sentences: string[]
  ): Promise<MedicalEvent[]> {
    const events: MedicalEvent[] = [];
    let currentEvent: Partial<MedicalEvent> | null = null;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const anchorResult = anchorResults[i];
      
      // 새로운 Anchor 발견 시 이전 이벤트 완료 및 새 이벤트 시작
      if (anchorResult.isAnchor && anchorResult.confidence > 0.5) {
        if (currentEvent) {
          const completedEvent = this.finalizeEvent(currentEvent, chunk);
          if (completedEvent) events.push(completedEvent);
        }
        
        currentEvent = this.initializeEvent(sentence, anchorResult, nerResult, chunk);
      } else if (currentEvent) {
        // 기존 이벤트에 정보 추가
        this.appendToEvent(currentEvent, sentence, nerResult);
      } else {
        // 첫 번째 이벤트 생성
        currentEvent = this.initializeEvent(sentence, anchorResult, nerResult, chunk);
      }
    }
    
    // 마지막 이벤트 완료
    if (currentEvent) {
      const completedEvent = this.finalizeEvent(currentEvent, chunk);
      if (completedEvent) events.push(completedEvent);
    }
    
    return events;
  }

  /**
   * 이벤트 초기화
   */
  private initializeEvent(
    sentence: string,
    anchorResult: AnchorJudgment,
    nerResult: NERResult,
    chunk: SmartChunk
  ): Partial<MedicalEvent> {
    const dates = nerResult.entities.dates;
    const institutions = nerResult.entities.institutions;
    
    return {
      id: this.generateEventId(sentence, dates[0] || 'unknown'),
      serviceDate: dates[0] || chunk.firstDate || new Date().toISOString().split('T')[0],
      institution: institutions[0] || '알 수 없음',
      eventType: anchorResult.suggestedEventType,
      description: sentence,
      diagnosisCodes: [],
      procedures: [],
      medications: [],
      anchors: {
        temporal: [],
        spatial: [],
        medical: [],
        causal: [],
        isAnchorBlock: anchorResult.isAnchor,
        anchorConfidence: anchorResult.confidence
      },
      confidence: anchorResult.confidence,
      rawText: sentence
    };
  }

  /**
   * 이벤트에 정보 추가
   */
  private appendToEvent(
    event: Partial<MedicalEvent>,
    sentence: string,
    nerResult: NERResult
  ): void {
    event.description += ' ' + sentence;
    event.rawText += ' ' + sentence;
    
    // 진단 코드 추가
    const newDiagnoses = nerResult.entities.diagnoses.map(code => ({
      code,
      name: this.getDiagnosisName(code),
      category: this.getDiagnosisCategory(code),
      severity: this.getDiagnosisSeverity(code)
    }));
    
    if (event.diagnosisCodes) {
      event.diagnosisCodes.push(...newDiagnoses);
    }
    
    // 시술/검사 추가
    const newProcedures = nerResult.entities.procedures.map(proc => ({
      name: proc,
      type: this.inferProcedureType(proc)
    }));
    
    if (event.procedures) {
      event.procedures.push(...newProcedures);
    }
    
    // 약물 추가
    const newMedications = nerResult.entities.medications.map(med => ({
      name: med
    }));
    
    if (event.medications) {
      event.medications.push(...newMedications);
    }
  }

  /**
   * 이벤트 완료 처리
   */
  private finalizeEvent(
    partialEvent: Partial<MedicalEvent>,
    chunk: SmartChunk
  ): MedicalEvent | null {
    if (!partialEvent.id || !partialEvent.serviceDate) {
      return null;
    }
    
    // 중요도 계산
    const importance = this.calculateEventImportance(
      partialEvent.diagnosisCodes || [],
      partialEvent.eventType || 'OTHER'
    );
    
    // 보험 관련성 계산
    const insuranceRelevance = this.calculateInsuranceRelevance(
      partialEvent.description || '',
      partialEvent.diagnosisCodes || []
    );
    
    return {
      id: partialEvent.id,
      serviceDate: partialEvent.serviceDate,
      recordDate: partialEvent.recordDate,
      institution: partialEvent.institution || '알 수 없음',
      eventType: partialEvent.eventType || 'OTHER',
      description: partialEvent.description || '',
      diagnosisCodes: partialEvent.diagnosisCodes || [],
      procedures: partialEvent.procedures || [],
      medications: partialEvent.medications || [],
      anchors: partialEvent.anchors || {
        temporal: [],
        spatial: [],
        medical: [],
        causal: [],
        isAnchorBlock: false,
        anchorConfidence: 0
      },
      confidence: partialEvent.confidence || 0.5,
      importance,
      insuranceRelevance,
      rawText: partialEvent.rawText || ''
    };
  }

  /**
   * 이벤트 병합 및 정제
   */
  private mergeAndRefineEvents(events: MedicalEvent[]): MedicalEvent[] {
    // 날짜와 기관이 같은 이벤트들을 병합
    const mergedEvents = new Map<string, MedicalEvent>();
    
    for (const event of events) {
      const mergeKey = `${event.serviceDate}_${event.institution}_${event.eventType}`;
      
      if (mergedEvents.has(mergeKey)) {
        const existing = mergedEvents.get(mergeKey)!;
        // 기존 이벤트와 병합
        existing.description += ' ' + event.description;
        existing.diagnosisCodes.push(...event.diagnosisCodes);
        existing.procedures.push(...event.procedures);
        existing.medications.push(...event.medications);
        existing.rawText += ' ' + event.rawText;
        existing.confidence = Math.max(existing.confidence, event.confidence);
      } else {
        mergedEvents.set(mergeKey, { ...event });
      }
    }
    
    // 날짜순 정렬
    return Array.from(mergedEvents.values()).sort((a, b) => 
      new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime()
    );
  }

  // 유틸리티 메서드들
  private splitIntoSentences(text: string): string[] {
    return text.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
  }

  private extractByPatterns(text: string, patterns: RegExp[]): string[] {
    const results: string[] = [];
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) results.push(...matches);
    });
    return [...new Set(results)];
  }

  private extractDiagnosisCodes(text: string): string[] {
    const codes: string[] = [];
    let match;
    while ((match = this.NER_PATTERNS.DIAGNOSIS_CODES.exec(text)) !== null) {
      codes.push(match[0]);
    }
    return [...new Set(codes)];
  }

  private extractPersonNames(text: string): string[] {
    // 간단한 한국어 이름 패턴
    const namePattern = /[가-힣]{2,4}\s*(의사|원장|교수|과장)/g;
    const matches = text.match(namePattern);
    return matches ? matches.map(m => m.replace(/(의사|원장|교수|과장)/g, '').trim()) : [];
  }

  private parseAnchorJudgment(response: string): AnchorJudgment {
    try {
      const parsed = JSON.parse(response);
      return {
        isAnchor: parsed.isAnchor || false,
        anchorType: parsed.anchorType || 'NONE',
        confidence: parsed.confidence || 0.1,
        reason: parsed.reason || '',
        suggestedEventType: parsed.suggestedEventType || 'OTHER'
      };
    } catch (error) {
      return {
        isAnchor: false,
        anchorType: 'NONE',
        confidence: 0.1,
        reason: 'Parse error',
        suggestedEventType: 'OTHER'
      };
    }
  }

  private generateEventId(text: string, date: string): string {
    const hash = this.simpleHash(text + date);
    return `event_${date.replace(/[-./]/g, '')}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private getDiagnosisName(code: string): string {
    // 실제 구현에서는 KCD/ICD 데이터베이스 조회
    const commonDiagnoses: { [key: string]: string } = {
      'C78': '이차성 악성 신생물',
      'I21': '급성 심근경색증',
      'I63': '뇌경색증',
      'E11': '제2형 당뇨병',
      'I10': '본태성 고혈압'
    };
    return commonDiagnoses[code] || code;
  }

  private getDiagnosisCategory(code: string): string {
    if (code.startsWith('C')) return '신생물';
    if (code.startsWith('I')) return '순환계통 질환';
    if (code.startsWith('E')) return '내분비, 영양 및 대사 질환';
    if (code.startsWith('J')) return '호흡계통 질환';
    return '기타';
  }

  private getDiagnosisSeverity(code: string): 'CRITICAL' | 'MAJOR' | 'MINOR' {
    for (const [pattern, severity] of Object.entries(this.CRITICAL_DIAGNOSES)) {
      if (code.startsWith(pattern)) {
        return severity as 'CRITICAL' | 'MAJOR' | 'MINOR';
      }
    }
    return 'MINOR';
  }

  private inferProcedureType(procedure: string): 'SURGERY' | 'EXAMINATION' | 'TREATMENT' | 'OTHER' {
    if (/(수술|시술|절제|이식)/.test(procedure)) return 'SURGERY';
    if (/(검사|촬영|내시경)/.test(procedure)) return 'EXAMINATION';
    if (/(치료|요법)/.test(procedure)) return 'TREATMENT';
    return 'OTHER';
  }

  private calculateEventImportance(
    diagnosisCodes: DiagnosisInfo[],
    eventType: EventType
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    // 중요 진단이 있으면 HIGH
    if (diagnosisCodes.some(d => d.severity === 'CRITICAL')) return 'HIGH';
    
    // 수술, 입원은 HIGH
    if (['SURGERY', 'HOSPITALIZATION'].includes(eventType)) return 'HIGH';
    
    // 주요 진단이나 치료는 MEDIUM
    if (diagnosisCodes.some(d => d.severity === 'MAJOR') || 
        ['DIAGNOSIS', 'TREATMENT'].includes(eventType)) return 'MEDIUM';
    
    return 'LOW';
  }

  private calculateInsuranceRelevance(
    description: string,
    diagnosisCodes: DiagnosisInfo[]
  ): number {
    let relevance = 0;
    
    // 보험 관련 키워드
    if (/(보험|가입|청구|심사)/.test(description)) relevance += 0.4;
    
    // 중요 질환
    if (diagnosisCodes.some(d => d.severity === 'CRITICAL')) relevance += 0.3;
    
    // 수술, 입원 관련
    if (/(수술|입원|응급)/.test(description)) relevance += 0.3;
    
    return Math.min(relevance, 1.0);
  }

  private createFallbackEvent(chunk: SmartChunk): MedicalEvent {
    return {
      id: `fallback_${chunk.idx}`,
      serviceDate: chunk.firstDate || new Date().toISOString().split('T')[0],
      institution: chunk.institutions[0] || '알 수 없음',
      eventType: 'OTHER',
      description: chunk.raw.substring(0, 200) + '...',
      diagnosisCodes: [],
      procedures: [],
      medications: [],
      anchors: {
        temporal: [],
        spatial: [],
        medical: [],
        causal: [],
        isAnchorBlock: false,
        anchorConfidence: 0.1
      },
      confidence: 0.1,
      importance: 'LOW',
      insuranceRelevance: 0.1,
      rawText: chunk.raw
    };
  }
}

export default HybridNER;