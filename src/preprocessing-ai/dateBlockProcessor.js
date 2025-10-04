/**
 * 날짜 블록 프로세서 - ES 모듈 버전
 * 
 * 의료 문서에서 날짜 정보를 식별하고 관련 정보와 함께 블록화하여
 * 룰 기반 시스템의 정확도를 향상시킵니다.
 */

// 임시로 간단한 함수들을 직접 구현
const analyzeMedicalRelevance = (text) => {
  const medicalKeywords = ['진료', '검사', '수술', '입원', '퇴원', '처방', '투약', '치료', '진단', '소견'];
  const keywordCount = medicalKeywords.filter(keyword => text.includes(keyword)).length;
  return keywordCount / medicalKeywords.length;
};

const createDateBlocks = async (textArray) => {
  // 간단한 날짜 블록 생성 로직
  const datePattern = /\d{4}[-\/.년]\s*\d{1,2}[-\/.]?\s*\d{1,2}[일]?/g;
  const blocks = [];
  
  textArray.forEach((item, index) => {
    // item이 객체인 경우 original 속성에서 텍스트 추출
    const text = typeof item === 'string' ? item : (item.original || String(item));
    
    // text가 문자열인지 확인
    if (typeof text === 'string') {
      const dates = text.match(datePattern) || [];
      dates.forEach(date => {
        blocks.push({
          id: `block_${index}_${Date.now()}`,
          date: date,
          content: text,
          confidence: 0.5 // 기본 신뢰도
        });
      });
    }
  });
  
  return blocks;
};
import MiscCategoryClassifier from './miscCategoryClassifier.js';
import CrossDateCorrelationAnalyzer from './crossDateCorrelationAnalyzer.js';

class DateBlockProcessor {
  constructor(options = {}) {
    // 새로운 분류기 및 분석기 초기화
    this.miscClassifier = new MiscCategoryClassifier();
    this.correlationAnalyzer = new CrossDateCorrelationAnalyzer();
    
    this.config = {
      // 날짜 패턴 설정
      datePatterns: [
        // 한국어 날짜 패턴
        /(\d{4})[년\-\.\/](\d{1,2})[월\-\.\/](\d{1,2})[일]?/g,
        /(\d{1,2})[월\-\.\/](\d{1,2})[일\-\.\/](\d{4})[년]?/g,
        /(\d{4})[\-\.\/](\d{1,2})[\-\.\/](\d{1,2})/g,
        /(\d{1,2})[\-\.\/](\d{1,2})[\-\.\/](\d{4})/g,
        // 영어 날짜 패턴
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\.\/](\d{1,2})[\s\-\.\/](\d{4})/gi,
        /(\d{1,2})[\s\-\.\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\.\/](\d{4})/gi,
        // 상대적 날짜 패턴
        /(오늘|어제|그제|내일|모레)/g,
        /(today|yesterday|tomorrow)/gi,
        // 기간 패턴
        /(\d{1,2})[일간|주간|개월간|년간]/g,
        /(\d{1,2})\s*(days?|weeks?|months?|years?)/gi
      ],
      
      // 컨텍스트 윈도우 크기 (날짜 전후 문자 수)
      contextWindow: options.contextWindow || 200,
      
      // 블록 병합 거리 (문자 단위)
      mergeDistance: options.mergeDistance || 100,
      
      // 최소 신뢰도 임계값
      confidenceThreshold: options.confidenceThreshold || 0.6,
      
      // 의료 관련 키워드
      medicalKeywords: [
        '진료', '검사', '수술', '입원', '퇴원', '처방', '투약', '치료',
        '진단', '소견', '결과', '증상', '병력', '과거력', '가족력',
        '혈압', '혈당', '체온', '맥박', '호흡', '체중', '신장',
        'BP', 'HR', 'RR', 'BT', 'Wt', 'Ht', 'BMI',
        'examination', 'surgery', 'treatment', 'diagnosis', 'symptom'
      ]
    };
    
    // 월 이름 매핑
    this.monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
      'January': '01', 'February': '02', 'March': '03', 'April': '04',
      'June': '06', 'July': '07', 'August': '08', 'September': '09',
      'October': '10', 'November': '11', 'December': '12'
    };
    
    // 통계
    this.stats = {
      totalProcessed: 0,
      datesFound: 0,
      blocksCreated: 0,
      averageConfidence: 0
    };
  }
  
  /**
   * 메인 날짜 블록화 처리 함수
   * @param {string} text - 입력 텍스트
   * @param {Object} options - 처리 옵션
   * @returns {Object} 날짜 블록화 결과
   */
  process(text, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('날짜 블록화 처리 시작', { textLength: text.length });
      
      // 1. 날짜 패턴 추출
      const dateMatches = this.extractDatePatterns(text);
      
      // 2. 날짜 정규화
      const normalizedDates = this.normalizeDates(dateMatches);
      
      // 3. 컨텍스트 추출
      const datesWithContext = this.extractContext(text, normalizedDates);
      
      // 4. 의료 관련성 분석
      const medicalRelevance = this.analyzeMedicalRelevance(datesWithContext);
      
      // 5. 블록 생성
      const dateBlocks = this.createDateBlocks(medicalRelevance);
      
      // 6. 블록 병합 및 최적화
      const optimizedBlocks = this.optimizeBlocks(dateBlocks);
      
      // 7. 신뢰도 계산
      const finalBlocks = this.calculateConfidence(optimizedBlocks);
      
      // 통계 업데이트
      this.updateStats(dateMatches.length, finalBlocks.length, finalBlocks);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('날짜 블록화 처리 완료', {
        processingTime,
        datesFound: dateMatches.length,
        blocksCreated: finalBlocks.length,
        averageConfidence: this.calculateAverageConfidence(finalBlocks)
      });
      
      return {
        dateBlocks: finalBlocks,
        metadata: {
          processingTime,
          originalDatesFound: dateMatches.length,
          blocksCreated: finalBlocks.length,
          averageConfidence: this.calculateAverageConfidence(finalBlocks),
          medicalRelevanceScore: this.calculateMedicalRelevanceScore(finalBlocks)
        },
        statistics: this.getStats()
      };
      
    } catch (error) {
      logger.error('날짜 블록화 처리 오류', error);
      throw error;
    }
  }
  
  /**
   * 날짜 블록 처리 메인 함수
   */
  async processDateBlocks(textArray) {
    try {
      console.log('Starting date block processing...');
      
      // 1. 의료 관련성 분석 - 텍스트 배열을 적절한 형식으로 변환
      const datesWithContext = textArray.map(text => ({
        context: { full: text },
        original: text
      }));
      
      const analyzedArray = textArray.map((text, index) => ({
        original: text,
        medicalRelevance: this.analyzeMedicalRelevance([datesWithContext[index]])[0]
      }));
      
      // 2. 날짜 블록 생성
      const dateBlocks = createDateBlocks(analyzedArray);
      
      console.log(`Created ${dateBlocks.length} date blocks`);
      return dateBlocks;
      
    } catch (error) {
      console.error('Date block processing error:', error);
      throw error;
    }
  }
  
  /**
   * 향상된 날짜 블록 처리 (기타 항목 분류 및 연관성 분석 포함)
   */
  async processDateBlocksEnhanced(textArray) {
    try {
      // 1단계: 기본 날짜 블록 생성
      const dateBlocks = await this.processDateBlocks(textArray);
      
      // 2단계: 각 블록 내 데이터 분류 및 기타 항목 식별
      const classifiedBlocks = await this._classifyBlockContent(dateBlocks);
      
      // 3단계: 크로스 날짜 연관성 분석
      const correlationAnalysis = this.correlationAnalyzer.analyzeCorrelations(classifiedBlocks);
      
      // 4단계: 통원 기록 연계 강화
      const enhancedBlocks = await this._enhanceOutpatientConnections(
        classifiedBlocks, 
        correlationAnalysis
      );
      
      // 5단계: 사용자 검토 항목 추출
      const reviewItems = this._extractReviewItems(enhancedBlocks);
      
      return {
        dateBlocks: enhancedBlocks,
        correlations: correlationAnalysis,
        miscItems: this._extractMiscItems(enhancedBlocks),
        reviewItems: reviewItems,
        summary: this._generateProcessingSummary(enhancedBlocks, correlationAnalysis)
      };
      
    } catch (error) {
      console.error('Enhanced date block processing error:', error);
      throw error;
    }
  }

  /**
   * 블록 내용 분류 (9항목 구조화 + 기타 항목)
   */
  async _classifyBlockContent(dateBlocks) {
    const classifiedBlocks = [];
    
    for (const block of dateBlocks) {
      const classifiedBlock = { ...block };
      
      // 의료 관련성 점수 계산
      const medicalRelevance = this.analyzeMedicalRelevance(block.content);
      
      // 각 데이터 항목에 대해 분류 수행
      classifiedBlock.items = [];
      const contentItems = this._splitBlockContent(block.content);
      
      for (const item of contentItems) {
        const miscAnalysis = this.miscClassifier.classifyAsMisc(item, medicalRelevance);
        
        classifiedBlock.items.push({
          content: item,
          medicalRelevance: medicalRelevance,
          miscAnalysis: miscAnalysis,
          category: this._determineMainCategory(item),
          needsReview: miscAnalysis.suggestedReview
        });
      }
      
      classifiedBlocks.push(classifiedBlock);
    }
    
    return classifiedBlocks;
  }

  /**
   * 통원 기록 연계 강화
   */
  async _enhanceOutpatientConnections(blocks, correlationAnalysis) {
    const enhancedBlocks = [...blocks];
    
    // 통원 관련 연관성이 높은 블록들 식별
    const outpatientCorrelations = correlationAnalysis.grouped.outpatient_sequences;
    
    for (const correlation of outpatientCorrelations) {
      const block1Index = enhancedBlocks.findIndex(b => b.id === correlation.block1Id);
      const block2Index = enhancedBlocks.findIndex(b => b.id === correlation.block2Id);
      
      if (block1Index !== -1 && block2Index !== -1) {
        // 양방향 연결 정보 추가
        enhancedBlocks[block1Index].outpatientConnections = 
          enhancedBlocks[block1Index].outpatientConnections || [];
        enhancedBlocks[block1Index].outpatientConnections.push({
          connectedBlockId: correlation.block2Id,
          connectionType: correlation.details.outpatient.sequenceType,
          confidence: correlation.confidence
        });
        
        enhancedBlocks[block2Index].outpatientConnections = 
          enhancedBlocks[block2Index].outpatientConnections || [];
        enhancedBlocks[block2Index].outpatientConnections.push({
          connectedBlockId: correlation.block1Id,
          connectionType: correlation.details.outpatient.sequenceType,
          confidence: correlation.confidence
        });
      }
    }
    
    return enhancedBlocks;
  }

  /**
   * 사용자 검토 항목 추출
   */
  _extractReviewItems(blocks) {
    const reviewItems = [];
    
    blocks.forEach(block => {
      block.items?.forEach(item => {
        if (item.needsReview) {
          reviewItems.push({
            blockId: block.id,
            blockDate: block.date,
            content: item.content,
            reason: item.miscAnalysis.reason,
            category: item.miscAnalysis.category,
            confidence: item.miscAnalysis.confidence
          });
        }
      });
    });
    
    return reviewItems;
  }

  /**
   * 기타 항목 추출
   */
  _extractMiscItems(blocks) {
    const miscItems = [];
    
    blocks.forEach(block => {
      block.items?.forEach(item => {
        if (item.miscAnalysis.isMisc) {
          miscItems.push({
            blockId: block.id,
            blockDate: block.date,
            content: item.content,
            category: item.miscAnalysis.category,
            analysis: item.miscAnalysis
          });
        }
      });
    });
    
    return this.miscClassifier.organizeMiscItems(miscItems);
  }

  /**
   * 처리 요약 생성
   */
  _generateProcessingSummary(blocks, correlationAnalysis) {
    const totalItems = blocks.reduce((sum, block) => 
      sum + (block.items?.length || 0), 0);
    const miscItems = blocks.reduce((sum, block) => 
      sum + (block.items?.filter(item => item.miscAnalysis.isMisc).length || 0), 0);
    const reviewItems = blocks.reduce((sum, block) => 
      sum + (block.items?.filter(item => item.needsReview).length || 0), 0);
    
    return {
      totalBlocks: blocks.length,
      totalItems: totalItems,
      miscItemsCount: miscItems,
      reviewItemsCount: reviewItems,
      outpatientSequences: correlationAnalysis.grouped.outpatient_sequences.length,
      highConfidenceCorrelations: correlationAnalysis.summary.highConfidence,
      averageCorrelationScore: correlationAnalysis.summary.averageScore
    };
  }

  /**
   * 블록 내용을 개별 항목으로 분할
   */
  _splitBlockContent(content) {
    // 줄바꿈, 쉼표, 세미콜론 등으로 분할
    return content.split(/[\n,;]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  /**
   * 주요 카테고리 결정
   */
  _determineMainCategory(text) {
    const categories = {
      diagnosis: ['진단', '병명', '질병'],
      treatment: ['치료', '처방', '투약'],
      examination: ['검사', '촬영'],
      hospitalization: ['입원', '퇴원'],
      outpatient: ['외래', '통원', '진료'],
      emergency: ['응급', '응급실'],
      medication: ['약물', '처방전'],
      procedure: ['시술', '수술'],
      followup: ['추적', '경과', '재진']
    };
    
    const textLower = text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        return category;
      }
    }
    
    return 'unknown';
  }
  
  /**
   * 날짜 패턴 추출
   * @param {string} text - 입력 텍스트
   * @returns {Array} 날짜 매치 결과
   */
  extractDatePatterns(text) {
    const matches = [];
    
    for (const pattern of this.config.datePatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          match: match[0],
          groups: match.slice(1),
          index: match.index,
          pattern: pattern.source,
          type: this.classifyDatePattern(pattern.source)
        });
      }
    }
    
    // 중복 제거 및 정렬
    return this.removeDuplicates(matches).sort((a, b) => a.index - b.index);
  }
  
  /**
   * 날짜 패턴 분류
   * @param {string} patternSource - 패턴 소스
   * @returns {string} 패턴 타입
   */
  classifyDatePattern(patternSource) {
    if (patternSource.includes('년') || patternSource.includes('월') || patternSource.includes('일')) {
      return 'korean';
    } else if (patternSource.includes('Jan|Feb|Mar')) {
      return 'english_month';
    } else if (patternSource.includes('오늘|어제') || patternSource.includes('today|yesterday')) {
      return 'relative';
    } else if (patternSource.includes('일간|주간') || patternSource.includes('days?|weeks?')) {
      return 'duration';
    } else {
      return 'numeric';
    }
  }
  
  /**
   * 중복 날짜 제거
   * @param {Array} matches - 날짜 매치 배열
   * @returns {Array} 중복 제거된 배열
   */
  removeDuplicates(matches) {
    const unique = [];
    const seen = new Set();
    
    for (const match of matches) {
      const key = `${match.index}-${match.match}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(match);
      }
    }
    
    return unique;
  }
  
  /**
   * 날짜 정규화
   * @param {Array} dateMatches - 날짜 매치 배열
   * @returns {Array} 정규화된 날짜 배열
   */
  normalizeDates(dateMatches) {
    return dateMatches.map(match => {
      const normalized = this.normalizeDate(match);
      return {
        ...match,
        normalizedDate: normalized.date,
        confidence: normalized.confidence,
        isValid: normalized.isValid
      };
    }).filter(match => match.isValid);
  }
  
  /**
   * 개별 날짜 정규화
   * @param {Object} match - 날짜 매치 객체
   * @returns {Object} 정규화 결과
   */
  normalizeDate(match) {
    try {
      let year, month, day;
      let confidence = 0.8;
      
      switch (match.type) {
        case 'korean':
          if (match.groups.length >= 3) {
            year = match.groups[0];
            month = match.groups[1].padStart(2, '0');
            day = match.groups[2].padStart(2, '0');
          }
          break;
          
        case 'english_month':
          if (match.groups.length >= 3) {
            const monthName = match.groups[0] || match.groups[1];
            month = this.monthMap[monthName] || this.monthMap[monthName.substring(0, 3)];
            day = (match.groups[1] || match.groups[0]).padStart(2, '0');
            year = match.groups[2] || match.groups[3];
          }
          break;
          
        case 'numeric':
          if (match.groups.length >= 3) {
            // YYYY-MM-DD 또는 MM-DD-YYYY 형식 판단
            if (match.groups[0].length === 4) {
              year = match.groups[0];
              month = match.groups[1].padStart(2, '0');
              day = match.groups[2].padStart(2, '0');
            } else {
              month = match.groups[0].padStart(2, '0');
              day = match.groups[1].padStart(2, '0');
              year = match.groups[2];
            }
          }
          break;
          
        case 'relative':
          return this.processRelativeDate(match);
          
        case 'duration':
          confidence = 0.6;
          return {
            date: null,
            confidence,
            isValid: true,
            isDuration: true,
            duration: match.match
          };
          
        default:
          confidence = 0.5;
      }
      
      // 날짜 유효성 검증
      if (year && month && day) {
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() == year && date.getMonth() == month - 1 && date.getDate() == day) {
          return {
            date: `${year}-${month}-${day}`,
            confidence,
            isValid: true
          };
        }
      }
      
      return { date: null, confidence: 0, isValid: false };
      
    } catch (error) {
      logger.warn('날짜 정규화 오류', { match: match.match, error: error.message });
      return { date: null, confidence: 0, isValid: false };
    }
  }
  
  /**
   * 상대적 날짜 처리
   * @param {Object} match - 날짜 매치 객체
   * @returns {Object} 처리 결과
   */
  processRelativeDate(match) {
    const today = new Date();
    let targetDate = new Date(today);
    
    const relativeText = match.match.toLowerCase();
    
    if (relativeText.includes('오늘') || relativeText.includes('today')) {
      // 오늘 날짜 유지
    } else if (relativeText.includes('어제') || relativeText.includes('yesterday')) {
      targetDate.setDate(today.getDate() - 1);
    } else if (relativeText.includes('그제')) {
      targetDate.setDate(today.getDate() - 2);
    } else if (relativeText.includes('내일') || relativeText.includes('tomorrow')) {
      targetDate.setDate(today.getDate() + 1);
    } else if (relativeText.includes('모레')) {
      targetDate.setDate(today.getDate() + 2);
    }
    
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    
    return {
      date: `${year}-${month}-${day}`,
      confidence: 0.7,
      isValid: true,
      isRelative: true
    };
  }
  
  /**
   * 컨텍스트 추출
   * @param {string} text - 전체 텍스트
   * @param {Array} normalizedDates - 정규화된 날짜 배열
   * @returns {Array} 컨텍스트가 포함된 날짜 배열
   */
  extractContext(text, normalizedDates) {
    return normalizedDates.map(dateMatch => {
      const startIndex = Math.max(0, dateMatch.index - this.config.contextWindow);
      const endIndex = Math.min(text.length, dateMatch.index + dateMatch.match.length + this.config.contextWindow);
      
      const beforeContext = text.substring(startIndex, dateMatch.index);
      const afterContext = text.substring(dateMatch.index + dateMatch.match.length, endIndex);
      
      return {
        ...dateMatch,
        context: {
          before: beforeContext,
          after: afterContext,
          full: beforeContext + dateMatch.match + afterContext
        }
      };
    });
  }
  
  /**
   * 의료 관련성 분석
   * @param {Array} datesWithContext - 컨텍스트가 포함된 날짜 배열
   * @returns {Array} 의료 관련성이 분석된 날짜 배열
   */
  analyzeMedicalRelevance(datesWithContext) {
    return datesWithContext.map(dateMatch => {
      // context.full이 문자열인지 확인하고 처리
      const contextText = (typeof dateMatch.context.full === 'string' 
        ? dateMatch.context.full 
        : String(dateMatch.context.full || '')).toLowerCase();
      
      let medicalScore = 0;
      const foundKeywords = [];
      
      // 의료 키워드 검색
      for (const keyword of this.config.medicalKeywords) {
        if (contextText.includes(keyword.toLowerCase())) {
          medicalScore += 1;
          foundKeywords.push(keyword);
        }
      }
      
      // 의료 관련성 점수 정규화 (0-1)
      const normalizedScore = Math.min(medicalScore / 5, 1);
      
      return {
        ...dateMatch,
        medicalRelevance: {
          score: normalizedScore,
          foundKeywords,
          isMedicalRelated: normalizedScore > 0.2
        }
      };
    });
  }
  
  /**
   * 날짜 블록 생성
   * @param {Array} medicalRelevance - 의료 관련성이 분석된 날짜 배열
   * @returns {Array} 생성된 날짜 블록 배열
   */
  createDateBlocks(medicalRelevance) {
    return medicalRelevance.map((dateMatch, index) => {
      return {
        id: `block_${index + 1}`,
        date: dateMatch.date || dateMatch.normalizedDate,
        originalText: dateMatch.match || dateMatch.date,
        relatedInfo: (dateMatch.context && dateMatch.context.full) || '',
        position: {
          start: dateMatch.index || 0,
          end: (dateMatch.index || 0) + (dateMatch.match ? dateMatch.match.length : 0)
        },
        medicalRelevance: dateMatch.medicalRelevance || {},
        confidence: dateMatch.confidence || 0.5,
        type: dateMatch.type || 'date',
        isRelative: dateMatch.isRelative || false,
        isDuration: dateMatch.isDuration || false
      };
    });
  }
  
  /**
   * 블록 최적화 (병합 및 중복 제거)
   * @param {Array} dateBlocks - 날짜 블록 배열
   * @returns {Array} 최적화된 블록 배열
   */
  optimizeBlocks(dateBlocks) {
    // 1. 동일한 날짜의 블록들을 병합
    const mergedByDate = this.mergeBlocksByDate(dateBlocks);
    
    // 2. 근접한 블록들을 병합
    const mergedByProximity = this.mergeBlocksByProximity(mergedByDate);
    
    // 3. 신뢰도가 낮은 블록 필터링
    const filtered = mergedByProximity.filter(block => 
      block.confidence >= this.config.confidenceThreshold
    );
    
    return filtered;
  }
  
  /**
   * 동일 날짜 블록 병합
   * @param {Array} blocks - 블록 배열
   * @returns {Array} 병합된 블록 배열
   */
  mergeBlocksByDate(blocks) {
    const dateGroups = {};
    
    for (const block of blocks) {
      if (!block.date) continue;
      
      if (!dateGroups[block.date]) {
        dateGroups[block.date] = [];
      }
      dateGroups[block.date].push(block);
    }
    
    const merged = [];
    
    for (const [date, groupBlocks] of Object.entries(dateGroups)) {
      if (groupBlocks.length === 1) {
        merged.push(groupBlocks[0]);
      } else {
        // 여러 블록을 하나로 병합
        const mergedBlock = this.mergeSimilarBlocks(groupBlocks);
        merged.push(mergedBlock);
      }
    }
    
    return merged;
  }
  
  /**
   * 유사한 블록들 병합
   * @param {Array} blocks - 병합할 블록 배열
   * @returns {Object} 병합된 블록
   */
  mergeSimilarBlocks(blocks) {
    const firstBlock = blocks[0];
    
    return {
      ...firstBlock,
      id: `merged_${firstBlock.id}`,
      relatedInfo: blocks.map(b => b.relatedInfo).join('\n\n'),
      confidence: blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length,
      medicalRelevance: {
        score: Math.max(...blocks.map(b => b.medicalRelevance.score)),
        foundKeywords: [...new Set(blocks.flatMap(b => b.medicalRelevance.foundKeywords))],
        isMedicalRelated: blocks.some(b => b.medicalRelevance.isMedicalRelated)
      },
      mergedCount: blocks.length
    };
  }
  
  /**
   * 근접 블록 병합
   * @param {Array} blocks - 블록 배열
   * @returns {Array} 병합된 블록 배열
   */
  mergeBlocksByProximity(blocks) {
    const sorted = blocks.sort((a, b) => a.position.start - b.position.start);
    const merged = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      
      const distance = current.position.start - previous.position.end;
      
      if (distance <= this.config.mergeDistance) {
        currentGroup.push(current);
      } else {
        if (currentGroup.length > 1) {
          merged.push(this.mergeSimilarBlocks(currentGroup));
        } else {
          merged.push(currentGroup[0]);
        }
        currentGroup = [current];
      }
    }
    
    // 마지막 그룹 처리
    if (currentGroup.length > 1) {
      merged.push(this.mergeSimilarBlocks(currentGroup));
    } else if (currentGroup.length === 1) {
      merged.push(currentGroup[0]);
    }
    
    return merged;
  }
  
  /**
   * 신뢰도 계산
   * @param {Array} blocks - 블록 배열
   * @returns {Array} 신뢰도가 계산된 블록 배열
   */
  calculateConfidence(blocks) {
    return blocks.map(block => {
      let confidence = block.confidence;
      
      // 의료 관련성에 따른 신뢰도 조정
      if (block.medicalRelevance.isMedicalRelated) {
        confidence += block.medicalRelevance.score * 0.2;
      }
      
      // 병합된 블록의 신뢰도 보정
      if (block.mergedCount > 1) {
        confidence += 0.1;
      }
      
      // 상대적 날짜의 신뢰도 조정
      if (block.isRelative) {
        confidence -= 0.1;
      }
      
      // 기간 정보의 신뢰도 조정
      if (block.isDuration) {
        confidence -= 0.2;
      }
      
      return {
        ...block,
        confidence: Math.min(Math.max(confidence, 0), 1)
      };
    });
  }
  
  /**
   * 통계 업데이트
   */
  updateStats(datesFound, blocksCreated, finalBlocks) {
    this.stats.totalProcessed++;
    this.stats.datesFound += datesFound;
    this.stats.blocksCreated += blocksCreated;
    
    const avgConfidence = this.calculateAverageConfidence(finalBlocks);
    this.stats.averageConfidence = 
      (this.stats.averageConfidence * (this.stats.totalProcessed - 1) + avgConfidence) / this.stats.totalProcessed;
  }
  
  /**
   * 평균 신뢰도 계산
   */
  calculateAverageConfidence(blocks) {
    if (blocks.length === 0) return 0;
    return blocks.reduce((sum, block) => sum + block.confidence, 0) / blocks.length;
  }
  
  /**
   * 의료 관련성 점수 계산
   */
  calculateMedicalRelevanceScore(blocks) {
    if (blocks.length === 0) return 0;
    return blocks.reduce((sum, block) => sum + block.medicalRelevance.score, 0) / blocks.length;
  }
  
  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      averageBlocksPerDocument: this.stats.totalProcessed > 0 
        ? Math.round(this.stats.blocksCreated / this.stats.totalProcessed * 100) / 100
        : 0
    };
  }
}

export default DateBlockProcessor;

// CommonJS 호환성을 위한 추가 (제거)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DateBlockProcessor;
}