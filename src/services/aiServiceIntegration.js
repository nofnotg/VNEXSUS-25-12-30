/**
 * AI Service Integration Layer
 *
 * 기존 AIService와 새로운 GPT4oMiniEnhancedService를 통합하는 어댑터
 * A/B 테스트, 폴백 처리, 성능 모니터링 기능 포함
 *
 * Phase 2-2: Gemini Flash 통합 (복잡도 기반 라우팅)
 */

import { GPT4oMiniEnhancedService } from './gpt4oMiniEnhancedService.js';
import { GeminiFlashService } from './geminiFlashService.js';
import fs from 'fs/promises';
import path from 'path';

export class AIServiceIntegration {
  constructor(existingAIService, options = {}) {
    // 기존 AIService 인스턴스
    this.existingAIService = existingAIService;

    // 새로운 Enhanced Service
    this.enhancedService = new GPT4oMiniEnhancedService();

    // Gemini Flash Service (Phase 2-2)
    this.geminiFlashService = null;
    try {
      this.geminiFlashService = new GeminiFlashService(options.gemini || {});
      console.log('✅ Gemini Flash Service 초기화 완료');
    } catch (error) {
      console.warn('⚠️ Gemini Flash Service 초기화 실패:', error.message);
      console.warn('   복잡도 기반 라우팅이 비활성화됩니다.');
    }

    // 통합 설정
    this.config = {
      enableEnhanced: options.enableEnhanced ?? true,
      enableABTest: options.enableABTest ?? false,
      enhancedRatio: options.enhancedRatio ?? 0.3, // 30% 트래픽을 Enhanced로
      enableFallback: options.enableFallback ?? true,
      enableMetrics: options.enableMetrics ?? true,
      logDirectory: options.logDirectory || './logs/ai-integration',

      // Phase 2-2: 복잡도 기반 라우팅 설정
      enableComplexityRouting: options.enableComplexityRouting ?? true,
      complexityThresholds: {
        simple: 30,   // 0-30: Gemini Flash
        medium: 60,   // 30-60: GPT-4o Mini
        complex: 100  // 60-100: GPT-4o Mini Enhanced
      }
    };

    // 폴백 설정
    if (this.config.enableFallback) {
      this.enhancedService.setFallbackService(this.existingAIService);
    }

    // 성능 추적
    this.performanceTracker = {
      totalRequests: 0,
      enhancedRequests: 0,
      geminiRequests: 0,
      fallbackRequests: 0,
      successRate: { enhanced: 0, existing: 0, gemini: 0 },
      averageTime: { enhanced: 0, existing: 0, gemini: 0 },
      tokenSavings: 0,
      costSavings: 0 // Gemini로 인한 비용 절감
    };

    console.log('🔧 AI Service Integration 초기화 완료');
    console.log(`  - Enhanced 활성화: ${this.config.enableEnhanced}`);
    console.log(`  - Gemini Flash: ${this.geminiFlashService ? '활성화' : '비활성화'}`);
    console.log(`  - 복잡도 라우팅: ${this.config.enableComplexityRouting ? '활성화' : '비활성화'}`);
    console.log(`  - A/B 테스트: ${this.config.enableABTest}`);
    console.log(`  - Enhanced 비율: ${(this.config.enhancedRatio * 100).toFixed(1)}%`);
  }

  /**
   * 통합된 의료 보고서 생성 인터페이스
   * 기존 AIService와 완전 호환
   * Phase 2-2: 복잡도 기반 라우팅 포함
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 생성 옵션
   * @returns {Promise<Object>} 생성된 보고서
   */
  async generateMedicalReport(inputData, options = {}) {
    this.performanceTracker.totalRequests++;
    const startTime = Date.now();

    try {
      // Phase 2-2: 복잡도 기반 서비스 선택
      const serviceSelection = this.selectServiceByComplexity(inputData, options);
      console.log(`📊 서비스 선택: ${serviceSelection.service} (복잡도: ${serviceSelection.complexity})`);

      let result;
      switch (serviceSelection.service) {
        case 'gemini':
          console.log('⚡ Gemini Flash Service 사용 (간단한 케이스)');
          result = await this.executeGeminiService(inputData, options, startTime);
          break;

        case 'enhanced':
          console.log('🚀 GPT-4o Mini Enhanced Service 사용 (복잡한 케이스)');
          result = await this.executeEnhancedService(inputData, options, startTime);
          break;

        case 'existing':
        default:
          console.log('🔄 기존 AI Service 사용');
          result = await this.executeExistingService(inputData, options, startTime);
          break;
      }

      // 성능 메트릭 수집
      await this.collectIntegrationMetrics(result, serviceSelection.service, startTime);

      return result;

    } catch (error) {
      console.error('❌ AI Service Integration 오류:', error);

      // 최종 폴백 처리
      if (this.config.enableFallback) {
        return await this.executeFinalFallback(inputData, options, error, startTime);
      }

      throw error;
    }
  }

  /**
   * Phase 2-2: 복잡도 기반 서비스 선택
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 옵션
   * @returns {Object} { service: 'gemini'|'enhanced'|'existing', complexity: string, score: number }
   */
  selectServiceByComplexity(inputData, options) {
    // 강제 지정된 경우
    if (options.forceService) {
      return {
        service: options.forceService,
        complexity: 'forced',
        score: 0,
        reason: 'User forced service selection'
      };
    }

    // 복잡도 라우팅 비활성화 시
    if (!this.config.enableComplexityRouting || !this.geminiFlashService) {
      return {
        service: this.shouldUseEnhancedService(options) ? 'enhanced' : 'existing',
        complexity: 'default',
        score: 0,
        reason: 'Complexity routing disabled or Gemini unavailable'
      };
    }

    // 복잡도 분석
    const analysis = this.geminiFlashService.analyzeComplexity(inputData);

    // 복잡도에 따른 서비스 선택
    let selectedService;
    if (analysis.score < this.config.complexityThresholds.simple) {
      selectedService = 'gemini';  // 간단 → Gemini Flash (저렴)
    } else if (analysis.score < this.config.complexityThresholds.medium) {
      selectedService = 'enhanced';  // 보통 → GPT-4o Mini
    } else {
      selectedService = 'enhanced';  // 복잡 → GPT-4o Mini Enhanced
    }

    return {
      service: selectedService,
      complexity: analysis.complexity,
      score: analysis.score,
      reasons: analysis.reasons,
      metrics: analysis.metrics
    };
  }

  /**
   * Phase 2-2: Gemini Service 실행
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 옵션
   * @param {number} startTime - 시작 시간
   * @returns {Promise<Object>} 결과
   */
  async executeGeminiService(inputData, options, startTime) {
    this.performanceTracker.geminiRequests++;

    try {
      const result = await this.geminiFlashService.generateMedicalReport(inputData, options);

      // Gemini 성공 메트릭 업데이트
      this.updateSuccessMetrics('gemini', startTime);

      // 비용 절감 계산 (Gemini는 GPT-4o Mini 대비 약 70% 저렴)
      const estimatedCostSaving = 0.7; // 70% 절감
      this.performanceTracker.costSavings =
        (this.performanceTracker.costSavings * (this.performanceTracker.geminiRequests - 1) +
          estimatedCostSaving) / this.performanceTracker.geminiRequests;

      // 결과에 통합 메타데이터 추가
      return this.enrichResultWithIntegrationMetadata(result, 'gemini');

    } catch (error) {
      console.error('Gemini Service 실행 오류:', error);

      // Gemini 실패 시 Enhanced로 폴백
      if (this.config.enableFallback) {
        console.warn('⚠️ Gemini 실패, Enhanced 서비스로 폴백');
        return await this.executeEnhancedService(inputData, options, startTime);
      }

      throw error;
    }
  }

  /**
   * Enhanced Service 사용 여부 결정
   * @param {Object} options - 옵션
   * @returns {boolean} Enhanced Service 사용 여부
   */
  shouldUseEnhancedService(options) {
    // Enhanced 비활성화된 경우
    if (!this.config.enableEnhanced) {
      return false;
    }
    
    // 강제 지정된 경우
    if (options.forceEnhanced !== undefined) {
      return options.forceEnhanced;
    }
    
    // A/B 테스트 모드
    if (this.config.enableABTest) {
      return Math.random() < this.config.enhancedRatio;
    }
    
    // 기본적으로 Enhanced 사용
    return true;
  }

  /**
   * Enhanced Service 실행
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 옵션
   * @param {number} startTime - 시작 시간
   * @returns {Promise<Object>} 결과
   */
  async executeEnhancedService(inputData, options, startTime) {
    this.performanceTracker.enhancedRequests++;
    
    try {
      const result = await this.enhancedService.generateMedicalReport(inputData, options);
      
      // Enhanced 성공 메트릭 업데이트
      this.updateSuccessMetrics('enhanced', startTime);
      
      // 결과에 통합 메타데이터 추가
      return this.enrichResultWithIntegrationMetadata(result, 'enhanced');
      
    } catch (error) {
      console.error('Enhanced Service 실행 오류:', error);
      throw error;
    }
  }

  /**
   * 기존 Service 실행
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 옵션
   * @param {number} startTime - 시작 시간
   * @returns {Promise<Object>} 결과
   */
  async executeExistingService(inputData, options, startTime) {
    try {
      // 기존 AIService 호출 (다양한 인터페이스 지원)
      let result;
      
      if (typeof this.existingAIService.generateMedicalReport === 'function') {
        result = await this.existingAIService.generateMedicalReport(inputData, options);
      } else if (typeof this.existingAIService.chat === 'function') {
        // chat 인터페이스 사용
        const prompt = this.buildPromptForExistingService(inputData, options);
        const chatResult = await this.existingAIService.chat(prompt, options);
        result = { report: chatResult, success: true };
      } else {
        throw new Error('기존 AIService에서 지원하는 인터페이스를 찾을 수 없습니다.');
      }
      
      // 기존 서비스 성공 메트릭 업데이트
      this.updateSuccessMetrics('existing', startTime);
      
      // 결과 정규화 및 메타데이터 추가
      return this.enrichResultWithIntegrationMetadata(
        this.normalizeExistingServiceResult(result), 
        'existing'
      );
      
    } catch (error) {
      console.error('기존 Service 실행 오류:', error);
      throw error;
    }
  }

  /**
   * 기존 서비스용 프롬프트 구성
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 옵션
   * @returns {string} 구성된 프롬프트
   */
  buildPromptForExistingService(inputData, options) {
    const ocrText = inputData.ocrText || inputData.text || inputData.content || inputData;
    const patientInfo = inputData.patientInfo || {};
    
    return `다음 의료 문서를 분석하여 전문적인 의료 보고서를 작성해 주세요.

## 환자 정보
${JSON.stringify(patientInfo, null, 2)}

## 의료 문서 내용
${ocrText}

## 요구사항
- 의료진이 이해할 수 있는 전문적인 수준으로 작성
- 모든 의료 이벤트를 시간순으로 정리
- 주요 진단 및 치료 내용 포함
- 마크다운 형식으로 작성

${options.reportStyle ? `보고서 스타일: ${options.reportStyle}` : ''}
${options.focusAreas ? `중점 분석 영역: ${options.focusAreas.join(', ')}` : ''}`;
  }

  /**
   * 기존 서비스 결과 정규화
   * @param {*} result - 기존 서비스 결과
   * @returns {Object} 정규화된 결과
   */
  normalizeExistingServiceResult(result) {
    // 다양한 결과 형식 지원
    if (typeof result === 'string') {
      return {
        success: true,
        report: result,
        metadata: { method: 'existing_service' }
      };
    }
    
    if (result && typeof result === 'object') {
      return {
        success: result.success ?? true,
        report: result.report || result.content || result.response || result,
        metadata: {
          method: 'existing_service',
          ...result.metadata
        }
      };
    }
    
    return {
      success: true,
      report: String(result),
      metadata: { method: 'existing_service' }
    };
  }

  /**
   * 결과에 통합 메타데이터 추가
   * @param {Object} result - 원본 결과
   * @param {string} serviceType - 서비스 타입
   * @returns {Object} 메타데이터가 추가된 결과
   */
  enrichResultWithIntegrationMetadata(result, serviceType) {
    const integrationMetadata = {
      integrationVersion: '1.0.0',
      serviceUsed: serviceType,
      timestamp: new Date().toISOString(),
      performanceMetrics: this.getPerformanceSnapshot(),
      abTestInfo: this.config.enableABTest ? {
        enabled: true,
        enhancedRatio: this.config.enhancedRatio,
        requestNumber: this.performanceTracker.totalRequests
      } : null
    };
    
    return {
      ...result,
      metadata: {
        ...result.metadata,
        integration: integrationMetadata
      }
    };
  }

  /**
   * 성공 메트릭 업데이트
   * @param {string} serviceType - 서비스 타입
   * @param {number} startTime - 시작 시간
   */
  updateSuccessMetrics(serviceType, startTime) {
    const processingTime = Date.now() - startTime;
    
    // 성공률 업데이트
    const currentSuccessRate = this.performanceTracker.successRate[serviceType];
    const totalServiceRequests = serviceType === 'enhanced' ? 
      this.performanceTracker.enhancedRequests : 
      this.performanceTracker.totalRequests - this.performanceTracker.enhancedRequests;
    
    this.performanceTracker.successRate[serviceType] = 
      (currentSuccessRate * (totalServiceRequests - 1) + 100) / totalServiceRequests;
    
    // 평균 처리 시간 업데이트
    const currentAvgTime = this.performanceTracker.averageTime[serviceType];
    this.performanceTracker.averageTime[serviceType] = 
      (currentAvgTime * (totalServiceRequests - 1) + processingTime) / totalServiceRequests;
  }

  /**
   * 최종 폴백 실행
   * @param {Object} inputData - 입력 데이터
   * @param {Object} options - 옵션
   * @param {Error} error - 원본 오류
   * @param {number} startTime - 시작 시간
   * @returns {Promise<Object>} 폴백 결과
   */
  async executeFinalFallback(inputData, options, error, startTime) {
    this.performanceTracker.fallbackRequests++;
    
    try {
      console.log('🆘 최종 폴백 실행...');
      
      // 가장 기본적인 방식으로 처리
      const fallbackResult = await this.executeExistingService(inputData, options, startTime);
      
      return {
        ...fallbackResult,
        metadata: {
          ...fallbackResult.metadata,
          finalFallback: true,
          originalError: error.message,
          fallbackReason: 'All primary services failed'
        }
      };
      
    } catch (fallbackError) {
      console.error('❌ 최종 폴백도 실패:', fallbackError);
      throw new Error(`모든 AI 서비스 실패: ${error.message} | 폴백: ${fallbackError.message}`);
    }
  }

  /**
   * 통합 메트릭 수집 (Phase 2-2: Gemini 지원)
   * @param {Object} result - 처리 결과
   * @param {string} serviceUsed - 'gemini'|'enhanced'|'existing'
   * @param {number} startTime - 시작 시간
   */
  async collectIntegrationMetrics(result, serviceUsed, startTime) {
    if (!this.config.enableMetrics) return;

    const metrics = {
      timestamp: new Date().toISOString(),
      serviceUsed: serviceUsed,
      processingTime: Date.now() - startTime,
      success: result.success,
      tokenSavings: result.metadata?.tokenUsage?.savingsPercent || 0,
      contextRetention: result.metadata?.contextRetention || 0,
      requestId: this.performanceTracker.totalRequests,
      // Phase 2-2: 복잡도 정보 추가
      complexityAnalysis: result.metadata?.complexityAnalysis || null
    };

    // 토큰 절약 누적
    if (serviceUsed === 'enhanced' && metrics.tokenSavings > 0) {
      this.performanceTracker.tokenSavings =
        (this.performanceTracker.tokenSavings * (this.performanceTracker.enhancedRequests - 1) +
          metrics.tokenSavings) / this.performanceTracker.enhancedRequests;
    }

    // 메트릭 로깅
    await this.logIntegrationMetrics(metrics);
  }

  /**
   * 통합 메트릭 로깅
   * @param {Object} metrics - 메트릭 데이터
   */
  async logIntegrationMetrics(metrics) {
    try {
      const logDir = this.config.logDirectory;
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = path.join(logDir, `integration-metrics-${new Date().toISOString().split('T')[0]}.jsonl`);
      const logEntry = JSON.stringify(metrics) + '\n';
      
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error('메트릭 로깅 오류:', error);
    }
  }

  /**
   * 현재 성능 스냅샷 반환
   * @returns {Object} 성능 스냅샷
   */
  getPerformanceSnapshot() {
    return {
      totalRequests: this.performanceTracker.totalRequests,
      enhancedRequests: this.performanceTracker.enhancedRequests,
      enhancedRatio: this.performanceTracker.totalRequests > 0 ? 
        this.performanceTracker.enhancedRequests / this.performanceTracker.totalRequests : 0,
      successRate: { ...this.performanceTracker.successRate },
      averageTime: { ...this.performanceTracker.averageTime },
      averageTokenSavings: this.performanceTracker.tokenSavings,
      fallbackRequests: this.performanceTracker.fallbackRequests
    };
  }

  /**
   * 상세 성능 리포트 생성
   * @returns {Object} 상세 성능 리포트
   */
  generatePerformanceReport() {
    const snapshot = this.getPerformanceSnapshot();
    
    return {
      summary: {
        totalRequests: snapshot.totalRequests,
        enhancedAdoption: `${(snapshot.enhancedRatio * 100).toFixed(1)}%`,
        averageTokenSavings: `${snapshot.averageTokenSavings.toFixed(1)}%`,
        overallSuccessRate: `${((snapshot.successRate.enhanced + snapshot.successRate.existing) / 2).toFixed(1)}%`
      },
      detailed: {
        enhanced: {
          requests: snapshot.enhancedRequests,
          successRate: `${snapshot.successRate.enhanced.toFixed(1)}%`,
          averageTime: `${snapshot.averageTime.enhanced.toFixed(0)}ms`,
          tokenSavings: `${snapshot.averageTokenSavings.toFixed(1)}%`
        },
        existing: {
          requests: snapshot.totalRequests - snapshot.enhancedRequests,
          successRate: `${snapshot.successRate.existing.toFixed(1)}%`,
          averageTime: `${snapshot.averageTime.existing.toFixed(0)}ms`
        },
        fallback: {
          requests: snapshot.fallbackRequests,
          rate: `${(snapshot.fallbackRequests / snapshot.totalRequests * 100).toFixed(1)}%`
        }
      },
      recommendations: this.generateRecommendations(snapshot)
    };
  }

  /**
   * 성능 기반 권장사항 생성
   * @param {Object} snapshot - 성능 스냅샷
   * @returns {Array} 권장사항 목록
   */
  generateRecommendations(snapshot) {
    const recommendations = [];
    
    if (snapshot.averageTokenSavings > 20) {
      recommendations.push('토큰 절약 효과가 우수합니다. Enhanced 비율을 늘리는 것을 고려하세요.');
    }
    
    if (snapshot.successRate.enhanced > snapshot.successRate.existing + 5) {
      recommendations.push('Enhanced 서비스의 성공률이 높습니다. 기본 서비스로 전환을 고려하세요.');
    }
    
    if (snapshot.fallbackRequests / snapshot.totalRequests > 0.1) {
      recommendations.push('폴백 비율이 높습니다. 서비스 안정성을 점검하세요.');
    }
    
    if (snapshot.averageTime.enhanced > snapshot.averageTime.existing * 1.5) {
      recommendations.push('Enhanced 서비스의 처리 시간이 깁니다. 성능 최적화를 고려하세요.');
    }
    
    return recommendations;
  }

  /**
   * 설정 업데이트
   * @param {Object} newConfig - 새로운 설정
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 AI Service Integration 설정 업데이트:', newConfig);
  }

  /**
   * A/B 테스트 결과 분석
   * @returns {Object} A/B 테스트 분석 결과
   */
  analyzeABTestResults() {
    if (!this.config.enableABTest) {
      return { error: 'A/B 테스트가 비활성화되어 있습니다.' };
    }
    
    const snapshot = this.getPerformanceSnapshot();
    
    return {
      testConfiguration: {
        enhancedRatio: this.config.enhancedRatio,
        totalRequests: snapshot.totalRequests
      },
      results: {
        enhanced: {
          requests: snapshot.enhancedRequests,
          successRate: snapshot.successRate.enhanced,
          averageTime: snapshot.averageTime.enhanced,
          tokenSavings: snapshot.averageTokenSavings
        },
        existing: {
          requests: snapshot.totalRequests - snapshot.enhancedRequests,
          successRate: snapshot.successRate.existing,
          averageTime: snapshot.averageTime.existing
        }
      },
      recommendation: this.getABTestRecommendation(snapshot)
    };
  }

  /**
   * A/B 테스트 권장사항 생성
   * @param {Object} snapshot - 성능 스냅샷
   * @returns {string} 권장사항
   */
  getABTestRecommendation(snapshot) {
    const enhancedScore = 
      (snapshot.successRate.enhanced / 100) * 0.4 +
      (Math.max(0, 100 - snapshot.averageTime.enhanced) / 100) * 0.3 +
      (snapshot.averageTokenSavings / 100) * 0.3;
    
    const existingScore = 
      (snapshot.successRate.existing / 100) * 0.4 +
      (Math.max(0, 100 - snapshot.averageTime.existing) / 100) * 0.6;
    
    if (enhancedScore > existingScore + 0.1) {
      return 'Enhanced 서비스가 우수한 성능을 보입니다. 전면 도입을 권장합니다.';
    } else if (existingScore > enhancedScore + 0.1) {
      return '기존 서비스가 더 안정적입니다. Enhanced 서비스 개선이 필요합니다.';
    } else {
      return '두 서비스의 성능이 비슷합니다. 추가 테스트를 진행하세요.';
    }
  }
}

export default AIServiceIntegration;