/**
 * Smart Chunker - Zero-Loss Intelligent Text Processing
 * 
 * 혁신적 특징:
 * 1. 텍스트를 절대 버리지 않으면서도 관련성 기반 우선순위 처리
 * 2. 동적 청크 크기 조절로 컨텍스트 보존
 * 3. 의료-보험 도메인 특화 관련성 스코어링
 */

import TextFilter from '../lib/textFilter';

// 임시 embeddingSearch 함수 (RAG 모듈이 구현될 때까지)
const embeddingSearch = async (text: string, limit: number): Promise<string[]> => {
  // 임시 구현 - 빈 배열 반환
  return [];
};

export interface SmartChunk {
  idx: number;
  raw: string;
  processedText: string;
  firstDate: string | null;
  lastDate: string | null;
  institutions: string[];
  diagnosisCodes: string[];
  relevanceScore: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  eventTypes: string[];
  ragHits: string[];
  metadata: {
    tokenCount: number;
    hasImportantKeywords: boolean;
    dateRange: { start: Date | null; end: Date | null };
    medicalComplexity: number;
  };
}

export interface ChunkingConfig {
  maxTokensPerChunk: number;
  minTokensPerChunk: number;
  overlapTokens: number;
  maxChunkSize?: number;
  overlapSize?: number;
  enableSmartSplitting?: boolean;
  claimDate?: string;
  insuranceType?: string;
  priorityKeywords: string[];
}

export class SmartChunker {
  private textFilter: typeof TextFilter;
  private config: ChunkingConfig;
  
  // 의료-보험 특화 키워드 사전
  private readonly MEDICAL_KEYWORDS = {
    HIGH_PRIORITY: [
      '암', '종양', '악성', '전이', '수술', '입원', '응급', '중환자',
      '심근경색', '뇌경색', '뇌출혈', '당뇨', '고혈압', '간경화'
    ],
    MEDIUM_PRIORITY: [
      '진단', '검사', '치료', '처방', '외래', '재진', '경과관찰',
      'CT', 'MRI', '초음파', '내시경', '혈액검사'
    ],
    INSURANCE_KEYWORDS: [
      '가입', '보장개시', '청구', '보험금', '면책', '심사', '사정',
      '특약', '주계약', '갱신', '해지', '만기'
    ]
  };

  private readonly DATE_PATTERNS = [
    /\d{4}[-.]\d{1,2}[-.]\d{1,2}/g,
    /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
    /\d{1,2}[-.]\d{1,2}[-.]\d{4}/g
  ];

  private readonly DIAGNOSIS_CODE_PATTERN = /([A-Z]\d{2})(\.\d{1,2})?/g;
  private readonly INSTITUTION_PATTERNS = [
    /(\S+대학교병원)/g,
    /(\S+병원)/g,
    /(\S+의원)/g,
    /(\S+클리닉)/g,
    /(\S+센터)/g,
    /(\S+손해보험)/g
  ];

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      maxTokensPerChunk: 4000,
      minTokensPerChunk: 1000,
      overlapTokens: 200,
      priorityKeywords: [],
      ...config
    };
    this.textFilter = TextFilter;
  }

  /**
   * 메인 청킹 함수 - Zero-Loss 원칙으로 텍스트 분할
   */
  async chunkText(rawText: string): Promise<SmartChunk[]> {
    const paragraphs = this.splitIntoParagraphs(rawText);
    const chunks: SmartChunk[] = [];
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const estimatedTokens = this.estimateTokenCount(currentChunk + paragraph);
      
      // 청크 크기 초과 시 현재 청크 완료
      if (estimatedTokens > this.config.maxTokensPerChunk && currentChunk.length > 0) {
        const chunk = await this.createSmartChunk(currentChunk, chunkIndex);
        chunks.push(chunk);
        
        // 오버랩 처리
        currentChunk = this.createOverlap(currentChunk) + paragraph;
        chunkIndex++;
      } else {
        currentChunk += paragraph + '\n';
      }
    }
    
    // 마지막 청크 처리
    if (currentChunk.trim().length > 0) {
      const chunk = await this.createSmartChunk(currentChunk, chunkIndex);
      chunks.push(chunk);
    }
    
    // 관련성 스코어 기반 우선순위 설정
    return this.prioritizeChunks(chunks);
  }

  /**
   * 스마트 청크 생성 - 메타데이터와 관련성 분석 포함
   */
  private async createSmartChunk(text: string, index: number): Promise<SmartChunk> {
    const processedText = await this.textFilter.filterText([{ text, pageIndex: 1 }]);
    const dates = this.extractDates(text);
    const institutions = this.extractInstitutions(text);
    const diagnosisCodes = this.extractDiagnosisCodes(text);
    const eventTypes = this.inferEventTypes(text);
    
    // RAG 검색으로 관련 의료 용어 찾기
    const ragHits = await this.performRAGSearch(text);
    
    // 관련성 스코어 계산
    const relevanceScore = this.calculateRelevanceScore(text, dates, diagnosisCodes, institutions);
    
    // 의료 복잡도 계산
    const medicalComplexity = this.calculateMedicalComplexity(text, diagnosisCodes, eventTypes);
    
    return {
      idx: index,
      raw: text,
      processedText: processedText[0]?.text || text,
      firstDate: dates.length > 0 ? dates[0] : null,
      lastDate: dates.length > 0 ? dates[dates.length - 1] : null,
      institutions,
      diagnosisCodes,
      relevanceScore,
      priority: this.determinePriority(relevanceScore, diagnosisCodes, eventTypes),
      eventTypes,
      ragHits,
      metadata: {
        tokenCount: this.estimateTokenCount(text),
        hasImportantKeywords: this.hasImportantKeywords(text),
        dateRange: this.getDateRange(dates),
        medicalComplexity
      }
    };
  }

  /**
   * 관련성 스코어 계산 - 보험 심사 관점 최적화
   */
  private calculateRelevanceScore(text: string, dates: string[], diagnosisCodes: string[], institutions: string[]): number {
    let score = 0;
    
    // 날짜 관련성 (가입일 기준)
    if (this.config.claimDate && dates.length > 0) {
      const claimDate = new Date(this.config.claimDate);
      const relevantDates = dates.filter(dateStr => {
        const date = new Date(dateStr);
        const daysDiff = Math.abs((claimDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 1825; // 5년 이내
      });
      
      if (relevantDates.length > 0) {
        score += 0.3;
        // 최근 3개월 이내면 추가 점수
        const recentDates = relevantDates.filter(dateStr => {
          const date = new Date(dateStr);
          const daysDiff = Math.abs((claimDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff <= 90;
        });
        if (recentDates.length > 0) score += 0.2;
      }
    }
    
    // 진단 코드 중요도
    const importantCodes = diagnosisCodes.filter(code => 
      code.startsWith('C') || // 암
      code.startsWith('I2') || // 심장질환
      code.startsWith('I6') || // 뇌혈관질환
      code.startsWith('E1') // 당뇨
    );
    if (importantCodes.length > 0) score += 0.4;
    
    // 키워드 매칭
    const highPriorityMatches = this.MEDICAL_KEYWORDS.HIGH_PRIORITY.filter(keyword => 
      text.includes(keyword)
    ).length;
    score += Math.min(highPriorityMatches * 0.1, 0.3);
    
    // 보험 관련 키워드
    const insuranceMatches = this.MEDICAL_KEYWORDS.INSURANCE_KEYWORDS.filter(keyword => 
      text.includes(keyword)
    ).length;
    if (insuranceMatches > 0) score += 0.2;
    
    return Math.min(score, 1.0);
  }

  /**
   * 의료 복잡도 계산
   */
  private calculateMedicalComplexity(text: string, diagnosisCodes: string[], eventTypes: string[]): number {
    let complexity = 0;
    
    // 진단 코드 수
    complexity += diagnosisCodes.length * 0.1;
    
    // 이벤트 유형 다양성
    complexity += eventTypes.length * 0.15;
    
    // 의학 용어 밀도
    const medicalTerms = [...this.MEDICAL_KEYWORDS.HIGH_PRIORITY, ...this.MEDICAL_KEYWORDS.MEDIUM_PRIORITY];
    const termCount = medicalTerms.filter(term => text.includes(term)).length;
    complexity += termCount * 0.05;
    
    return Math.min(complexity, 1.0);
  }

  /**
   * 우선순위 결정
   */
  private determinePriority(relevanceScore: number, diagnosisCodes: string[], eventTypes: string[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (relevanceScore >= 0.7) return 'HIGH';
    if (relevanceScore >= 0.4) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 청크 우선순위 재정렬
   */
  private prioritizeChunks(chunks: SmartChunk[]): SmartChunk[] {
    return chunks.sort((a, b) => {
      // 우선순위 순서: HIGH > MEDIUM > LOW
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      // 같은 우선순위면 관련성 스코어 순
      return b.relevanceScore - a.relevanceScore;
    });
  }

  // 유틸리티 메서드들
  private splitIntoParagraphs(text: string): string[] {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4); // 대략적인 토큰 추정
  }

  private extractDates(text: string): string[] {
    const dates: string[] = [];
    this.DATE_PATTERNS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) dates.push(...matches);
    });
    return [...new Set(dates)];
  }

  private extractInstitutions(text: string): string[] {
    const institutions: string[] = [];
    this.INSTITUTION_PATTERNS.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) institutions.push(...matches);
    });
    return [...new Set(institutions)];
  }

  private extractDiagnosisCodes(text: string): string[] {
    const codes: string[] = [];
    let match;
    while ((match = this.DIAGNOSIS_CODE_PATTERN.exec(text)) !== null) {
      codes.push(match[0]);
    }
    return [...new Set(codes)];
  }

  private inferEventTypes(text: string): string[] {
    const types: string[] = [];
    if (/(입원|퇴원)/.test(text)) types.push('HOSPITALIZATION');
    if (/(수술|시술)/.test(text)) types.push('SURGERY');
    if (/(진단|소견)/.test(text)) types.push('DIAGNOSIS');
    if (/(검사|촬영)/.test(text)) types.push('EXAMINATION');
    if (/(치료|요법)/.test(text)) types.push('TREATMENT');
    if (/(처방|약물)/.test(text)) types.push('MEDICATION');
    if (/(보험|가입|청구)/.test(text)) types.push('INSURANCE');
    return types;
  }

  private hasImportantKeywords(text: string): boolean {
    return this.MEDICAL_KEYWORDS.HIGH_PRIORITY.some(keyword => text.includes(keyword));
  }

  private getDateRange(dates: string[]): { start: Date | null; end: Date | null } {
    if (dates.length === 0) return { start: null, end: null };
    
    const parsedDates = dates.map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
    if (parsedDates.length === 0) return { start: null, end: null };
    
    return {
      start: new Date(Math.min(...parsedDates.map(d => d.getTime()))),
      end: new Date(Math.max(...parsedDates.map(d => d.getTime())))
    };
  }

  private createOverlap(text: string): string {
    const sentences = text.split(/[.!?]\s+/);
    const overlapSentences = sentences.slice(-2); // 마지막 2문장 오버랩
    return overlapSentences.join('. ') + (overlapSentences.length > 0 ? '. ' : '');
  }

  private async performRAGSearch(text: string): Promise<string[]> {
    try {
      // RAG 검색 구현 (기존 embeddingSearch 활용)
      return await embeddingSearch(text, 3) || [];
    } catch (error) {
      console.warn('RAG search failed:', error);
      return [];
    }
  }
}

export default SmartChunker;