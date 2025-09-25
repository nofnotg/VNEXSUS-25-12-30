/**
 * Massive Date Block Processor Module
 * 
 * 역할:
 * 1. 거대 날짜 블록 패턴 인식 및 분석
 * 2. 큰 패턴에서 작은 패턴으로 센싱(censoring) 로직
 * 3. 무의미한 텍스트 최소화 및 제거
 * 4. 날짜 기반 텍스트 구조화 및 그룹핑
 */

class MassiveDateBlockProcessor {
  constructor() {
    // 거대 날짜 블록 패턴 (큰 패턴부터 작은 패턴 순서)
    this.massiveDatePatterns = {
      // Level 1: 의료 문서 전체 구조 패턴
      documentStructure: {
        // 진료 기록 전체 블록
        medicalRecordBlock: /(?:진료기록|의무기록|진료차트)[\s\S]*?(?=\n\s*\n|$)/gi,
        // 날짜별 진료 섹션
        dateBasedSection: /(?:\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)[\s\S]*?(?=(?:\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일)|$)/gi
      },
      
      // Level 2: 중간 크기 날짜 블록 패턴
      mediumBlocks: {
        // 입원/퇴원 기간 블록
        hospitalizationBlock: /(입원|퇴원)\s*[:：]?\s*\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}[\s\S]*?(?=(?:입원|퇴원|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})|$)/gi,
        // 수술/시술 블록
        surgeryBlock: /(수술|시술|처치)\s*[:：]?\s*\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}[\s\S]*?(?=(?:수술|시술|처치|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})|$)/gi,
        // 검사 결과 블록
        testBlock: /(검사|촬영|진단)\s*[:：]?\s*\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}[\s\S]*?(?=(?:검사|촬영|진단|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})|$)/gi
      },
      
      // Level 3: 작은 날짜 패턴
      smallBlocks: {
        // 절대 날짜 (YYYY-MM-DD 형식)
        absoluteDate: /\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
        // 한국어 날짜 (YYYY년 MM월 DD일)
        koreanDate: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
        // 상대 날짜
        relativeDate: /(오늘|어제|내일|이번주|지난주|다음주|\d+일\s*전|\d+일\s*후)/g,
        // 의료 특화 날짜
        medicalDate: /(입원|퇴원|수술|검사|진료|처방)\s*일?\s*[:：]?\s*\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g
      }
    };
    
    // 무의미한 텍스트 패턴 (제거 대상)
    this.meaninglessPatterns = {
      // 반복되는 헤더/푸터
      headers: /^\s*(페이지|page|\d+\/\d+|\d+\s*of\s*\d+)\s*$/gmi,
      // 빈 줄과 공백
      emptyLines: /^\s*$/gm,
      // 의미없는 구분자
      separators: /^\s*[-=_*]{3,}\s*$/gm,
      // OCR 오류로 인한 깨진 문자
      brokenChars: /[\x00-\x1F\x7F-\x9F]|[\uFFFD\uFEFF]/g,
      // 중복 공백
      duplicateSpaces: /\s{3,}/g
    };
    
    // 중요 키워드 (보존 대상)
    this.importantKeywords = {
      medical: ['진단', '치료', '수술', '검사', '처방', '투약', '입원', '퇴원', '증상', '소견'],
      temporal: ['일자', '기간', '시작', '종료', '지속', '경과'],
      institutional: ['병원', '의원', '클리닉', '의료원', '한의원']
    };
  }

  /**
   * 거대 날짜 블록 처리 메인 함수
   * @param {string} ocrText OCR로 추출된 원본 텍스트
   * @param {Object} options 처리 옵션
   * @returns {Promise<Object>} 처리된 날짜 블록 데이터
   */
  async processMassiveDateBlocks(ocrText, options = {}) {
    try {
      console.log('🔍 거대 날짜 블록 처리 시작...');
      
      // 1단계: 텍스트 전처리 및 정제
      const cleanedText = this._cleanText(ocrText);
      console.log(`📝 텍스트 정제 완료: ${ocrText.length} → ${cleanedText.length} 문자`);
      
      // 2단계: 거대 패턴 분석 (Level 1)
      const documentStructure = this._analyzeDocumentStructure(cleanedText);
      console.log(`📋 문서 구조 분석 완료: ${documentStructure.sections.length}개 섹션 발견`);
      
      // 3단계: 중간 패턴 분석 (Level 2)
      const mediumBlocks = this._analyzeMediumBlocks(cleanedText);
      console.log(`🔍 중간 블록 분석 완료: ${mediumBlocks.totalBlocks}개 블록 발견`);
      
      // 4단계: 작은 패턴 분석 (Level 3)
      const smallBlocks = this._analyzeSmallBlocks(cleanedText);
      console.log(`📅 작은 블록 분석 완료: ${smallBlocks.totalDates}개 날짜 발견`);
      
      // 5단계: 날짜 기반 그룹핑 및 구조화
      const structuredData = this._structureDateBasedGroups({
        documentStructure,
        mediumBlocks,
        smallBlocks,
        originalText: cleanedText
      });
      
      // 6단계: 무의미한 텍스트 제거 및 최적화
      const optimizedData = this._optimizeAndFilter(structuredData, options);
      
      console.log('✅ 거대 날짜 블록 처리 완료');
      return {
        success: true,
        originalSize: ocrText.length,
        processedSize: cleanedText.length,
        structuredGroups: optimizedData.groups,
        dateBlocks: optimizedData.dateBlocks,
        statistics: optimizedData.statistics,
        processingTime: Date.now()
      };
      
    } catch (error) {
      console.error('❌ 거대 날짜 블록 처리 중 오류:', error);
      throw new Error(`거대 날짜 블록 처리 실패: ${error.message}`);
    }
  }

  /**
   * 텍스트 정제 및 전처리
   * @param {string} text 원본 텍스트
   * @returns {string} 정제된 텍스트
   * @private
   */
  _cleanText(text) {
    let cleaned = text;
    
    // 무의미한 패턴 제거
    Object.values(this.meaninglessPatterns).forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ');
    });
    
    // 줄바꿈 정규화
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 중복 공백 제거
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * 문서 구조 분석 (Level 1 - 가장 큰 패턴)
   * @param {string} text 정제된 텍스트
   * @returns {Object} 문서 구조 분석 결과
   * @private
   */
  _analyzeDocumentStructure(text) {
    const sections = [];
    
    // 날짜별 진료 섹션 추출
    const dateBasedMatches = [...text.matchAll(this.massiveDatePatterns.documentStructure.dateBasedSection)];
    
    dateBasedMatches.forEach((match, index) => {
      const sectionText = match[0];
      const dateMatch = sectionText.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일/);
      
      sections.push({
        id: `section_${index + 1}`,
        type: 'dateBasedSection',
        date: dateMatch ? dateMatch[0] : null,
        content: sectionText,
        startIndex: match.index,
        length: sectionText.length,
        confidence: this._calculateConfidence(sectionText)
      });
    });
    
    return {
      sections,
      totalSections: sections.length,
      averageLength: sections.length > 0 ? Math.round(sections.reduce((sum, s) => sum + s.length, 0) / sections.length) : 0
    };
  }

  /**
   * 중간 블록 분석 (Level 2)
   * @param {string} text 정제된 텍스트
   * @returns {Object} 중간 블록 분석 결과
   * @private
   */
  _analyzeMediumBlocks(text) {
    const blocks = {
      hospitalization: [],
      surgery: [],
      test: []
    };
    
    // 입원/퇴원 블록
    const hospitalizationMatches = [...text.matchAll(this.massiveDatePatterns.mediumBlocks.hospitalizationBlock)];
    blocks.hospitalization = hospitalizationMatches.map((match, index) => ({
      id: `hosp_${index + 1}`,
      type: 'hospitalization',
      content: match[0],
      startIndex: match.index,
      dates: this._extractDatesFromText(match[0])
    }));
    
    // 수술/시술 블록
    const surgeryMatches = [...text.matchAll(this.massiveDatePatterns.mediumBlocks.surgeryBlock)];
    blocks.surgery = surgeryMatches.map((match, index) => ({
      id: `surg_${index + 1}`,
      type: 'surgery',
      content: match[0],
      startIndex: match.index,
      dates: this._extractDatesFromText(match[0])
    }));
    
    // 검사 블록
    const testMatches = [...text.matchAll(this.massiveDatePatterns.mediumBlocks.testBlock)];
    blocks.test = testMatches.map((match, index) => ({
      id: `test_${index + 1}`,
      type: 'test',
      content: match[0],
      startIndex: match.index,
      dates: this._extractDatesFromText(match[0])
    }));
    
    const totalBlocks = blocks.hospitalization.length + blocks.surgery.length + blocks.test.length;
    
    return {
      blocks,
      totalBlocks,
      distribution: {
        hospitalization: blocks.hospitalization.length,
        surgery: blocks.surgery.length,
        test: blocks.test.length
      }
    };
  }

  /**
   * 작은 블록 분석 (Level 3 - 가장 작은 패턴)
   * @param {string} text 정제된 텍스트
   * @returns {Object} 작은 블록 분석 결과
   * @private
   */
  _analyzeSmallBlocks(text) {
    const dates = {
      absolute: [],
      korean: [],
      relative: [],
      medical: []
    };
    
    // 각 패턴별 날짜 추출
    Object.entries(this.massiveDatePatterns.smallBlocks).forEach(([type, pattern]) => {
      const matches = [...text.matchAll(pattern)];
      dates[type] = matches.map((match, index) => ({
        id: `${type}_${index + 1}`,
        type,
        value: match[0],
        startIndex: match.index,
        context: this._getContext(text, match.index, 50) // 앞뒤 50자 컨텍스트
      }));
    });
    
    const totalDates = Object.values(dates).reduce((sum, arr) => sum + arr.length, 0);
    
    return {
      dates,
      totalDates,
      distribution: Object.fromEntries(
        Object.entries(dates).map(([type, arr]) => [type, arr.length])
      )
    };
  }

  /**
   * 날짜 기반 그룹핑 및 구조화
   * @param {Object} analysisData 분석된 데이터
   * @returns {Object} 구조화된 데이터
   * @private
   */
  _structureDateBasedGroups(analysisData) {
    const { documentStructure, mediumBlocks, smallBlocks, originalText } = analysisData;
    const groups = new Map();
    
    // 1. 문서 구조 기반 그룹 생성
    documentStructure.sections.forEach(section => {
      if (section.date) {
        const normalizedDate = this._normalizeDateString(section.date);
        if (!groups.has(normalizedDate)) {
          groups.set(normalizedDate, {
            date: normalizedDate,
            originalDate: section.date,
            sections: [],
            mediumBlocks: [],
            smallBlocks: [],
            content: '',
            confidence: 0
          });
        }
        groups.get(normalizedDate).sections.push(section);
      }
    });
    
    // 2. 중간 블록을 해당 날짜 그룹에 할당
    Object.values(mediumBlocks.blocks).flat().forEach(block => {
      block.dates.forEach(date => {
        const normalizedDate = this._normalizeDateString(date);
        if (groups.has(normalizedDate)) {
          groups.get(normalizedDate).mediumBlocks.push(block);
        }
      });
    });
    
    // 3. 작은 블록을 해당 날짜 그룹에 할당
    Object.values(smallBlocks.dates).flat().forEach(dateBlock => {
      const normalizedDate = this._normalizeDateString(dateBlock.value);
      if (groups.has(normalizedDate)) {
        groups.get(normalizedDate).smallBlocks.push(dateBlock);
      }
    });
    
    // 4. 각 그룹의 내용 통합 및 신뢰도 계산
    groups.forEach((group, date) => {
      group.content = this._mergeGroupContent(group);
      group.confidence = this._calculateGroupConfidence(group);
    });
    
    return {
      groups: Array.from(groups.values()).sort((a, b) => new Date(a.date) - new Date(b.date)),
      totalGroups: groups.size,
      dateRange: this._calculateDateRange(Array.from(groups.keys()))
    };
  }

  /**
   * 최적화 및 필터링
   * @param {Object} structuredData 구조화된 데이터
   * @param {Object} options 옵션
   * @returns {Object} 최적화된 데이터
   * @private
   */
  _optimizeAndFilter(structuredData, options = {}) {
    const { groups } = structuredData;
    const optimizedGroups = [];
    const dateBlocks = [];
    
    groups.forEach(group => {
      // 신뢰도 기준 필터링
      if (group.confidence >= (options.minConfidence || 0.3)) {
        // 중요 키워드 포함 여부 확인
        const hasImportantKeywords = this._hasImportantKeywords(group.content);
        
        if (hasImportantKeywords || options.includeAll) {
          optimizedGroups.push({
            ...group,
            optimized: true,
            keywordScore: this._calculateKeywordScore(group.content)
          });
          
          dateBlocks.push({
            date: group.date,
            type: 'optimized',
            content: group.content,
            confidence: group.confidence
          });
        }
      }
    });
    
    return {
      groups: optimizedGroups,
      dateBlocks,
      statistics: {
        originalGroups: groups.length,
        optimizedGroups: optimizedGroups.length,
        filteringRate: groups.length > 0 ? (optimizedGroups.length / groups.length * 100).toFixed(1) : 0,
        averageConfidence: optimizedGroups.length > 0 ? 
          (optimizedGroups.reduce((sum, g) => sum + g.confidence, 0) / optimizedGroups.length).toFixed(3) : 0
      }
    };
  }

  // 유틸리티 메서드들
  _extractDatesFromText(text) {
    const dates = [];
    Object.values(this.massiveDatePatterns.smallBlocks).forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
      dates.push(...matches.map(m => m[0]));
    });
    return [...new Set(dates)];
  }

  _normalizeDateString(dateStr) {
    // YYYY-MM-DD 형식으로 정규화
    const patterns = [
      { regex: /(\d{4})[-\/.]?(\d{1,2})[-\/.]?(\d{1,2})/, format: '$1-$2-$3' },
      { regex: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/, format: '$1-$2-$3' }
    ];
    
    for (const pattern of patterns) {
      const match = dateStr.match(pattern.regex);
      if (match) {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    return dateStr;
  }

  _getContext(text, index, length) {
    const start = Math.max(0, index - length);
    const end = Math.min(text.length, index + length);
    return text.substring(start, end);
  }

  _calculateConfidence(text) {
    let score = 0.5; // 기본 점수
    
    // 날짜 포함 여부
    if (/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(text)) score += 0.2;
    
    // 의료 키워드 포함 여부
    const medicalKeywords = this.importantKeywords.medical;
    const keywordCount = medicalKeywords.filter(keyword => text.includes(keyword)).length;
    score += Math.min(keywordCount * 0.1, 0.3);
    
    return Math.min(score, 1.0);
  }

  _calculateGroupConfidence(group) {
    const weights = {
      sections: 0.4,
      mediumBlocks: 0.3,
      smallBlocks: 0.2,
      content: 0.1
    };
    
    let confidence = 0;
    confidence += (group.sections.length > 0 ? 1 : 0) * weights.sections;
    confidence += (group.mediumBlocks.length > 0 ? 1 : 0) * weights.mediumBlocks;
    confidence += (group.smallBlocks.length > 0 ? 1 : 0) * weights.smallBlocks;
    confidence += (group.content.length > 50 ? 1 : 0) * weights.content;
    
    return confidence;
  }

  _mergeGroupContent(group) {
    const contents = [];
    
    group.sections.forEach(section => contents.push(section.content));
    group.mediumBlocks.forEach(block => contents.push(block.content));
    
    return contents.join('\n\n').trim();
  }

  _hasImportantKeywords(text) {
    const allKeywords = Object.values(this.importantKeywords).flat();
    return allKeywords.some(keyword => text.includes(keyword));
  }

  _calculateKeywordScore(text) {
    const allKeywords = Object.values(this.importantKeywords).flat();
    const foundKeywords = allKeywords.filter(keyword => text.includes(keyword));
    return foundKeywords.length / allKeywords.length;
  }

  _calculateDateRange(dates) {
    if (dates.length === 0) return null;
    
    const sortedDates = dates.sort();
    return {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1],
      span: sortedDates.length
    };
  }
}

export default MassiveDateBlockProcessor;