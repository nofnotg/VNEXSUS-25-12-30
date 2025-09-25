/**
 * Enhanced Massive Date Block Processor Module
 * 
 * 개선 사항:
 * 1. 실제 Case 파일 패턴 분석 기반 정규식 개선
 * 2. 3단계 계층적 처리 방식 최적화
 * 3. 의료 문서 특화 컨텍스트 분석 강화
 * 4. 메모리 효율성 및 성능 최적화
 * 5. 실제 데이터 검증 기반 신뢰도 계산 개선
 */

class EnhancedMassiveDateBlockProcessor {
  constructor() {
    // 실제 Case 파일 분석 기반 개선된 패턴
    this.enhancedDatePatterns = {
      // Level 1: 문서 구조 패턴 (대규모 블록)
      documentStructure: {
        // 의료기록 헤더 블록 (병원명, 환자정보 포함)
        medicalHeaderBlock: /(?:병원|의원|클리닉|센터|한의원)[^\n]*\n[\s\S]*?(?=\d{4}[-\/.년]|$)/gi,
        // 날짜별 진료 섹션 (개선된 패턴)
        dateBasedSection: /(?:\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)[\s\S]*?(?=(?:\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)|$)/gi,
        // 보험 관련 블록
        insuranceBlock: /(?:보험|가입|청구|지급)[\s\S]*?(?=\n\s*\n|$)/gi
      },
      
      // Level 2: 중간 크기 의료 행위 블록
      mediumBlocks: {
        // 입원/퇴원 기간 블록 (실제 패턴 반영)
        hospitalizationBlock: /(?:입원|퇴원|병동|응급실)\s*[:：]?\s*\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?[\s\S]*?(?=(?:입원|퇴원|\d{4}[-\/.년])|$)/gi,
        // 수술/시술 블록
        surgeryBlock: /(?:수술|시술|처치|마취|절제|적출)\s*[:：]?[\s\S]*?(?=(?:수술|시술|처치|\d{4}[-\/.년])|$)/gi,
        // 검사 결과 블록 (영상, 혈액, 조직검사 등)
        testBlock: /(?:검사|촬영|CT|MRI|초음파|X-ray|혈액|소변|조직|병리)\s*[:：]?[\s\S]*?(?=(?:검사|촬영|\d{4}[-\/.년])|$)/gi,
        // 진단 블록
        diagnosisBlock: /(?:진단|병명|질환|증상|소견)\s*[:：]?[\s\S]*?(?=(?:진단|치료|\d{4}[-\/.년])|$)/gi,
        // 처방/투약 블록
        prescriptionBlock: /(?:처방|투약|복용|약물|medication)\s*[:：]?[\s\S]*?(?=(?:처방|투약|\d{4}[-\/.년])|$)/gi
      },
      
      // Level 3: 세부 날짜 패턴 (정밀도 향상)
      detailedPatterns: {
        // 표준 날짜 형식들
        standardDate: /\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?/g,
        // 한국어 날짜
        koreanDate: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
        // 의료 특화 날짜 (진료일, 검사일 등)
        medicalSpecificDate: /(?:진료일|검사일|수술일|입원일|퇴원일|처방일)\s*[:：]?\s*\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?/g,
        // 상대 날짜 표현
        relativeDate: /(?:오늘|어제|내일|이번주|지난주|다음주|\d+일\s*전|\d+일\s*후|\d+개월\s*전|\d+개월\s*후|\d+년\s*전|\d+년\s*후)/g
      }
    };

    // 의료 키워드 (실제 Case 파일 기반)
    this.medicalKeywords = {
      high: ['수술', '입원', '퇴원', '응급', '중환자실', 'ICU', '마취', '절제', '적출'],
      medium: ['진료', '검사', '촬영', '처방', '투약', '치료', '진단', '소견'],
      low: ['상담', '예약', '접수', '수납', '대기']
    };

    // 노이즈 패턴 (제거할 무의미한 텍스트)
    this.noisePatterns = [
      /^\s*[-=_]{3,}\s*$/gm,  // 구분선
      /^\s*\*{3,}\s*$/gm,     // 별표 구분선
      /^\s*#{3,}\s*$/gm,      // 해시 구분선
      /^\s*페이지\s*\d+\s*$/gm, // 페이지 번호
      /^\s*\d+\s*\/\s*\d+\s*$/gm, // 페이지 표시
      /^\s*\[\s*\]\s*$/gm     // 빈 체크박스
    ];
  }

  /**
   * 향상된 날짜 블록 처리 메인 함수
   * @param {string} text 처리할 텍스트
   * @param {Object} options 처리 옵션
   * @returns {Object} 처리 결과
   */
  async processEnhancedDateBlocks(text, options = {}) {
    const startTime = Date.now();
    
    try {
      // 1단계: 텍스트 전처리 및 정리
      const cleanedText = this._preprocessText(text);
      
      // 2단계: Level 1 분석 (문서 구조)
      const documentStructure = this._analyzeDocumentStructure(cleanedText);
      
      // 3단계: Level 2 분석 (중간 블록)
      const mediumBlocks = this._analyzeMediumBlocks(cleanedText);
      
      // 4단계: Level 3 분석 (세부 날짜 패턴)
      const detailedPatterns = this._analyzeDetailedPatterns(cleanedText);
      
      // 5단계: 날짜 기반 그룹핑 및 구조화
      const structuredGroups = this._structureByDate(documentStructure, mediumBlocks, detailedPatterns);
      
      // 6단계: 최적화 및 필터링
      const optimizedBlocks = this._optimizeBlocks(structuredGroups, options);
      
      // 결과 생성
      const result = {
        dateBlocks: optimizedBlocks,
        structuredGroups,
        statistics: this._generateStatistics(optimizedBlocks, cleanedText),
        processingTime: Date.now() - startTime,
        confidence: this._calculateConfidence(optimizedBlocks, cleanedText)
      };
      
      return result;
      
    } catch (error) {
      console.error('Enhanced date block processing error:', error);
      return {
        dateBlocks: [],
        structuredGroups: [],
        statistics: { error: error.message },
        processingTime: Date.now() - startTime,
        confidence: 0
      };
    }
  }

  /**
   * 텍스트 전처리
   * @param {string} text 원본 텍스트
   * @returns {string} 정리된 텍스트
   */
  _preprocessText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    let cleaned = text;
    
    // 노이즈 패턴 제거
    this.noisePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // 연속된 공백 정리
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/\s{3,}/g, ' ');
    
    return cleaned.trim();
  }

  /**
   * 문서 구조 분석 (Level 1)
   * @param {string} text 정리된 텍스트
   * @returns {Array} 문서 구조 블록들
   */
  _analyzeDocumentStructure(text) {
    const blocks = [];
    
    // 날짜별 섹션 추출
    const dateBasedSections = text.match(this.enhancedDatePatterns.documentStructure.dateBasedSection) || [];
    
    dateBasedSections.forEach((section, index) => {
      const dateMatch = section.match(/\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?|\d{4}년\s*\d{1,2}월\s*\d{1,2}일/);
      
      if (dateMatch) {
        blocks.push({
          type: 'documentStructure',
          level: 1,
          date: dateMatch[0],
          content: section,
          position: index,
          confidence: this._calculateBlockConfidence(section)
        });
      }
    });
    
    return blocks;
  }

  /**
   * 중간 블록 분석 (Level 2)
   * @param {string} text 정리된 텍스트
   * @returns {Array} 중간 크기 블록들
   */
  _analyzeMediumBlocks(text) {
    const blocks = [];
    
    Object.entries(this.enhancedDatePatterns.mediumBlocks).forEach(([blockType, pattern]) => {
      const matches = text.match(pattern) || [];
      
      matches.forEach((match, index) => {
        const dateMatch = match.match(/\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?|\d{4}년\s*\d{1,2}월\s*\d{1,2}일/);
        
        blocks.push({
          type: blockType,
          level: 2,
          date: dateMatch ? dateMatch[0] : null,
          content: match,
          position: index,
          confidence: this._calculateBlockConfidence(match)
        });
      });
    });
    
    return blocks;
  }

  /**
   * 세부 패턴 분석 (Level 3)
   * @param {string} text 정리된 텍스트
   * @returns {Array} 세부 날짜 패턴들
   */
  _analyzeDetailedPatterns(text) {
    const patterns = [];
    
    Object.entries(this.enhancedDatePatterns.detailedPatterns).forEach(([patternType, regex]) => {
      const matches = [...text.matchAll(regex)];
      
      matches.forEach((match, index) => {
        patterns.push({
          type: patternType,
          level: 3,
          date: match[0],
          position: match.index,
          confidence: this._calculatePatternConfidence(match[0], patternType)
        });
      });
    });
    
    return patterns;
  }

  /**
   * 날짜 기반 구조화
   * @param {Array} documentStructure 문서 구조
   * @param {Array} mediumBlocks 중간 블록들
   * @param {Array} detailedPatterns 세부 패턴들
   * @returns {Array} 구조화된 그룹들
   */
  _structureByDate(documentStructure, mediumBlocks, detailedPatterns) {
    const dateGroups = new Map();
    
    // 모든 블록을 날짜별로 그룹핑
    [...documentStructure, ...mediumBlocks, ...detailedPatterns].forEach(block => {
      if (block.date) {
        const normalizedDate = this._normalizeDate(block.date);
        
        if (!dateGroups.has(normalizedDate)) {
          dateGroups.set(normalizedDate, {
            date: normalizedDate,
            blocks: [],
            events: [],
            confidence: 0
          });
        }
        
        const group = dateGroups.get(normalizedDate);
        group.blocks.push(block);
        
        // 의료 이벤트 추출
        const events = this._extractMedicalEvents(block.content || block.date);
        group.events.push(...events);
        
        // 신뢰도 업데이트
        group.confidence = Math.max(group.confidence, block.confidence || 0);
      }
    });
    
    return Array.from(dateGroups.values()).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
  }

  /**
   * 날짜 정규화
   * @param {string} dateStr 날짜 문자열
   * @returns {string} 정규화된 날짜
   */
  _normalizeDate(dateStr) {
    if (!dateStr) return '';
    
    // 한국어 날짜 형식 처리
    const koreanMatch = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (koreanMatch) {
      const [, year, month, day] = koreanMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // 표준 날짜 형식 처리
    const standardMatch = dateStr.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (standardMatch) {
      const [, year, month, day] = standardMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return dateStr;
  }

  /**
   * 의료 이벤트 추출
   * @param {string} content 내용
   * @returns {Array} 추출된 의료 이벤트들
   */
  _extractMedicalEvents(content) {
    if (!content) return [];
    
    const events = [];
    
    // 고중요도 키워드 검색
    this.medicalKeywords.high.forEach(keyword => {
      if (content.includes(keyword)) {
        events.push({
          type: 'high',
          keyword,
          priority: 3
        });
      }
    });
    
    // 중간 중요도 키워드 검색
    this.medicalKeywords.medium.forEach(keyword => {
      if (content.includes(keyword)) {
        events.push({
          type: 'medium',
          keyword,
          priority: 2
        });
      }
    });
    
    // 낮은 중요도 키워드 검색
    this.medicalKeywords.low.forEach(keyword => {
      if (content.includes(keyword)) {
        events.push({
          type: 'low',
          keyword,
          priority: 1
        });
      }
    });
    
    return events;
  }

  /**
   * 블록 신뢰도 계산
   * @param {string} content 블록 내용
   * @returns {number} 신뢰도 (0-1)
   */
  _calculateBlockConfidence(content) {
    if (!content) return 0;
    
    let confidence = 0.3; // 기본 신뢰도
    
    // 날짜 패턴 존재 여부
    if (/\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?/.test(content)) {
      confidence += 0.3;
    }
    
    // 의료 키워드 존재 여부
    const hasHighKeyword = this.medicalKeywords.high.some(keyword => content.includes(keyword));
    const hasMediumKeyword = this.medicalKeywords.medium.some(keyword => content.includes(keyword));
    
    if (hasHighKeyword) confidence += 0.3;
    else if (hasMediumKeyword) confidence += 0.2;
    
    // 내용 길이 고려
    if (content.length > 50) confidence += 0.1;
    if (content.length > 200) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 패턴 신뢰도 계산
   * @param {string} pattern 패턴 문자열
   * @param {string} type 패턴 타입
   * @returns {number} 신뢰도 (0-1)
   */
  _calculatePatternConfidence(pattern, type) {
    let confidence = 0.5; // 기본 신뢰도
    
    switch (type) {
      case 'standardDate':
        confidence = 0.9;
        break;
      case 'koreanDate':
        confidence = 0.8;
        break;
      case 'medicalSpecificDate':
        confidence = 0.95;
        break;
      case 'relativeDate':
        confidence = 0.6;
        break;
    }
    
    return confidence;
  }

  /**
   * 전체 신뢰도 계산
   * @param {Array} blocks 처리된 블록들
   * @param {string} originalText 원본 텍스트
   * @returns {number} 전체 신뢰도
   */
  _calculateConfidence(blocks, originalText) {
    if (!blocks || blocks.length === 0) return 0;
    
    const totalConfidence = blocks.reduce((sum, block) => sum + (block.confidence || 0), 0);
    const averageConfidence = totalConfidence / blocks.length;
    
    // 텍스트 커버리지 고려
    const coveredLength = blocks.reduce((sum, block) => 
      sum + (block.content ? block.content.length : 0), 0
    );
    const coverage = originalText.length > 0 ? coveredLength / originalText.length : 0;
    
    return Math.min(averageConfidence * (0.7 + coverage * 0.3), 1.0);
  }

  /**
   * 통계 생성
   * @param {Array} blocks 처리된 블록들
   * @param {string} originalText 원본 텍스트
   * @returns {Object} 통계 정보
   */
  _generateStatistics(blocks, originalText) {
    const dateGroups = blocks.filter(block => block.date);
    
    return {
      totalBlocks: blocks.length,
      dateGroups: dateGroups.length,
      averageBlockSize: blocks.length > 0 ? 
        blocks.reduce((sum, block) => sum + (block.content ? block.content.length : 0), 0) / blocks.length : 0,
      textCoverage: originalText.length > 0 ? 
        blocks.reduce((sum, block) => sum + (block.content ? block.content.length : 0), 0) / originalText.length : 0,
      averageBlocksPerDate: dateGroups.length > 0 ? 
        dateGroups.reduce((sum, group) => sum + group.blocks.length, 0) / dateGroups.length : 0
    };
  }

  _optimizeBlocks(dateGroups, options = {}) {
    const optimized = [];
    
    dateGroups.forEach(group => {
      // 중복 제거 및 병합
      const mergedContent = this._mergeBlockContents(group.blocks);
      
      optimized.push({
        date: group.date,
        type: 'dateGroup',
        content: mergedContent,
        events: group.events,
        confidence: group.confidence,
        blockCount: group.blocks.length,
        optimized: true
      });
    });
    
    return optimized;
  }

  _mergeBlockContents(blocks) {
    const contents = blocks
      .map(block => block.content || block.value || '')
      .filter(content => content.trim().length > 0);
    
    return [...new Set(contents)].join('\n\n').trim();
  }
}

export default EnhancedMassiveDateBlockProcessor;