/**
 * 향상된 전처리기 (Enhanced Preprocessor)
 * Phase 1 템플릿 캐시 + Phase 2 AI 프롬프트 보강 시스템 통합
 * 
 * 주요 기능:
 * - 기존 전처리 AI와 프롬프트 보강 시스템 통합
 * - 컨텍스트 기반 동적 프롬프트 생성
 * - 병원별 템플릿 캐시 활용
 * - 성능 최적화 및 오류 복구
 * 
 * @version 2.0.0
 * @author VNEXSUS AI Team
 */

import promptEnhancer from './promptEnhancer.js';
import contextAnalyzer from './contextAnalyzer.js';
import hospitalTemplateCache from './hospitalTemplateCache.js';

class EnhancedPreprocessor {
  constructor(options = {}) {
    this.version = '2.0.0';
    this.initialized = false;
    
    // 통합 설정
    this.config = {
      enableTemplateCache: options.enableTemplateCache !== false,
      enablePromptEnhancement: options.enablePromptEnhancement !== false,
      enableContextAnalysis: options.enableContextAnalysis !== false,
      fallbackMode: options.fallbackMode || 'graceful',
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 45000
    };
    
    // 성능 메트릭
    this.performanceMetrics = {
      totalProcessed: 0,
      templateCacheHits: 0,
      promptEnhancements: 0,
      contextAnalyses: 0,
      averageProcessingTime: 0,
      successRate: 0,
      errorCount: 0,
      improvementScore: 0
    };
    
    // 처리 단계별 시간 추적
    this.timingMetrics = {
      templateCache: 0,
      contextAnalysis: 0,
      promptEnhancement: 0,
      aiProcessing: 0,
      postProcessing: 0
    };
    
    console.log('🚀 향상된 전처리기 (Enhanced Preprocessor) 초기화 중...');
  }
  
  /**
   * 시스템 초기화
   */
  async initialize() {
    try {
      console.log('🔧 향상된 전처리기 초기화 시작...');
      
      const initResults = {};
      
      // Phase 1: 템플릿 캐시 초기화
      if (this.config.enableTemplateCache) {
        console.log('📋 템플릿 캐시 시스템 초기화...');
        initResults.templateCache = await hospitalTemplateCache.initialize();
      }
      
      // Phase 2: 컨텍스트 분석기 초기화
      if (this.config.enableContextAnalysis) {
        console.log('🔍 컨텍스트 분석기 초기화...');
        initResults.contextAnalyzer = await contextAnalyzer.initialize();
      }
      
      // Phase 2: 프롬프트 보강기 초기화
      if (this.config.enablePromptEnhancement) {
        console.log('🎯 프롬프트 보강기 초기화...');
        initResults.promptEnhancer = await promptEnhancer.initialize();
      }
      
      this.initialized = true;
      
      console.log('✅ 향상된 전처리기 초기화 완료');
      console.log('📊 초기화 결과:', {
        templateCache: initResults.templateCache?.success || false,
        contextAnalyzer: initResults.contextAnalyzer?.success || false,
        promptEnhancer: initResults.promptEnhancer?.success || false
      });
      
      return {
        success: true,
        version: this.version,
        components: initResults,
        config: this.config
      };
      
    } catch (error) {
      console.error('❌ 향상된 전처리기 초기화 실패:', error);
      return {
        success: false,
        error: error.message,
        fallbackMode: this.config.fallbackMode
      };
    }
  }
  
  /**
   * 향상된 문서 전처리 (메인 처리 함수)
   * @param {string} text - 원본 의료 문서 텍스트
   * @param {Object} options - 처리 옵션
   * @returns {Object} 향상된 전처리 결과
   */
  async processDocument(text, options = {}) {
    const startTime = Date.now();
    const processingId = this._generateProcessingId();
    
    console.log(`🔄 향상된 문서 전처리 시작 [${processingId}]`, {
      textLength: text.length,
      hospital: options.hospital || 'unknown'
    });
    
    try {
      // 처리 결과 객체 초기화
      const result = {
        processingId,
        originalText: text,
        processedText: text,
        phases: {},
        metadata: {
          originalLength: text.length,
          processingTime: 0,
          phases: []
        },
        success: true
      };
      
      // Phase 1: 템플릿 캐시 처리
      if (this.config.enableTemplateCache) {
        result.phases.templateCache = await this._processTemplateCache(text, options, processingId);
        if (result.phases.templateCache.success) {
          result.processedText = result.phases.templateCache.processedText;
          this.performanceMetrics.templateCacheHits++;
        }
      }
      
      // Phase 2: 컨텍스트 분석
      let contextAnalysis = null;
      if (this.config.enableContextAnalysis) {
        result.phases.contextAnalysis = await this._processContextAnalysis(result.processedText, options, processingId);
        if (result.phases.contextAnalysis.success) {
          contextAnalysis = result.phases.contextAnalysis.analysis;
          this.performanceMetrics.contextAnalyses++;
        }
      }
      
      // Phase 2: 프롬프트 보강
      let enhancedPrompt = null;
      if (this.config.enablePromptEnhancement) {
        result.phases.promptEnhancement = await this._processPromptEnhancement(
          result.processedText, 
          contextAnalysis, 
          options, 
          processingId
        );
        if (result.phases.promptEnhancement.success) {
          enhancedPrompt = result.phases.promptEnhancement.enhancedPrompt;
          this.performanceMetrics.promptEnhancements++;
        }
      }
      
      // Phase 3: AI 처리 (기존 전처리 AI 또는 향상된 프롬프트 사용)
      result.phases.aiProcessing = await this._processWithAI(
        result.processedText,
        enhancedPrompt,
        contextAnalysis,
        options,
        processingId
      );
      
      if (result.phases.aiProcessing.success) {
        result.processedText = result.phases.aiProcessing.processedText;
      }
      
      // Phase 4: 후처리 및 품질 검증
      result.phases.postProcessing = await this._postProcess(result, options, processingId);
      
      // 최종 메타데이터 계산
      result.metadata = this._calculateFinalMetadata(result, startTime);
      
      // 성능 메트릭 업데이트
      this._updatePerformanceMetrics(result);
      
      console.log(`✅ 향상된 문서 전처리 완료 [${processingId}]`, {
        processingTime: result.metadata.processingTime,
        reductionRate: result.metadata.reductionRate,
        improvementScore: result.metadata.improvementScore,
        phasesCompleted: result.metadata.phases.length
      });
      
      return result;
      
    } catch (error) {
      console.error(`❌ 향상된 문서 전처리 실패 [${processingId}]:`, error);
      
      // 오류 복구 처리
      const fallbackResult = await this._handleProcessingError(text, error, options, processingId);
      this.performanceMetrics.errorCount++;
      
      return fallbackResult;
    }
  }
  
  /**
   * Phase 1: 템플릿 캐시 처리
   * @private
   */
  async _processTemplateCache(text, options, processingId) {
    const phaseStartTime = Date.now();
    
    try {
      console.log(`📋 템플릿 캐시 처리 시작 [${processingId}]`);
      
      const cacheResult = await hospitalTemplateCache.processDocument(text, {
        hospital: options.hospital,
        enableLearning: true,
        returnMetrics: true
      });
      
      const processingTime = Date.now() - phaseStartTime;
      this.timingMetrics.templateCache += processingTime;
      
      if (cacheResult.success) {
        console.log(`✅ 템플릿 캐시 처리 완료 [${processingId}]: ${cacheResult.noiseReductionRate}% 노이즈 제거`);
        
        return {
          success: true,
          processedText: cacheResult.processedText,
          noiseReductionRate: cacheResult.noiseReductionRate,
          templatesUsed: cacheResult.templatesUsed,
          processingTime,
          cacheHit: cacheResult.cacheHit
        };
      } else {
        console.warn(`⚠️ 템플릿 캐시 처리 실패 [${processingId}], 원본 텍스트 유지`);
        return {
          success: false,
          processedText: text,
          error: cacheResult.error,
          processingTime
        };
      }
      
    } catch (error) {
      console.error(`❌ 템플릿 캐시 처리 오류 [${processingId}]:`, error);
      return {
        success: false,
        processedText: text,
        error: error.message,
        processingTime: Date.now() - phaseStartTime
      };
    }
  }
  
  /**
   * Phase 2: 컨텍스트 분석 처리
   * @private
   */
  async _processContextAnalysis(text, options, processingId) {
    const phaseStartTime = Date.now();
    
    try {
      console.log(`🔍 컨텍스트 분석 시작 [${processingId}]`);
      
      const analysisResult = await contextAnalyzer.analyzeContext(text, {
        hospital: options.hospital,
        taskType: options.taskType || 'general'
      });
      
      const processingTime = Date.now() - phaseStartTime;
      this.timingMetrics.contextAnalysis += processingTime;
      
      if (analysisResult.success) {
        console.log(`✅ 컨텍스트 분석 완료 [${processingId}]: ${analysisResult.contextScore.overall}/100`);
        
        return {
          success: true,
          analysis: analysisResult,
          processingTime,
          contextScore: analysisResult.contextScore.overall
        };
      } else {
        console.warn(`⚠️ 컨텍스트 분석 실패 [${processingId}]`);
        return {
          success: false,
          error: analysisResult.error,
          processingTime
        };
      }
      
    } catch (error) {
      console.error(`❌ 컨텍스트 분석 오류 [${processingId}]:`, error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - phaseStartTime
      };
    }
  }
  
  /**
   * Phase 2: 프롬프트 보강 처리
   * @private
   */
  async _processPromptEnhancement(text, contextAnalysis, options, processingId) {
    const phaseStartTime = Date.now();
    
    try {
      console.log(`🎯 프롬프트 보강 시작 [${processingId}]`);
      
      const enhancementOptions = {
        hospital: options.hospital,
        taskType: options.taskType || 'general',
        contextAnalysis: contextAnalysis
      };
      
      const enhancementResult = await promptEnhancer.enhancePrompt(text, enhancementOptions);
      
      const processingTime = Date.now() - phaseStartTime;
      this.timingMetrics.promptEnhancement += processingTime;
      
      if (enhancementResult.success) {
        console.log(`✅ 프롬프트 보강 완료 [${processingId}]: ${enhancementResult.metadata.improvementScore}% 개선`);
        
        return {
          success: true,
          enhancedPrompt: enhancementResult.enhancedPrompt,
          systemPrompt: enhancementResult.systemPrompt,
          improvementScore: enhancementResult.metadata.improvementScore,
          recommendedModel: enhancementResult.metadata.recommendedModel,
          processingTime
        };
      } else {
        console.warn(`⚠️ 프롬프트 보강 실패 [${processingId}], 폴백 프롬프트 사용`);
        return {
          success: false,
          enhancedPrompt: enhancementResult.fallbackPrompt?.prompt,
          systemPrompt: enhancementResult.fallbackPrompt?.systemPrompt,
          error: enhancementResult.error,
          processingTime
        };
      }
      
    } catch (error) {
      console.error(`❌ 프롬프트 보강 오류 [${processingId}]:`, error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - phaseStartTime
      };
    }
  }
  
  /**
   * Phase 3: AI 처리 (향상된 프롬프트 또는 기본 프롬프트 사용)
   * @private
   */
  async _processWithAI(text, enhancedPrompt, contextAnalysis, options, processingId) {
    const phaseStartTime = Date.now();
    
    try {
      console.log(`🤖 AI 처리 시작 [${processingId}]`);
      
      // 프롬프트 선택 (향상된 프롬프트 우선)
      const prompt = enhancedPrompt || this._getDefaultPrompt(text, options);
      const systemPrompt = enhancedPrompt ? 
        (typeof enhancedPrompt === 'object' ? enhancedPrompt.systemPrompt : undefined) :
        this._getDefaultSystemPrompt();
      
      // AI 모델 선택 (컨텍스트 기반)
      const model = this._selectOptimalModel(contextAnalysis, options);
      
      // AI 처리 실행 (실제 구현에서는 OpenAI API 호출)
      const aiResult = await this._callAIService(prompt, systemPrompt, model, options);
      
      const processingTime = Date.now() - phaseStartTime;
      this.timingMetrics.aiProcessing += processingTime;
      
      if (aiResult.success) {
        console.log(`✅ AI 처리 완료 [${processingId}]: ${model} 모델 사용`);
        
        return {
          success: true,
          processedText: aiResult.processedText,
          model: model,
          tokensUsed: aiResult.tokensUsed,
          processingTime
        };
      } else {
        console.warn(`⚠️ AI 처리 실패 [${processingId}], 기본 처리 적용`);
        return {
          success: false,
          processedText: this._basicTextProcessing(text),
          error: aiResult.error,
          processingTime
        };
      }
      
    } catch (error) {
      console.error(`❌ AI 처리 오류 [${processingId}]:`, error);
      return {
        success: false,
        processedText: this._basicTextProcessing(text),
        error: error.message,
        processingTime: Date.now() - phaseStartTime
      };
    }
  }
  
  /**
   * Phase 4: 후처리 및 품질 검증
   * @private
   */
  async _postProcess(result, options, processingId) {
    const phaseStartTime = Date.now();
    
    try {
      console.log(`🔧 후처리 시작 [${processingId}]`);
      
      // 품질 검증
      const qualityScore = this._assessQuality(result.originalText, result.processedText);
      
      // 추가 정제 (필요시)
      if (qualityScore < 0.7) {
        result.processedText = this._additionalCleaning(result.processedText);
      }
      
      // 메타데이터 보강
      const additionalMetadata = {
        qualityScore,
        processingSteps: Object.keys(result.phases).length,
        successfulPhases: Object.values(result.phases).filter(p => p.success).length
      };
      
      const processingTime = Date.now() - phaseStartTime;
      this.timingMetrics.postProcessing += processingTime;
      
      console.log(`✅ 후처리 완료 [${processingId}]: 품질 점수 ${qualityScore.toFixed(2)}`);
      
      return {
        success: true,
        qualityScore,
        additionalMetadata,
        processingTime
      };
      
    } catch (error) {
      console.error(`❌ 후처리 오류 [${processingId}]:`, error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - phaseStartTime
      };
    }
  }
  
  /**
   * 최종 메타데이터 계산
   * @private
   */
  _calculateFinalMetadata(result, startTime) {
    const totalProcessingTime = Date.now() - startTime;
    const processedLength = result.processedText.length;
    const originalLength = result.originalText.length;
    
    const reductionRate = originalLength > 0 ? 
      ((originalLength - processedLength) / originalLength * 100) : 0;
    
    const improvementScore = this._calculateImprovementScore(result);
    
    const completedPhases = Object.entries(result.phases)
      .filter(([, phase]) => phase.success)
      .map(([name]) => name);
    
    return {
      originalLength,
      processedLength,
      reductionRate: Math.round(reductionRate * 100) / 100,
      improvementScore: Math.round(improvementScore * 100) / 100,
      processingTime: totalProcessingTime,
      phases: completedPhases,
      timingBreakdown: { ...this.timingMetrics },
      qualityScore: result.phases.postProcessing?.qualityScore || 0.8
    };
  }
  
  /**
   * 개선 점수 계산
   * @private
   */
  _calculateImprovementScore(result) {
    let score = 0;
    
    // 템플릿 캐시 기여도
    if (result.phases.templateCache?.success) {
      score += result.phases.templateCache.noiseReductionRate * 0.3;
    }
    
    // 프롬프트 보강 기여도
    if (result.phases.promptEnhancement?.success) {
      score += result.phases.promptEnhancement.improvementScore * 0.4;
    }
    
    // 컨텍스트 분석 기여도
    if (result.phases.contextAnalysis?.success) {
      score += result.phases.contextAnalysis.contextScore * 0.2;
    }
    
    // AI 처리 기여도
    if (result.phases.aiProcessing?.success) {
      score += 10; // 기본 AI 처리 점수
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * 성능 메트릭 업데이트
   * @private
   */
  _updatePerformanceMetrics(result) {
    this.performanceMetrics.totalProcessed++;
    
    const totalTime = this.performanceMetrics.averageProcessingTime * (this.performanceMetrics.totalProcessed - 1);
    this.performanceMetrics.averageProcessingTime = 
      (totalTime + result.metadata.processingTime) / this.performanceMetrics.totalProcessed;
    
    this.performanceMetrics.successRate = 
      ((this.performanceMetrics.totalProcessed - this.performanceMetrics.errorCount) / 
       this.performanceMetrics.totalProcessed) * 100;
    
    const totalImprovement = this.performanceMetrics.improvementScore * (this.performanceMetrics.totalProcessed - 1);
    this.performanceMetrics.improvementScore = 
      (totalImprovement + result.metadata.improvementScore) / this.performanceMetrics.totalProcessed;
  }
  
  /**
   * 오류 처리 및 폴백
   * @private
   */
  async _handleProcessingError(text, error, options, processingId) {
    console.log(`🔄 오류 복구 처리 시작 [${processingId}]`);
    
    try {
      // 기본 텍스트 정제만 수행
      const basicProcessedText = this._basicTextProcessing(text);
      
      return {
        processingId,
        originalText: text,
        processedText: basicProcessedText,
        success: false,
        error: error.message,
        fallbackMode: true,
        metadata: {
          originalLength: text.length,
          processedLength: basicProcessedText.length,
          reductionRate: ((text.length - basicProcessedText.length) / text.length * 100),
          processingTime: 0,
          phases: ['fallback'],
          qualityScore: 0.5
        }
      };
      
    } catch (fallbackError) {
      console.error(`❌ 폴백 처리도 실패 [${processingId}]:`, fallbackError);
      
      return {
        processingId,
        originalText: text,
        processedText: text, // 원본 그대로 반환
        success: false,
        error: `Primary: ${error.message}, Fallback: ${fallbackError.message}`,
        fallbackMode: true,
        metadata: {
          originalLength: text.length,
          processedLength: text.length,
          reductionRate: 0,
          processingTime: 0,
          phases: [],
          qualityScore: 0.3
        }
      };
    }
  }
  
  // 유틸리티 메서드들
  
  _generateProcessingId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  _getDefaultPrompt(text, options) {
    return `다음 의료 문서를 분석하여 주요 정보를 추출하고 정리하세요:\n\n${text}`;
  }
  
  _getDefaultSystemPrompt() {
    return '당신은 의료 문서 분석 전문가입니다. 정확하고 체계적인 분석을 제공하세요.';
  }
  
  _selectOptimalModel(contextAnalysis, options) {
    if (contextAnalysis?.contextScore?.overall > 80) {
      return 'gpt-4o-mini'; // 고품질 문서는 효율적 모델
    } else if (contextAnalysis?.contextScore?.overall < 50) {
      return 'gpt-4o'; // 저품질 문서는 고성능 모델
    }
    return options.model || 'gpt-4o-mini'; // 기본값
  }
  
  async _callAIService(prompt, systemPrompt, model, options) {
    // 실제 구현에서는 OpenAI API 호출
    // 여기서는 시뮬레이션
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          processedText: prompt.substring(0, 1000) + '...[AI 처리 완료]',
          tokensUsed: 500
        });
      }, 1000);
    });
  }
  
  _basicTextProcessing(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s가-힣.,!?-]/g, '')
      .trim();
  }
  
  _assessQuality(originalText, processedText) {
    const lengthRatio = processedText.length / originalText.length;
    if (lengthRatio < 0.3 || lengthRatio > 1.2) return 0.5;
    return 0.8;
  }
  
  _additionalCleaning(text) {
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{3,}/g, ' ')
      .trim();
  }
  
  /**
   * 시스템 상태 및 성능 메트릭 반환
   */
  getSystemStatus() {
    return {
      version: this.version,
      initialized: this.initialized,
      config: this.config,
      performanceMetrics: this.performanceMetrics,
      timingMetrics: this.timingMetrics,
      components: {
        templateCache: hospitalTemplateCache.getSystemStatus(),
        contextAnalyzer: contextAnalyzer.getSystemStatus(),
        promptEnhancer: promptEnhancer.getSystemStatus()
      }
    };
  }
  
  /**
   * 성능 리포트 생성
   */
  generatePerformanceReport() {
    const status = this.getSystemStatus();
    
    return {
      summary: {
        totalProcessed: status.performanceMetrics.totalProcessed,
        successRate: `${status.performanceMetrics.successRate.toFixed(1)}%`,
        averageProcessingTime: `${status.performanceMetrics.averageProcessingTime.toFixed(0)}ms`,
        averageImprovementScore: `${status.performanceMetrics.improvementScore.toFixed(1)}%`
      },
      phasePerformance: {
        templateCacheHitRate: status.performanceMetrics.totalProcessed > 0 ? 
          `${(status.performanceMetrics.templateCacheHits / status.performanceMetrics.totalProcessed * 100).toFixed(1)}%` : '0%',
        contextAnalysisRate: status.performanceMetrics.totalProcessed > 0 ?
          `${(status.performanceMetrics.contextAnalyses / status.performanceMetrics.totalProcessed * 100).toFixed(1)}%` : '0%',
        promptEnhancementRate: status.performanceMetrics.totalProcessed > 0 ?
          `${(status.performanceMetrics.promptEnhancements / status.performanceMetrics.totalProcessed * 100).toFixed(1)}%` : '0%'
      },
      timingBreakdown: Object.entries(status.timingMetrics).map(([phase, time]) => ({
        phase,
        averageTime: status.performanceMetrics.totalProcessed > 0 ? 
          `${(time / status.performanceMetrics.totalProcessed).toFixed(0)}ms` : '0ms'
      }))
    };
  }
}

// 싱글톤 인스턴스 생성
const enhancedPreprocessor = new EnhancedPreprocessor();

export default enhancedPreprocessor;