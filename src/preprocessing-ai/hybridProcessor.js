/**
 * 하이브리드 프로세서 - AI와 룰 기반 처리를 결합
 * AI 전처리와 룰 기반 처리를 조합하여 최적의 결과를 제공
 */

class HybridProcessor {
  constructor(options = {}) {
    // 하이브리드 설정 - 기본적으로 AI 활성화, 비상시에만 룰엔진 단독모드
    this.useAIPreprocessing = options.useAIPreprocessing !== false; // 기본값: true
    this.fallbackToRules = options.fallbackToRules !== false;
    this.enableCaching = options.enableCaching !== false;
    this.emergencyMode = options.emergencyMode === true; // 비상모드 설정
    this.preprocessingAI = null;
    
    console.log('🔧 HybridProcessor 설정:', {
      useAIPreprocessing: this.useAIPreprocessing,
      fallbackToRules: this.fallbackToRules,
      enableCaching: this.enableCaching,
      emergencyMode: this.emergencyMode
    });
    
    // 캐싱 시스템
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // 성능 메트릭
    this.metrics = {
      totalProcessed: 0,
      aiProcessed: 0,
      ruleProcessed: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      accuracy: 0,
      confidence: 0
    };
    
    // 룰 엔진 설정
    this.ruleEngine = {
      patterns: {
        patientName: /환자명\s*[:：]\s*([^\n\r]+)/gi,
        birthDate: /생년월일\s*[:：]\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/gi,
        visitDate: /진료일\s*[:：]\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/gi,
        diagnosis: /진단\s*[:：]\s*([^\n\r]+)/gi,
        prescription: /처방\s*[:：]\s*([^\n\r]+)/gi,
        nextVisit: /다음\s*진료\s*예정일\s*[:：]\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/gi,
        contact: /연락처\s*[:：]\s*([\d-]+)/gi
      }
    };

    // AI 전처리가 활성화된 경우에만 PreprocessingAI 초기화
    // 비상모드가 아니고 AI 전처리가 활성화된 경우에만 초기화
    if (this.useAIPreprocessing && !this.emergencyMode) {
      console.log('🤖 PreprocessingAI 초기화 중...');
      this.initializeAI(options);
    } else if (this.emergencyMode) {
      console.log('🚨 비상모드 활성화 - 룰 기반 처리만 사용');
    } else {
      console.log('⚙️ AI 전처리 비활성화 - 룰 기반 처리만 사용');
    }
  }

  async initializeAI(options) {
    // AI 전처리가 비활성화되거나 비상모드인 경우 초기화 건너뛰기
    if (!this.useAIPreprocessing || this.emergencyMode) {
      console.log('⚠️ AI 전처리가 비활성화되어 있거나 비상모드로 인해 PreprocessingAI 초기화를 건너뜁니다.');
      return;
    }

    try {
      // 동적으로 PreprocessingAI 모듈 임포트
      const { default: PreprocessingAI } = await import('./preprocessingAI.js');
      this.preprocessingAI = new PreprocessingAI({
        model: options.model || 'gpt-3.5-turbo',
        temperature: options.temperature || 0.3,
        maxTokens: options.maxTokens || 2000
      });
      console.log('✅ PreprocessingAI 초기화 완료');
    } catch (error) {
      console.error('❌ PreprocessingAI 초기화 실패:', error.message);
      if (this.fallbackToRules) {
        console.log('🔄 룰 기반 처리로 폴백');
        this.useAIPreprocessing = false;
      } else {
        throw error;
      }
    }
  }

  async processDocument(ocrText, options = {}) {
    const startTime = Date.now();
    const processId = this.generateProcessId();
    
    console.log(`📄 문서 처리 시작 (ID: ${processId})`);
    
    try {
      // 캐시 확인
      const cacheKey = this.generateCacheKey(ocrText);
      if (this.enableCaching) {
        const cachedResult = this.getCachedResult(cacheKey);
        if (cachedResult) {
          console.log('💾 캐시에서 결과 반환');
          this.cacheHits++;
          return cachedResult;
        }
        this.cacheMisses++;
      }

      let preprocessedData = null;
      let processedText = ocrText;

      // AI 전처리 단계 - 비상모드가 아니고 AI가 활성화된 경우에만 실행
      if (this.useAIPreprocessing && this.preprocessingAI && !this.emergencyMode) {
        try {
          console.log('🤖 AI 전처리 시작');
          preprocessedData = await this.preprocessingAI.preprocessDocument(ocrText, options);
          processedText = preprocessedData.cleanedText || ocrText;
          this.metrics.aiProcessed++;
          console.log('✅ AI 전처리 완료');
        } catch (error) {
          console.error('❌ AI 전처리 실패:', error.message);
          if (this.fallbackToRules) {
            console.log('🔄 룰 기반 처리로 폴백');
            preprocessedData = this.fallbackPreprocessing(ocrText);
            processedText = preprocessedData.cleanedText || ocrText;
          } else {
            throw error;
          }
        }
      } else {
        // AI 비활성화 또는 비상모드 시 룰 기반 전처리
        if (this.emergencyMode) {
          console.log('🚨 비상모드 - 룰 기반 전처리 시작');
        } else {
          console.log('⚙️ 룰 기반 전처리 시작');
        }
        preprocessedData = this.fallbackPreprocessing(ocrText);
        processedText = preprocessedData.cleanedText || ocrText;
      }

      // 룰 기반 처리 단계
      console.log('📋 룰 기반 처리 시작');
      const ruleResults = await this.processWithRules(processedText, preprocessedData, options);
      this.metrics.ruleProcessed++;

      // 결과 검증 및 병합
      const aiValidation = this.validateAIResults(preprocessedData);
      const ruleValidation = this.validateRuleResults(ruleResults);
      const consistencyCheck = this.checkConsistency(preprocessedData, ruleResults);

      // 최종 결과 생성
      const finalResult = this.mergeResults(preprocessedData, ruleResults, {
        aiValidation,
        ruleValidation,
        consistencyCheck
      });

      // 성능 메트릭 업데이트
      const totalTime = Date.now() - startTime;
      this.updateMetrics(totalTime, finalResult);

      // 캐싱
      if (this.enableCaching) {
        this.cacheResult(cacheKey, finalResult);
      }

      console.log(`✅ 문서 처리 완료 (ID: ${processId}, 시간: ${totalTime}ms)`);
      return finalResult;

    } catch (error) {
      console.error(`❌ 문서 처리 실패 (ID: ${processId}):`, error.message);
      throw error;
    }
  }

  async processWithRules(processedText, preprocessedData, options) {
    const results = {
      extractedData: {},
      confidence: 0,
      issues: [],
      metadata: {
        processingMethod: 'rules',
        timestamp: new Date().toISOString()
      }
    };

    try {
      // 패턴 매칭으로 데이터 추출
      for (const [key, pattern] of Object.entries(this.ruleEngine.patterns)) {
        const matches = [...processedText.matchAll(pattern)];
        if (matches.length > 0) {
          results.extractedData[key] = matches.map(match => match[1].trim());
          if (results.extractedData[key].length === 1) {
            results.extractedData[key] = results.extractedData[key][0];
          }
        }
      }

      // 신뢰도 계산
      const extractedFields = Object.keys(results.extractedData).length;
      const totalFields = Object.keys(this.ruleEngine.patterns).length;
      results.confidence = (extractedFields / totalFields) * 100;

      console.log(`📊 룰 기반 추출 완료: ${extractedFields}/${totalFields} 필드`);
      return results;

    } catch (error) {
      console.error('❌ 룰 기반 처리 실패:', error.message);
      results.issues.push(`룰 처리 오류: ${error.message}`);
      return results;
    }
  }

  fallbackPreprocessing(ocrText) {
    console.log('🔄 룰 기반 폴백 전처리 시작');
    
    // 기본적인 텍스트 정리
    let cleanedText = ocrText
      .replace(/\s+/g, ' ')  // 연속 공백 제거
      .replace(/\n\s*\n/g, '\n')  // 빈 줄 정리
      .trim();

    // 기본 데이터 추출
    const extractedData = {};
    for (const [key, pattern] of Object.entries(this.ruleEngine.patterns)) {
      const matches = [...cleanedText.matchAll(pattern)];
      if (matches.length > 0) {
        extractedData[key] = matches.map(match => match[1].trim());
        if (extractedData[key].length === 1) {
          extractedData[key] = extractedData[key][0];
        }
      }
    }

    return {
      cleanedText,
      extractedData,
      confidence: Object.keys(extractedData).length * 10,
      processingMethod: 'fallback-rules',
      timestamp: new Date().toISOString()
    };
  }

  validateAIResults(preprocessedData) {
    if (!preprocessedData) {
      return { isValid: false, score: 0, issues: ['AI 전처리 데이터 없음'] };
    }

    const validation = {
      isValid: true,
      score: 0,
      issues: []
    };

    // 필수 필드 검증
    const requiredFields = ['cleanedText', 'extractedData'];
    for (const field of requiredFields) {
      if (!preprocessedData[field]) {
        validation.issues.push(`필수 필드 누락: ${field}`);
        validation.isValid = false;
      }
    }

    // 데이터 품질 검증
    if (preprocessedData.extractedData) {
      const extractedCount = Object.keys(preprocessedData.extractedData).length;
      validation.score = Math.min(extractedCount * 10, 100);
    }

    return validation;
  }

  validateRuleResults(ruleResults) {
    if (!ruleResults) {
      return { isValid: false, score: 0, issues: ['룰 처리 결과 없음'] };
    }

    const validation = {
      isValid: true,
      score: ruleResults.confidence || 0,
      issues: ruleResults.issues || []
    };

    // 최소 신뢰도 검증
    if (validation.score < 30) {
      validation.isValid = false;
      validation.issues.push('신뢰도가 너무 낮음 (30% 미만)');
    }

    return validation;
  }

  checkConsistency(preprocessedData, ruleResults) {
    const consistency = {
      score: 100,
      issues: []
    };

    // AI와 룰 결과 비교 (AI가 활성화된 경우만)
    if (this.useAIPreprocessing && preprocessedData && preprocessedData.extractedData && ruleResults.extractedData) {
      const aiData = preprocessedData.extractedData;
      const ruleData = ruleResults.extractedData;

      for (const key of Object.keys(aiData)) {
        if (ruleData[key] && aiData[key] !== ruleData[key]) {
          consistency.issues.push(`${key} 필드 불일치: AI="${aiData[key]}" vs Rule="${ruleData[key]}"`);
          consistency.score -= 10;
        }
      }
    }

    consistency.score = Math.max(consistency.score, 0);
    return consistency;
  }

  calculateAccuracy(aiValidation, ruleValidation, consistencyCheck) {
    let totalScore = 0;
    let weights = 0;

    if (this.useAIPreprocessing && aiValidation) {
      totalScore += aiValidation.score * 0.4;
      weights += 0.4;
    }

    if (ruleValidation) {
      totalScore += ruleValidation.score * 0.4;
      weights += 0.4;
    }

    if (consistencyCheck) {
      totalScore += consistencyCheck.score * 0.2;
      weights += 0.2;
    }

    return weights > 0 ? totalScore / weights : 0;
  }

  calculateConfidence(preprocessedData, ruleResults) {
    let confidence = 0;
    let factors = 0;

    if (this.useAIPreprocessing && preprocessedData && preprocessedData.confidence) {
      confidence += preprocessedData.confidence * 0.6;
      factors += 0.6;
    }

    if (ruleResults && ruleResults.confidence) {
      confidence += ruleResults.confidence * 0.4;
      factors += 0.4;
    }

    return factors > 0 ? confidence / factors : 0;
  }

  mergeResults(preprocessedData, ruleResults, validation) {
    const merged = {
      processId: this.generateProcessId(),
      timestamp: new Date().toISOString(),
      processingMethod: this.useAIPreprocessing ? 'hybrid' : 'rules-only',
      
      // 원본 데이터
      originalData: {
        ai: preprocessedData,
        rules: ruleResults
      },
      
      // 병합된 추출 데이터
      extractedData: {},
      
      // 메타데이터
      metadata: {
        accuracy: this.calculateAccuracy(validation.aiValidation, validation.ruleValidation, validation.consistencyCheck),
        confidence: this.calculateConfidence(preprocessedData, ruleResults),
        issues: this.identifyIssues(validation.aiValidation, validation.ruleValidation, validation.consistencyCheck),
        recommendations: []
      }
    };

    // 데이터 병합 로직
    if (this.useAIPreprocessing && preprocessedData && preprocessedData.extractedData) {
      Object.assign(merged.extractedData, preprocessedData.extractedData);
    }
    
    if (ruleResults && ruleResults.extractedData) {
      // 룰 결과로 AI 결과 보완 또는 덮어쓰기
      for (const [key, value] of Object.entries(ruleResults.extractedData)) {
        if (!merged.extractedData[key] || (ruleResults.confidence > 70)) {
          merged.extractedData[key] = value;
        }
      }
    }

    // 권고사항 생성
    merged.metadata.recommendations = this.generateRecommendations(merged.metadata.issues);

    return merged;
  }

  generateCacheKey(text) {
    return Buffer.from(text).toString('base64').substring(0, 32);
  }

  getCachedResult(cacheKey) {
    return this.cache.get(cacheKey);
  }

  cacheResult(cacheKey, result) {
    // 캐시 크기 제한 (최대 100개)
    if (this.cache.size >= 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);
  }

  getCacheHitRate() {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? (this.cacheHits / total) * 100 : 0;
  }

  generateProcessId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateMetrics(totalTime, finalResult) {
    this.metrics.totalProcessed++;
    this.metrics.totalProcessingTime += totalTime;
    this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalProcessed;
    this.metrics.accuracy = finalResult.metadata.accuracy;
    this.metrics.confidence = finalResult.metadata.confidence;
  }

  identifyIssues(aiValidation, ruleValidation, consistencyCheck) {
    const issues = [];
    
    if (aiValidation && !aiValidation.isValid) {
      issues.push(...aiValidation.issues);
    }
    
    if (ruleValidation && !ruleValidation.isValid) {
      issues.push(...ruleValidation.issues);
    }
    
    if (consistencyCheck && consistencyCheck.issues.length > 0) {
      issues.push(...consistencyCheck.issues);
    }
    
    return issues;
  }

  generateRecommendations(issues) {
    const recommendations = [];
    
    if (issues.some(issue => issue.includes('신뢰도'))) {
      recommendations.push('문서 품질 개선 필요');
    }
    
    if (issues.some(issue => issue.includes('불일치'))) {
      recommendations.push('수동 검토 권장');
    }
    
    if (issues.some(issue => issue.includes('누락'))) {
      recommendations.push('추가 정보 수집 필요');
    }
    
    return recommendations;
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.getCacheHitRate(),
      cacheSize: this.cache.size
    };
  }
}

export default HybridProcessor;