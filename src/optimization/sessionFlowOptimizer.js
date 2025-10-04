/**
 * Session Flow Optimizer
 * 
 * 연속 세션 흐름 최적화 및 토큰 효율성 극대화를 위한 전용 모듈
 * GPT-4o Mini Enhanced Service의 성능을 극대화하는 최적화 전략 구현
 */

export class SessionFlowOptimizer {
  constructor(options = {}) {
    // 최적화 설정
    this.config = {
      // 토큰 최적화
      maxTokensPerMessage: options.maxTokensPerMessage || 4000,
      tokenCompressionRatio: options.tokenCompressionRatio || 0.7,
      enableSmartTruncation: options.enableSmartTruncation ?? true,
      
      // 세션 최적화
      maxSessionLength: options.maxSessionLength || 10,
      enableContextCompression: options.enableContextCompression ?? true,
      enableIntelligentCaching: options.enableIntelligentCaching ?? true,
      
      // 성능 최적화
      enableParallelProcessing: options.enableParallelProcessing ?? false,
      enablePredictiveLoading: options.enablePredictiveLoading ?? true,
      enableAdaptiveTimeout: options.enableAdaptiveTimeout ?? true,
      
      // 품질 최적화
      enableQualityValidation: options.enableQualityValidation ?? true,
      minQualityThreshold: options.minQualityThreshold || 0.85,
      enableAutoRetry: options.enableAutoRetry ?? true
    };
    
    // 최적화 메트릭
    this.metrics = {
      tokenSavings: 0,
      compressionRatio: 0,
      processingSpeedup: 0,
      qualityScore: 0,
      cacheHitRate: 0,
      optimizationCount: 0
    };
    
    // 캐시 시스템
    this.cache = {
      preprocessingResults: new Map(),
      contextCompressions: new Map(),
      qualityValidations: new Map()
    };
    
    // 적응형 설정
    this.adaptiveSettings = {
      averageProcessingTime: 5000,
      averageTokenUsage: 3000,
      successRate: 0.95,
      lastOptimizationTime: Date.now()
    };
    
    console.log('🎯 Session Flow Optimizer 초기화 완료');
  }

  /**
   * 최적화 시작 (별칭 메서드)
   */
  async start() {
    console.log('🎯 Session Flow Optimizer 시작됨');
    return true;
  }

  /**
   * 최적화 중지 (별칭 메서드)
   */
  async stop() {
    console.log('🎯 Session Flow Optimizer 중지됨');
    return true;
  }

  /**
   * 세션 메시지 최적화
   * @param {Array} messages - 세션 메시지 배열
   * @param {Object} context - 컨텍스트 정보
   * @returns {Promise<Object>} 최적화된 메시지와 메트릭
   */
  async optimizeSessionMessages(messages, context = {}) {
    const startTime = Date.now();
    this.metrics.optimizationCount++;
    
    console.log('🔧 세션 메시지 최적화 시작...');
    
    try {
      let optimizedMessages = [...messages];
      const optimizationSteps = [];
      
      // 1. 토큰 압축 최적화
      if (this.config.enableSmartTruncation) {
        const tokenOptimized = await this.optimizeTokenUsage(optimizedMessages, context);
        optimizedMessages = tokenOptimized.messages;
        optimizationSteps.push({
          step: 'token_optimization',
          savings: tokenOptimized.savings,
          compressionRatio: tokenOptimized.compressionRatio
        });
      }
      
      // 2. 컨텍스트 압축
      if (this.config.enableContextCompression) {
        const contextOptimized = await this.compressContextIntelligently(optimizedMessages, context);
        optimizedMessages = contextOptimized.messages;
        optimizationSteps.push({
          step: 'context_compression',
          compressionRatio: contextOptimized.compressionRatio,
          retainedQuality: contextOptimized.qualityScore
        });
      }
      
      // 3. 세션 길이 최적화
      if (optimizedMessages.length > this.config.maxSessionLength) {
        const lengthOptimized = await this.optimizeSessionLength(optimizedMessages, context);
        optimizedMessages = lengthOptimized.messages;
        optimizationSteps.push({
          step: 'session_length_optimization',
          originalLength: messages.length,
          optimizedLength: optimizedMessages.length,
          retainedImportance: lengthOptimized.importanceScore
        });
      }
      
      // 4. 품질 검증 및 조정
      if (this.config.enableQualityValidation) {
        const qualityResult = await this.validateAndAdjustQuality(optimizedMessages, messages, context);
        if (qualityResult.needsAdjustment) {
          optimizedMessages = qualityResult.adjustedMessages;
          optimizationSteps.push({
            step: 'quality_adjustment',
            originalQuality: qualityResult.originalQuality,
            adjustedQuality: qualityResult.adjustedQuality
          });
        }
      }
      
      // 최적화 메트릭 계산
      const optimizationMetrics = this.calculateOptimizationMetrics(
        messages, 
        optimizedMessages, 
        optimizationSteps, 
        startTime
      );
      
      // 적응형 설정 업데이트
      this.updateAdaptiveSettings(optimizationMetrics);
      
      console.log('✅ 세션 메시지 최적화 완료');
      console.log(`📊 토큰 절약: ${optimizationMetrics.tokenSavingsPercent.toFixed(1)}%`);
      console.log(`⚡ 처리 속도 향상: ${optimizationMetrics.speedupPercent.toFixed(1)}%`);
      
      return {
        optimizedMessages,
        originalMessageCount: messages.length,
        optimizedMessageCount: optimizedMessages.length,
        optimizationSteps,
        metrics: optimizationMetrics,
        cacheInfo: this.getCacheInfo()
      };
      
    } catch (error) {
      console.error('❌ 세션 메시지 최적화 실패:', error);
      throw new Error(`세션 최적화 실패: ${error.message}`);
    }
  }

  /**
   * 토큰 사용량 최적화
   * @param {Array} messages - 메시지 배열
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Object>} 최적화 결과
   */
  async optimizeTokenUsage(messages, context) {
    console.log('🪙 토큰 사용량 최적화 중...');
    
    const optimizedMessages = [];
    let totalTokenSavings = 0;
    
    for (const message of messages) {
      const originalTokens = this.estimateTokenCount(message.content);
      
      if (originalTokens > this.config.maxTokensPerMessage) {
        // 스마트 압축 적용
        const compressed = await this.smartCompressMessage(message, context);
        optimizedMessages.push(compressed.message);
        totalTokenSavings += compressed.tokenSavings;
      } else {
        optimizedMessages.push(message);
      }
    }
    
    const originalTotalTokens = messages.reduce((sum, msg) => 
      sum + this.estimateTokenCount(msg.content), 0
    );
    const optimizedTotalTokens = optimizedMessages.reduce((sum, msg) => 
      sum + this.estimateTokenCount(msg.content), 0
    );
    
    return {
      messages: optimizedMessages,
      savings: totalTokenSavings,
      compressionRatio: optimizedTotalTokens / originalTotalTokens,
      originalTokens: originalTotalTokens,
      optimizedTokens: optimizedTotalTokens
    };
  }

  /**
   * 스마트 메시지 압축
   * @param {Object} message - 메시지 객체
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Object>} 압축 결과
   */
  async smartCompressMessage(message, context) {
    const originalContent = message.content;
    const originalTokens = this.estimateTokenCount(originalContent);
    
    // 캐시 확인
    const cacheKey = this.generateCacheKey('compression', originalContent);
    if (this.cache.contextCompressions.has(cacheKey)) {
      const cached = this.cache.contextCompressions.get(cacheKey);
      return {
        message: { ...message, content: cached.compressed },
        tokenSavings: cached.tokenSavings,
        fromCache: true
      };
    }
    
    let compressedContent = originalContent;
    
    // 1. 중복 제거
    compressedContent = this.removeDuplicateInformation(compressedContent);
    
    // 2. 불필요한 공백 및 포맷팅 최적화
    compressedContent = this.optimizeFormatting(compressedContent);
    
    // 3. 핵심 정보 추출 및 요약
    if (message.role === 'user' && originalTokens > this.config.maxTokensPerMessage * 1.5) {
      compressedContent = await this.extractKeyInformation(compressedContent, context);
    }
    
    // 4. 의료 용어 최적화
    compressedContent = this.optimizeMedicalTerminology(compressedContent);
    
    const compressedTokens = this.estimateTokenCount(compressedContent);
    const tokenSavings = originalTokens - compressedTokens;
    
    // 캐시에 저장
    this.cache.contextCompressions.set(cacheKey, {
      compressed: compressedContent,
      tokenSavings: tokenSavings,
      timestamp: Date.now()
    });
    
    return {
      message: { ...message, content: compressedContent },
      tokenSavings: tokenSavings,
      fromCache: false
    };
  }

  /**
   * 중복 정보 제거
   * @param {string} content - 원본 내용
   * @returns {string} 중복 제거된 내용
   */
  removeDuplicateInformation(content) {
    // 중복된 문장 제거
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const uniqueSentences = [];
    const seenSentences = new Set();
    
    for (const sentence of sentences) {
      const normalized = sentence.trim().toLowerCase();
      if (!seenSentences.has(normalized) && normalized.length > 10) {
        uniqueSentences.push(sentence.trim());
        seenSentences.add(normalized);
      }
    }
    
    return uniqueSentences.join('. ') + '.';
  }

  /**
   * 포맷팅 최적화
   * @param {string} content - 원본 내용
   * @returns {string} 최적화된 내용
   */
  optimizeFormatting(content) {
    return content
      // 연속된 공백 제거
      .replace(/\s+/g, ' ')
      // 연속된 줄바꿈 최적화
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 불필요한 특수문자 제거
      .replace(/[^\w\s가-힣.,!?:;()\-\n]/g, '')
      // 앞뒤 공백 제거
      .trim();
  }

  /**
   * 핵심 정보 추출
   * @param {string} content - 원본 내용
   * @param {Object} context - 컨텍스트
   * @returns {Promise<string>} 추출된 핵심 정보
   */
  async extractKeyInformation(content, context) {
    // 의료 관련 키워드 우선순위
    const medicalKeywords = [
      '진단', '치료', '처방', '수술', '검사', '증상', '병원', '의사',
      '약물', '투약', '입원', '퇴원', '응급', '중환자', '수혈', '마취'
    ];
    
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const scoredSentences = sentences.map(sentence => {
      let score = 0;
      
      // 의료 키워드 점수
      medicalKeywords.forEach(keyword => {
        if (sentence.includes(keyword)) score += 10;
      });
      
      // 날짜 정보 점수
      if (/\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(sentence)) score += 15;
      
      // 숫자 정보 점수 (용량, 수치 등)
      if (/\d+/.test(sentence)) score += 5;
      
      // 문장 길이 점수 (너무 짧거나 긴 문장 페널티)
      const length = sentence.trim().length;
      if (length > 20 && length < 200) score += 5;
      
      return { sentence: sentence.trim(), score };
    });
    
    // 상위 점수 문장들 선택
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.ceil(sentences.length * this.config.tokenCompressionRatio))
      .map(item => item.sentence);
    
    return topSentences.join('. ') + '.';
  }

  /**
   * 의료 용어 최적화
   * @param {string} content - 원본 내용
   * @returns {string} 최적화된 내용
   */
  optimizeMedicalTerminology(content) {
    // 의료 용어 축약 매핑
    const abbreviations = {
      '고혈압': 'HTN',
      '당뇨병': 'DM',
      '심근경색': 'MI',
      '뇌졸중': 'CVA',
      '폐렴': 'PNA',
      '요로감염': 'UTI',
      '상부호흡기감염': 'URI',
      '위장관출혈': 'GI bleeding',
      '급성신부전': 'ARF',
      '만성신부전': 'CRF'
    };
    
    let optimized = content;
    Object.entries(abbreviations).forEach(([full, abbr]) => {
      const regex = new RegExp(full, 'g');
      optimized = optimized.replace(regex, abbr);
    });
    
    return optimized;
  }

  /**
   * 컨텍스트 지능형 압축
   * @param {Array} messages - 메시지 배열
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Object>} 압축 결과
   */
  async compressContextIntelligently(messages, context) {
    console.log('🗜️ 컨텍스트 지능형 압축 중...');
    
    if (messages.length <= 3) {
      return {
        messages,
        compressionRatio: 1.0,
        qualityScore: 1.0
      };
    }
    
    // 메시지 중요도 분석
    const messageImportance = await this.analyzeMessageImportance(messages, context);
    
    // 중요도 기반 압축
    const compressedMessages = [];
    let totalImportance = 0;
    let retainedImportance = 0;
    
    messageImportance.forEach(({ message, importance }) => {
      totalImportance += importance;
      
      if (importance > 0.7 || message.role === 'system') {
        // 높은 중요도 메시지는 유지
        compressedMessages.push(message);
        retainedImportance += importance;
      } else if (importance > 0.4) {
        // 중간 중요도 메시지는 요약
        const summarized = this.summarizeMessage(message);
        compressedMessages.push(summarized);
        retainedImportance += importance * 0.8;
      }
      // 낮은 중요도 메시지는 제거
    });
    
    const qualityScore = totalImportance > 0 ? retainedImportance / totalImportance : 1.0;
    
    return {
      messages: compressedMessages,
      compressionRatio: compressedMessages.length / messages.length,
      qualityScore: qualityScore
    };
  }

  /**
   * 메시지 중요도 분석
   * @param {Array} messages - 메시지 배열
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Array>} 중요도가 포함된 메시지 배열
   */
  async analyzeMessageImportance(messages, context) {
    return messages.map((message, index) => {
      let importance = 0.5; // 기본 중요도
      
      // 역할별 중요도
      if (message.role === 'system') importance += 0.4;
      if (message.role === 'assistant') importance += 0.2;
      
      // 위치별 중요도 (첫 번째와 마지막 메시지는 중요)
      if (index === 0 || index === messages.length - 1) importance += 0.3;
      
      // 내용 기반 중요도
      const content = message.content.toLowerCase();
      
      // 의료 핵심 키워드
      const criticalKeywords = ['진단', '치료', '처방', '수술', '응급', '중환자'];
      criticalKeywords.forEach(keyword => {
        if (content.includes(keyword)) importance += 0.1;
      });
      
      // 구조화된 데이터 포함 여부
      if (content.includes('structureddata') || content.includes('json')) {
        importance += 0.2;
      }
      
      // 날짜 정보 포함 여부
      if (/\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(content)) {
        importance += 0.1;
      }
      
      // 최대값 제한
      importance = Math.min(1.0, importance);
      
      return { message, importance };
    });
  }

  /**
   * 메시지 요약
   * @param {Object} message - 메시지 객체
   * @returns {Object} 요약된 메시지
   */
  summarizeMessage(message) {
    const content = message.content;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    if (sentences.length <= 2) {
      return message; // 이미 충분히 짧음
    }
    
    // 핵심 문장 추출 (첫 번째와 마지막 문장, 그리고 키워드가 많은 문장)
    const keySentences = [
      sentences[0], // 첫 번째 문장
      ...sentences.slice(1, -1).filter(s => 
        /진단|치료|처방|수술|검사/.test(s)
      ).slice(0, 1), // 중간의 핵심 문장 1개
      sentences[sentences.length - 1] // 마지막 문장
    ].filter(Boolean);
    
    return {
      ...message,
      content: keySentences.join('. ') + '.'
    };
  }

  /**
   * 세션 길이 최적화
   * @param {Array} messages - 메시지 배열
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Object>} 최적화 결과
   */
  async optimizeSessionLength(messages, context) {
    console.log('📏 세션 길이 최적화 중...');
    
    if (messages.length <= this.config.maxSessionLength) {
      return {
        messages,
        importanceScore: 1.0
      };
    }
    
    // 메시지 중요도 재분석
    const messageImportance = await this.analyzeMessageImportance(messages, context);
    
    // 중요도 순으로 정렬하되, 시스템 메시지와 순서는 유지
    const systemMessages = messageImportance.filter(item => item.message.role === 'system');
    const otherMessages = messageImportance.filter(item => item.message.role !== 'system');
    
    // 다른 메시지들을 중요도 순으로 정렬
    otherMessages.sort((a, b) => b.importance - a.importance);
    
    // 최대 길이에 맞춰 선택
    const selectedOtherMessages = otherMessages.slice(0, this.config.maxSessionLength - systemMessages.length);
    
    // 원래 순서대로 재정렬
    const allSelectedMessages = [...systemMessages, ...selectedOtherMessages];
    const originalIndices = allSelectedMessages.map(item => messages.indexOf(item.message));
    originalIndices.sort((a, b) => a - b);
    
    const optimizedMessages = originalIndices.map(index => messages[index]);
    
    // 중요도 점수 계산
    const totalImportance = messageImportance.reduce((sum, item) => sum + item.importance, 0);
    const retainedImportance = allSelectedMessages.reduce((sum, item) => sum + item.importance, 0);
    const importanceScore = totalImportance > 0 ? retainedImportance / totalImportance : 1.0;
    
    return {
      messages: optimizedMessages,
      importanceScore: importanceScore
    };
  }

  /**
   * 품질 검증 및 조정
   * @param {Array} optimizedMessages - 최적화된 메시지
   * @param {Array} originalMessages - 원본 메시지
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Object>} 품질 검증 결과
   */
  async validateAndAdjustQuality(optimizedMessages, originalMessages, context) {
    console.log('🔍 품질 검증 및 조정 중...');
    
    const qualityScore = await this.calculateQualityScore(optimizedMessages, originalMessages, context);
    
    if (qualityScore >= this.config.minQualityThreshold) {
      return {
        needsAdjustment: false,
        originalQuality: qualityScore,
        adjustedQuality: qualityScore
      };
    }
    
    console.log(`⚠️ 품질 점수 ${qualityScore.toFixed(3)} < 임계값 ${this.config.minQualityThreshold}`);
    
    // 품질 개선을 위한 조정
    const adjustedMessages = await this.adjustForQuality(optimizedMessages, originalMessages, context);
    const adjustedQuality = await this.calculateQualityScore(adjustedMessages, originalMessages, context);
    
    return {
      needsAdjustment: true,
      adjustedMessages: adjustedMessages,
      originalQuality: qualityScore,
      adjustedQuality: adjustedQuality
    };
  }

  /**
   * 품질 점수 계산
   * @param {Array} optimizedMessages - 최적화된 메시지
   * @param {Array} originalMessages - 원본 메시지
   * @param {Object} context - 컨텍스트
   * @returns {Promise<number>} 품질 점수 (0-1)
   */
  async calculateQualityScore(optimizedMessages, originalMessages, context) {
    let qualityScore = 0;
    
    // 1. 정보 보존율 (40%)
    const informationRetention = this.calculateInformationRetention(optimizedMessages, originalMessages);
    qualityScore += informationRetention * 0.4;
    
    // 2. 의료 키워드 보존율 (30%)
    const medicalKeywordRetention = this.calculateMedicalKeywordRetention(optimizedMessages, originalMessages);
    qualityScore += medicalKeywordRetention * 0.3;
    
    // 3. 구조적 완전성 (20%)
    const structuralCompleteness = this.calculateStructuralCompleteness(optimizedMessages, originalMessages);
    qualityScore += structuralCompleteness * 0.2;
    
    // 4. 컨텍스트 일관성 (10%)
    const contextConsistency = this.calculateContextConsistency(optimizedMessages);
    qualityScore += contextConsistency * 0.1;
    
    return Math.min(1.0, qualityScore);
  }

  /**
   * 정보 보존율 계산
   * @param {Array} optimized - 최적화된 메시지
   * @param {Array} original - 원본 메시지
   * @returns {number} 정보 보존율
   */
  calculateInformationRetention(optimized, original) {
    const originalTokens = original.reduce((sum, msg) => sum + this.estimateTokenCount(msg.content), 0);
    const optimizedTokens = optimized.reduce((sum, msg) => sum + this.estimateTokenCount(msg.content), 0);
    
    return optimizedTokens / originalTokens;
  }

  /**
   * 의료 키워드 보존율 계산
   * @param {Array} optimized - 최적화된 메시지
   * @param {Array} original - 원본 메시지
   * @returns {number} 의료 키워드 보존율
   */
  calculateMedicalKeywordRetention(optimized, original) {
    const medicalKeywords = [
      '진단', '치료', '처방', '수술', '검사', '증상', '병원', '의사',
      '약물', '투약', '입원', '퇴원', '응급', '중환자', '수혈', '마취',
      '고혈압', '당뇨병', '심근경색', '뇌졸중', '폐렴', '감염'
    ];
    
    const originalKeywords = this.extractKeywords(original, medicalKeywords);
    const optimizedKeywords = this.extractKeywords(optimized, medicalKeywords);
    
    if (originalKeywords.size === 0) return 1.0;
    
    const retainedKeywords = [...optimizedKeywords].filter(keyword => originalKeywords.has(keyword));
    return retainedKeywords.length / originalKeywords.size;
  }

  /**
   * 키워드 추출
   * @param {Array} messages - 메시지 배열
   * @param {Array} keywords - 키워드 목록
   * @returns {Set} 추출된 키워드 집합
   */
  extractKeywords(messages, keywords) {
    const found = new Set();
    const allContent = messages.map(msg => msg.content).join(' ').toLowerCase();
    
    keywords.forEach(keyword => {
      if (allContent.includes(keyword.toLowerCase())) {
        found.add(keyword);
      }
    });
    
    return found;
  }

  /**
   * 구조적 완전성 계산
   * @param {Array} optimized - 최적화된 메시지
   * @param {Array} original - 원본 메시지
   * @returns {number} 구조적 완전성 점수
   */
  calculateStructuralCompleteness(optimized, original) {
    let score = 0;
    
    // 시스템 메시지 보존 여부
    const hasSystemMessage = optimized.some(msg => msg.role === 'system');
    if (hasSystemMessage) score += 0.4;
    
    // 사용자-어시스턴트 대화 구조 보존
    const hasUserMessage = optimized.some(msg => msg.role === 'user');
    const hasAssistantMessage = optimized.some(msg => msg.role === 'assistant');
    if (hasUserMessage && hasAssistantMessage) score += 0.4;
    
    // 메시지 순서 일관성
    const orderConsistency = this.calculateOrderConsistency(optimized, original);
    score += orderConsistency * 0.2;
    
    return Math.min(1.0, score);
  }

  /**
   * 순서 일관성 계산
   * @param {Array} optimized - 최적화된 메시지
   * @param {Array} original - 원본 메시지
   * @returns {number} 순서 일관성 점수
   */
  calculateOrderConsistency(optimized, original) {
    if (optimized.length <= 1) return 1.0;
    
    let consistentPairs = 0;
    let totalPairs = 0;
    
    for (let i = 0; i < optimized.length - 1; i++) {
      const currentIndex = original.indexOf(optimized[i]);
      const nextIndex = original.indexOf(optimized[i + 1]);
      
      if (currentIndex !== -1 && nextIndex !== -1) {
        totalPairs++;
        if (currentIndex < nextIndex) {
          consistentPairs++;
        }
      }
    }
    
    return totalPairs > 0 ? consistentPairs / totalPairs : 1.0;
  }

  /**
   * 컨텍스트 일관성 계산
   * @param {Array} messages - 메시지 배열
   * @returns {number} 컨텍스트 일관성 점수
   */
  calculateContextConsistency(messages) {
    if (messages.length <= 1) return 1.0;
    
    let consistencyScore = 0;
    
    // 역할 전환의 자연스러움
    let roleTransitions = 0;
    let naturalTransitions = 0;
    
    for (let i = 0; i < messages.length - 1; i++) {
      const currentRole = messages[i].role;
      const nextRole = messages[i + 1].role;
      
      if (currentRole !== nextRole) {
        roleTransitions++;
        // 자연스러운 전환 패턴 확인
        if ((currentRole === 'user' && nextRole === 'assistant') ||
            (currentRole === 'system' && nextRole === 'user')) {
          naturalTransitions++;
        }
      }
    }
    
    if (roleTransitions > 0) {
      consistencyScore += (naturalTransitions / roleTransitions) * 0.5;
    } else {
      consistencyScore += 0.5;
    }
    
    // 내용의 연속성
    const contentContinuity = this.calculateContentContinuity(messages);
    consistencyScore += contentContinuity * 0.5;
    
    return Math.min(1.0, consistencyScore);
  }

  /**
   * 내용 연속성 계산
   * @param {Array} messages - 메시지 배열
   * @returns {number} 내용 연속성 점수
   */
  calculateContentContinuity(messages) {
    if (messages.length <= 1) return 1.0;
    
    let continuityScore = 0;
    let comparisons = 0;
    
    for (let i = 0; i < messages.length - 1; i++) {
      const current = messages[i].content.toLowerCase();
      const next = messages[i + 1].content.toLowerCase();
      
      // 공통 키워드 비율 계산
      const currentWords = new Set(current.split(/\s+/));
      const nextWords = new Set(next.split(/\s+/));
      const commonWords = [...currentWords].filter(word => nextWords.has(word));
      
      if (currentWords.size > 0 && nextWords.size > 0) {
        const similarity = commonWords.length / Math.max(currentWords.size, nextWords.size);
        continuityScore += similarity;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? continuityScore / comparisons : 1.0;
  }

  /**
   * 품질 개선을 위한 조정
   * @param {Array} optimizedMessages - 최적화된 메시지
   * @param {Array} originalMessages - 원본 메시지
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Array>} 조정된 메시지
   */
  async adjustForQuality(optimizedMessages, originalMessages, context) {
    console.log('🔧 품질 개선을 위한 조정 중...');
    
    let adjustedMessages = [...optimizedMessages];
    
    // 1. 중요한 메시지 복원
    const missingImportantMessages = await this.findMissingImportantMessages(
      optimizedMessages, 
      originalMessages, 
      context
    );
    
    if (missingImportantMessages.length > 0) {
      console.log(`📝 중요 메시지 ${missingImportantMessages.length}개 복원`);
      adjustedMessages = this.insertImportantMessages(adjustedMessages, missingImportantMessages, originalMessages);
    }
    
    // 2. 세션 길이 제한 내에서 조정
    if (adjustedMessages.length > this.config.maxSessionLength) {
      adjustedMessages = await this.rebalanceForLength(adjustedMessages, context);
    }
    
    return adjustedMessages;
  }

  /**
   * 누락된 중요 메시지 찾기
   * @param {Array} optimized - 최적화된 메시지
   * @param {Array} original - 원본 메시지
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Array>} 누락된 중요 메시지
   */
  async findMissingImportantMessages(optimized, original, context) {
    const optimizedSet = new Set(optimized.map(msg => msg.content));
    const missing = [];
    
    for (const originalMsg of original) {
      if (!optimizedSet.has(originalMsg.content)) {
        // 중요도 재평가
        const importance = await this.evaluateMessageImportance(originalMsg, context);
        if (importance > 0.8) {
          missing.push({ message: originalMsg, importance });
        }
      }
    }
    
    return missing.sort((a, b) => b.importance - a.importance);
  }

  /**
   * 메시지 중요도 평가
   * @param {Object} message - 메시지
   * @param {Object} context - 컨텍스트
   * @returns {Promise<number>} 중요도 점수
   */
  async evaluateMessageImportance(message, context) {
    let importance = 0.5;
    const content = message.content.toLowerCase();
    
    // 시스템 메시지는 항상 중요
    if (message.role === 'system') importance = 0.9;
    
    // 의료 핵심 키워드
    const criticalKeywords = ['진단', '치료', '처방', '수술', '응급', '중환자', '사망', '위험'];
    criticalKeywords.forEach(keyword => {
      if (content.includes(keyword)) importance += 0.1;
    });
    
    // 구조화된 데이터
    if (content.includes('structureddata') || content.includes('{')) importance += 0.2;
    
    // 날짜 및 시간 정보
    if (/\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(content)) importance += 0.1;
    
    return Math.min(1.0, importance);
  }

  /**
   * 중요 메시지 삽입
   * @param {Array} messages - 현재 메시지
   * @param {Array} importantMessages - 중요 메시지
   * @param {Array} originalMessages - 원본 메시지
   * @returns {Array} 조정된 메시지
   */
  insertImportantMessages(messages, importantMessages, originalMessages) {
    const result = [...messages];
    
    // 원본 순서를 유지하면서 중요 메시지 삽입
    importantMessages.forEach(({ message }) => {
      const originalIndex = originalMessages.indexOf(message);
      
      // 적절한 위치 찾기
      let insertIndex = result.length;
      for (let i = 0; i < result.length; i++) {
        const currentOriginalIndex = originalMessages.indexOf(result[i]);
        if (currentOriginalIndex > originalIndex) {
          insertIndex = i;
          break;
        }
      }
      
      result.splice(insertIndex, 0, message);
    });
    
    return result;
  }

  /**
   * 길이 제한을 위한 재균형
   * @param {Array} messages - 메시지 배열
   * @param {Object} context - 컨텍스트
   * @returns {Promise<Array>} 재균형된 메시지
   */
  async rebalanceForLength(messages, context) {
    if (messages.length <= this.config.maxSessionLength) {
      return messages;
    }
    
    // 중요도 재계산
    const messageImportance = await Promise.all(
      messages.map(async msg => ({
        message: msg,
        importance: await this.evaluateMessageImportance(msg, context)
      }))
    );
    
    // 중요도 순으로 정렬하되 시스템 메시지는 우선 유지
    const systemMessages = messageImportance.filter(item => item.message.role === 'system');
    const otherMessages = messageImportance.filter(item => item.message.role !== 'system');
    
    otherMessages.sort((a, b) => b.importance - a.importance);
    
    const maxOtherMessages = this.config.maxSessionLength - systemMessages.length;
    const selectedOtherMessages = otherMessages.slice(0, maxOtherMessages);
    
    // 원래 순서로 재정렬
    const allSelected = [...systemMessages, ...selectedOtherMessages];
    const originalIndices = allSelected.map(item => messages.indexOf(item.message));
    originalIndices.sort((a, b) => a - b);
    
    return originalIndices.map(index => messages[index]);
  }

  /**
   * 최적화 메트릭 계산
   * @param {Array} original - 원본 메시지
   * @param {Array} optimized - 최적화된 메시지
   * @param {Array} steps - 최적화 단계
   * @param {number} startTime - 시작 시간
   * @returns {Object} 최적화 메트릭
   */
  calculateOptimizationMetrics(original, optimized, steps, startTime) {
    const processingTime = Date.now() - startTime;
    
    const originalTokens = original.reduce((sum, msg) => sum + this.estimateTokenCount(msg.content), 0);
    const optimizedTokens = optimized.reduce((sum, msg) => sum + this.estimateTokenCount(msg.content), 0);
    
    const tokenSavings = originalTokens - optimizedTokens;
    const tokenSavingsPercent = originalTokens > 0 ? (tokenSavings / originalTokens) * 100 : 0;
    
    // 예상 처리 시간 개선
    const baseProcessingTime = this.adaptiveSettings.averageProcessingTime;
    const estimatedSpeedup = Math.max(0, (tokenSavingsPercent / 100) * 0.3 * baseProcessingTime);
    const speedupPercent = baseProcessingTime > 0 ? (estimatedSpeedup / baseProcessingTime) * 100 : 0;
    
    // 메트릭 업데이트
    this.metrics.tokenSavings = (this.metrics.tokenSavings + tokenSavingsPercent) / 2;
    this.metrics.processingSpeedup = (this.metrics.processingSpeedup + speedupPercent) / 2;
    this.metrics.compressionRatio = optimizedTokens / originalTokens;
    
    return {
      originalTokens,
      optimizedTokens,
      tokenSavings,
      tokenSavingsPercent,
      speedupPercent,
      processingTime,
      messageReduction: original.length - optimized.length,
      messageReductionPercent: ((original.length - optimized.length) / original.length) * 100,
      optimizationSteps: steps.length,
      efficiency: {
        tokenEfficiency: this.metrics.compressionRatio,
        speedEfficiency: speedupPercent / 100,
        qualityRetention: this.metrics.qualityScore
      }
    };
  }

  /**
   * 적응형 설정 업데이트
   * @param {Object} metrics - 최적화 메트릭
   */
  updateAdaptiveSettings(metrics) {
    // 평균 처리 시간 업데이트
    this.adaptiveSettings.averageProcessingTime = 
      (this.adaptiveSettings.averageProcessingTime * 0.8) + (metrics.processingTime * 0.2);
    
    // 평균 토큰 사용량 업데이트
    this.adaptiveSettings.averageTokenUsage = 
      (this.adaptiveSettings.averageTokenUsage * 0.8) + (metrics.optimizedTokens * 0.2);
    
    // 성공률 업데이트 (품질 기준 충족 여부)
    const success = metrics.tokenSavingsPercent > 10 && this.metrics.qualityScore > 0.8 ? 1 : 0;
    this.adaptiveSettings.successRate = 
      (this.adaptiveSettings.successRate * 0.9) + (success * 0.1);
    
    this.adaptiveSettings.lastOptimizationTime = Date.now();
    
    // 설정 자동 조정
    this.autoAdjustSettings();
  }

  /**
   * 설정 자동 조정
   */
  autoAdjustSettings() {
    // 성공률이 낮으면 더 보수적으로 조정
    if (this.adaptiveSettings.successRate < 0.7) {
      this.config.tokenCompressionRatio = Math.min(0.9, this.config.tokenCompressionRatio + 0.1);
      this.config.minQualityThreshold = Math.max(0.7, this.config.minQualityThreshold - 0.05);
    }
    
    // 성공률이 높으면 더 적극적으로 최적화
    if (this.adaptiveSettings.successRate > 0.9) {
      this.config.tokenCompressionRatio = Math.max(0.5, this.config.tokenCompressionRatio - 0.05);
      this.config.minQualityThreshold = Math.min(0.95, this.config.minQualityThreshold + 0.02);
    }
  }

  /**
   * 토큰 수 추정
   * @param {string} text - 텍스트
   * @returns {number} 추정 토큰 수
   */
  estimateTokenCount(text) {
    // GPT-4o Mini에 최적화된 토큰 추정
    return Math.ceil(text.length / 3.5);
  }

  /**
   * 캐시 키 생성
   * @param {string} type - 캐시 타입
   * @param {string} content - 내용
   * @returns {string} 캐시 키
   */
  generateCacheKey(type, content) {
    const hash = content.length.toString(36) + content.slice(0, 50).replace(/\s/g, '');
    return `${type}_${hash}`;
  }

  /**
   * 캐시 정보 반환
   * @returns {Object} 캐시 정보
   */
  getCacheInfo() {
    return {
      preprocessingCache: this.cache.preprocessingResults.size,
      compressionCache: this.cache.contextCompressions.size,
      qualityCache: this.cache.qualityValidations.size,
      totalCacheSize: this.cache.preprocessingResults.size + 
                     this.cache.contextCompressions.size + 
                     this.cache.qualityValidations.size
    };
  }

  /**
   * 캐시 정리
   * @param {number} maxAge - 최대 보관 시간 (밀리초)
   */
  cleanupCache(maxAge = 3600000) { // 1시간
    const now = Date.now();
    
    [this.cache.preprocessingResults, this.cache.contextCompressions, this.cache.qualityValidations]
      .forEach(cache => {
        for (const [key, value] of cache.entries()) {
          if (now - value.timestamp > maxAge) {
            cache.delete(key);
          }
        }
      });
  }

  /**
   * 성능 메트릭 반환
   * @returns {Object} 현재 성능 메트릭
   */
  getPerformanceMetrics() {
    return {
      ...this.metrics,
      adaptiveSettings: { ...this.adaptiveSettings },
      cacheInfo: this.getCacheInfo()
    };
  }

  /**
   * 최적화 리포트 생성
   * @returns {Object} 최적화 리포트
   */
  generateOptimizationReport() {
    return {
      summary: {
        optimizationCount: this.metrics.optimizationCount,
        averageTokenSavings: `${this.metrics.tokenSavings.toFixed(1)}%`,
        averageSpeedup: `${this.metrics.processingSpeedup.toFixed(1)}%`,
        qualityScore: this.metrics.qualityScore.toFixed(3),
        cacheHitRate: `${this.metrics.cacheHitRate.toFixed(1)}%`
      },
      performance: {
        tokenEfficiency: this.metrics.compressionRatio.toFixed(3),
        processingEfficiency: (this.metrics.processingSpeedup / 100).toFixed(3),
        qualityRetention: this.metrics.qualityScore.toFixed(3)
      },
      adaptive: {
        currentSettings: this.config,
        adaptiveMetrics: this.adaptiveSettings,
        autoAdjustmentEnabled: true
      },
      cache: this.getCacheInfo(),
      recommendations: this.generateOptimizationRecommendations()
    };
  }

  /**
   * 최적화 권장사항 생성
   * @returns {Array} 권장사항 목록
   */
  generateOptimizationRecommendations() {
    const recommendations = [];
    
    if (this.metrics.tokenSavings < 15) {
      recommendations.push('토큰 절약 효과가 낮습니다. 압축 비율을 조정하세요.');
    }
    
    if (this.metrics.qualityScore < 0.8) {
      recommendations.push('품질 점수가 낮습니다. 품질 임계값을 높이거나 압축을 완화하세요.');
    }
    
    if (this.metrics.cacheHitRate < 0.3) {
      recommendations.push('캐시 활용률이 낮습니다. 캐시 전략을 개선하세요.');
    }
    
    if (this.adaptiveSettings.successRate < 0.7) {
      recommendations.push('최적화 성공률이 낮습니다. 설정을 보수적으로 조정하세요.');
    }
    
    return recommendations;
  }
}

export default SessionFlowOptimizer;