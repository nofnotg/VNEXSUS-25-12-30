/**
 * Advanced Date Controller
 * 
 * 비정형 의료문서의 텍스트 배열별 정확한 날짜 구분을 위한 API 컨트롤러
 * 
 * 주요 엔드포인트:
 * 1. POST /api/advanced-date/analyze - 텍스트 배열 날짜 분석
 * 2. GET /api/advanced-date/performance - 성능 메트릭 조회
 * 3. POST /api/advanced-date/validate - 결과 검증
 * 4. GET /api/advanced-date/timeline - 날짜 타임라인 생성
 */

import { TextArrayDateController } from '../dna-engine/core/textArrayDateControllerComplete.js';
import { AdvancedTextArrayDateClassifier } from '../dna-engine/core/advancedTextArrayDateClassifier.js';
import { logger } from '../shared/logging/logger.js';

export class AdvancedDateController {
  constructor() {
    this.controller = new TextArrayDateController();
    this.classifier = new AdvancedTextArrayDateClassifier();
    this.processingQueue = new Map();
    this.resultCache = new Map();
    this.maxCacheSize = 100;
  }

  /**
   * 텍스트 배열 날짜 분석
   * POST /api/advanced-date/analyze
   */
  async analyzeTextArrayDates(req, res) {
    try {
      const { documentText, options = {} } = req.body;
      
      if (!documentText || typeof documentText !== 'string') {
        return res.status(400).json({
          success: false,
          error: '유효한 문서 텍스트가 필요합니다.',
          code: 'INVALID_INPUT'
        });
      }
      
      // 요청 ID 생성
      const requestId = this.generateRequestId();
      
      logger.info({
        event: 'advanced_date_analysis_request',
        requestId,
        documentLength: documentText.length,
        optionsSummary: {
          minimumConfidence: options?.minimumConfidence,
          groupByRole: options?.groupByRole,
          enableAI: options?.enableAI
        }
      });
      
      // 캐시 확인
      const cacheKey = this.generateCacheKey(documentText, options);
      if (this.resultCache.has(cacheKey)) {
        logger.info({
          event: 'advanced_date_analysis_cache_hit',
          requestId,
          cacheKeyLength: cacheKey.length
        });
        return res.json({
          success: true,
          requestId,
          cached: true,
          result: this.resultCache.get(cacheKey)
        });
      }
      
      // 처리 시작
      this.processingQueue.set(requestId, {
        status: 'processing',
        startTime: Date.now(),
        documentLength: documentText.length
      });
      
      // 메인 분석 실행
      const analysisResult = await this.controller.processDocumentDateArrays(documentText, {
        ...options,
        requestId
      });
      
      // 결과 후처리
      const enhancedResult = await this.enhanceAnalysisResult(analysisResult, options);
      
      // 캐시 저장
      this.saveToCache(cacheKey, enhancedResult);
      
      // 처리 완료
      this.processingQueue.delete(requestId);
      
      logger.info({
        event: 'advanced_date_analysis_complete',
        requestId,
        totalDates: enhancedResult.result?.documentSummary?.totalDates || 0
      });
      
      res.json({
        success: true,
        requestId,
        cached: false,
        result: enhancedResult
      });
      
    } catch (error) {
      logger.error({
        event: 'advanced_date_analysis_failed',
        error: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'ANALYSIS_FAILED',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /**
   * 성능 메트릭 조회
   * GET /api/advanced-date/performance
   */
  async getPerformanceMetrics(req, res) {
    try {
      const performanceReport = this.controller.generatePerformanceReport();
      
      // 추가 시스템 정보
      const systemInfo = {
        queueSize: this.processingQueue.size,
        cacheSize: this.resultCache.size,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        currentProcessing: Array.from(this.processingQueue.entries()).map(([id, info]) => ({
          requestId: id,
          status: info.status,
          duration: Date.now() - info.startTime,
          documentLength: info.documentLength
        }))
      };
      
      res.json({
        success: true,
        performance: performanceReport,
        system: systemInfo,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error({
        event: 'advanced_date_performance_failed',
        error: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'METRICS_FAILED'
      });
    }
  }

  /**
   * 결과 검증
   * POST /api/advanced-date/validate
   */
  async validateResults(req, res) {
    try {
      const { analysisResult, validationCriteria = {} } = req.body;
      
      if (!analysisResult) {
        return res.status(400).json({
          success: false,
          error: '검증할 분석 결과가 필요합니다.',
          code: 'INVALID_INPUT'
        });
      }
      
      logger.info({
        event: 'advanced_date_validation_start'
      });
      
      const validation = await this.performResultValidation(analysisResult, validationCriteria);
      
      logger.info({
        event: 'advanced_date_validation_complete',
        overall: validation.overall,
        score: Number.isFinite(validation.score) ? Number(validation.score.toFixed(2)) : validation.score
      });
      
      res.json({
        success: true,
        validation,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error({
        event: 'advanced_date_validation_failed',
        error: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'VALIDATION_FAILED'
      });
    }
  }

  /**
   * 날짜 타임라인 생성
   * GET /api/advanced-date/timeline/:requestId
   */
  async generateDateTimeline(req, res) {
    try {
      const { requestId } = req.params;
      const { format = 'detailed', sortBy = 'date' } = req.query;
      
      // 캐시에서 결과 찾기
      let analysisResult = null;
      for (const [key, result] of this.resultCache.entries()) {
        if (result.requestId === requestId) {
          analysisResult = result;
          break;
        }
      }
      
      if (!analysisResult) {
        return res.status(404).json({
          success: false,
          error: '해당 요청 ID의 결과를 찾을 수 없습니다.',
          code: 'RESULT_NOT_FOUND'
        });
      }
      
      logger.info({
        event: 'advanced_date_timeline_generate',
        requestId,
        format
      });
      
      const timeline = await this.createEnhancedTimeline(analysisResult, { format, sortBy });
      
      res.json({
        success: true,
        requestId,
        timeline,
        metadata: {
          totalEvents: timeline.events?.length || 0,
          dateRange: timeline.dateRange,
          format,
          sortBy
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error({
        event: 'advanced_date_timeline_failed',
        error: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'TIMELINE_FAILED'
      });
    }
  }

  /**
   * 배치 분석
   * POST /api/advanced-date/batch-analyze
   */
  async batchAnalyze(req, res) {
    try {
      const { documents, options = {} } = req.body;
      
      if (!Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({
          success: false,
          error: '분석할 문서 배열이 필요합니다.',
          code: 'INVALID_INPUT'
        });
      }
      
      if (documents.length > 10) {
        return res.status(400).json({
          success: false,
          error: '한 번에 최대 10개 문서까지 처리 가능합니다.',
          code: 'BATCH_SIZE_EXCEEDED'
        });
      }
      
      const batchId = this.generateRequestId();
      logger.info({
        event: 'advanced_date_batch_start',
        batchId,
        totalDocuments: documents.length
      });
      
      const results = [];
      const errors = [];
      
      for (let i = 0; i < documents.length; i++) {
        try {
          const document = documents[i];
          const docId = document.id || `doc_${i}`;
          
        logger.debug({
          event: 'advanced_date_batch_doc_processing',
          batchId,
          docId
        });
          
          const result = await this.controller.processDocumentDateArrays(document.text, {
            ...options,
            batchId,
            documentId: docId
          });
          
          results.push({
            documentId: docId,
            success: true,
            result: await this.enhanceAnalysisResult(result, options)
          });
          
        } catch (error) {
        logger.error({
          event: 'advanced_date_batch_doc_failed',
          batchId,
          docId: `doc_${i}`,
          error: error?.message,
          stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        });
          
          errors.push({
            documentId: document.id || `doc_${i}`,
            success: false,
            error: error.message
          });
        }
      }
      
      logger.info({
        event: 'advanced_date_batch_complete',
        batchId,
        successCount: results.length,
        failureCount: errors.length
      });
      
      res.json({
        success: true,
        batchId,
        summary: {
          total: documents.length,
          successful: results.length,
          failed: errors.length,
          successRate: results.length / documents.length
        },
        results,
        errors,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error({
        event: 'advanced_date_batch_failed',
        error: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      });
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'BATCH_ANALYSIS_FAILED'
      });
    }
  }

  /**
   * 분석 결과 향상
   */
  async enhanceAnalysisResult(analysisResult, options) {
    const enhanced = { ...analysisResult };
    
    // 추가 메타데이터
    enhanced.metadata = {
      ...enhanced.metadata,
      enhancedAt: new Date().toISOString(),
      version: this.controller.version,
      processingOptions: options
    };
    
    // 신뢰도 기반 필터링
    if (options.minimumConfidence) {
      enhanced.result = this.filterByConfidence(enhanced.result, options.minimumConfidence);
    }
    
    // 날짜 역할별 그룹화
    if (options.groupByRole) {
      enhanced.result.datesByRole = this.groupDatesByRole(enhanced.result);
    }
    
    // 통계 정보 추가
    enhanced.statistics = this.calculateStatistics(enhanced.result);
    
    return enhanced;
  }

  /**
   * 신뢰도 기반 필터링
   */
  filterByConfidence(result, minimumConfidence) {
    const filtered = { ...result };
    
    if (filtered.arrayResults) {
      filtered.arrayResults = filtered.arrayResults.map(array => ({
        ...array,
        dates: array.dates?.filter(date => date.confidence >= minimumConfidence) || []
      }));
    }
    
    if (filtered.dateTimeline) {
      filtered.dateTimeline = filtered.dateTimeline.filter(date => date.confidence >= minimumConfidence);
    }
    
    return filtered;
  }

  /**
   * 날짜 역할별 그룹화
   */
  groupDatesByRole(result) {
    const grouped = {};
    
    if (result.dateTimeline) {
      for (const date of result.dateTimeline) {
        if (!grouped[date.role]) {
          grouped[date.role] = [];
        }
        grouped[date.role].push(date);
      }
    }
    
    return grouped;
  }

  /**
   * 통계 정보 계산
   */
  calculateStatistics(result) {
    const stats = {
      totalDates: 0,
      datesByRole: {},
      confidenceDistribution: {
        high: 0,    // >= 0.8
        medium: 0,  // 0.6 - 0.8
        low: 0      // < 0.6
      },
      temporalDistribution: {
        past: 0,
        present: 0,
        future: 0
      }
    };
    
    if (result.dateTimeline) {
      const now = new Date();
      
      for (const date of result.dateTimeline) {
        stats.totalDates++;
        
        // 역할별 통계
        if (!stats.datesByRole[date.role]) {
          stats.datesByRole[date.role] = 0;
        }
        stats.datesByRole[date.role]++;
        
        // 신뢰도 분포
        if (date.confidence >= 0.8) {
          stats.confidenceDistribution.high++;
        } else if (date.confidence >= 0.6) {
          stats.confidenceDistribution.medium++;
        } else {
          stats.confidenceDistribution.low++;
        }
        
        // 시간적 분포
        if (date.date) {
          const dateObj = new Date(date.date);
          if (dateObj < now) {
            stats.temporalDistribution.past++;
          } else if (dateObj.toDateString() === now.toDateString()) {
            stats.temporalDistribution.present++;
          } else {
            stats.temporalDistribution.future++;
          }
        }
      }
    }
    
    return stats;
  }

  /**
   * 결과 검증 수행
   */
  async performResultValidation(analysisResult, criteria) {
    const validation = {
      overall: 'unknown',
      score: 0,
      checks: {
        confidence: { passed: false, score: 0, message: '' },
        completeness: { passed: false, score: 0, message: '' },
        consistency: { passed: false, score: 0, message: '' },
        accuracy: { passed: false, score: 0, message: '' }
      },
      recommendations: []
    };
    
    // 신뢰도 검증
    const avgConfidence = analysisResult.result?.qualityMetrics?.overallConfidence || 0;
    const minConfidence = criteria.minimumConfidence || 0.7;
    
    validation.checks.confidence.score = avgConfidence;
    validation.checks.confidence.passed = avgConfidence >= minConfidence;
    validation.checks.confidence.message = 
      `평균 신뢰도: ${(avgConfidence * 100).toFixed(1)}% (기준: ${(minConfidence * 100).toFixed(1)}%)`;
    
    // 완성도 검증
    const completeness = this.controller.calculateCompleteness(analysisResult.result || {});
    const minCompleteness = criteria.minimumCompleteness || 0.8;
    
    validation.checks.completeness.score = completeness;
    validation.checks.completeness.passed = completeness >= minCompleteness;
    validation.checks.completeness.message = 
      `완성도: ${(completeness * 100).toFixed(1)}% (기준: ${(minCompleteness * 100).toFixed(1)}%)`;
    
    // 일관성 검증
    const consistency = this.controller.calculateConsistency(analysisResult.result || {});
    const minConsistency = criteria.minimumConsistency || 0.9;
    
    validation.checks.consistency.score = consistency;
    validation.checks.consistency.passed = consistency >= minConsistency;
    validation.checks.consistency.message = 
      `일관성: ${(consistency * 100).toFixed(1)}% (기준: ${(minConsistency * 100).toFixed(1)}%)`;
    
    // 정확도 검증 (AI 합의도 기반)
    const aiAgreement = analysisResult.result?.qualityMetrics?.aiAgreementRate || 0;
    const minAccuracy = criteria.minimumAccuracy || 0.8;
    
    validation.checks.accuracy.score = aiAgreement;
    validation.checks.accuracy.passed = aiAgreement >= minAccuracy;
    validation.checks.accuracy.message = 
      `AI 합의도: ${(aiAgreement * 100).toFixed(1)}% (기준: ${(minAccuracy * 100).toFixed(1)}%)`;
    
    // 전체 점수 계산
    const scores = Object.values(validation.checks).map(check => check.score);
    validation.score = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // 전체 평가
    const passedChecks = Object.values(validation.checks).filter(check => check.passed).length;
    const totalChecks = Object.keys(validation.checks).length;
    
    if (passedChecks === totalChecks) {
      validation.overall = 'excellent';
    } else if (passedChecks >= totalChecks * 0.75) {
      validation.overall = 'good';
    } else if (passedChecks >= totalChecks * 0.5) {
      validation.overall = 'fair';
    } else {
      validation.overall = 'poor';
    }
    
    // 추천사항 생성
    for (const [checkName, check] of Object.entries(validation.checks)) {
      if (!check.passed) {
        validation.recommendations.push({
          type: 'improvement',
          area: checkName,
          message: `${checkName} 개선이 필요합니다: ${check.message}`,
          priority: check.score < 0.5 ? 'high' : 'medium'
        });
      }
    }
    
    return validation;
  }

  /**
   * 향상된 타임라인 생성
   */
  async createEnhancedTimeline(analysisResult, options) {
    const { format, sortBy } = options;
    const timeline = {
      events: [],
      dateRange: { start: null, end: null },
      metadata: {
        totalEvents: 0,
        format,
        sortBy
      }
    };
    
    if (!analysisResult.result?.dateTimeline) {
      return timeline;
    }
    
    let events = [...analysisResult.result.dateTimeline];
    
    // 정렬
    switch (sortBy) {
      case 'date':
        events.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        break;
      case 'confidence':
        events.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        break;
      case 'role':
        events.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
        break;
    }
    
    // 형식에 따른 처리
    if (format === 'detailed') {
      timeline.events = events.map(event => ({
        ...event,
        formattedDate: this.formatDate(event.date),
        roleDescription: this.getRoleDescription(event.role),
        confidenceLevel: this.getConfidenceLevel(event.confidence)
      }));
    } else {
      timeline.events = events.map(event => ({
        date: event.date,
        role: event.role,
        confidence: event.confidence,
        isPrimary: event.isPrimary
      }));
    }
    
    // 날짜 범위 계산
    const validDates = events.filter(e => e.date).map(e => new Date(e.date));
    if (validDates.length > 0) {
      timeline.dateRange.start = new Date(Math.min(...validDates)).toISOString().split('T')[0];
      timeline.dateRange.end = new Date(Math.max(...validDates)).toISOString().split('T')[0];
    }
    
    timeline.metadata.totalEvents = timeline.events.length;
    
    return timeline;
  }

  /**
   * 날짜 형식화
   */
  formatDate(dateString) {
    if (!dateString) return '날짜 없음';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * 역할 설명 반환
   */
  getRoleDescription(role) {
    const descriptions = {
      'visit_date': '내원일',
      'diagnosis_date': '진단일',
      'treatment_date': '치료일',
      'examination_date': '검사일',
      'surgery_date': '수술일',
      'history_date': '과거력 날짜',
      'document_date': '문서 작성일',
      'current_date': '현재 날짜',
      'future_date': '예정 날짜'
    };
    
    return descriptions[role] || role;
  }

  /**
   * 신뢰도 레벨 반환
   */
  getConfidenceLevel(confidence) {
    if (confidence >= 0.9) return '매우 높음';
    if (confidence >= 0.8) return '높음';
    if (confidence >= 0.7) return '보통';
    if (confidence >= 0.6) return '낮음';
    return '매우 낮음';
  }

  /**
   * 요청 ID 생성
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 캐시 키 생성
   */
  generateCacheKey(documentText, options) {
    const content = documentText.substring(0, 1000); // 첫 1000자만 사용
    const optionsStr = JSON.stringify(options);
    return `cache_${this.hashString(content + optionsStr)}`;
  }

  /**
   * 문자열 해시
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 캐시에 저장
   */
  saveToCache(key, result) {
    // 캐시 크기 제한
    if (this.resultCache.size >= this.maxCacheSize) {
      const firstKey = this.resultCache.keys().next().value;
      this.resultCache.delete(firstKey);
    }
    
    this.resultCache.set(key, {
      ...result,
      cachedAt: new Date().toISOString()
    });
  }

  /**
   * 캐시 정리
   */
  clearCache() {
    this.resultCache.clear();
    logger.info({
      event: 'advanced_date_result_cache_cleared'
    });
  }

  /**
   * 처리 대기열 상태 조회
   */
  getQueueStatus() {
    return {
      size: this.processingQueue.size,
      items: Array.from(this.processingQueue.entries()).map(([id, info]) => ({
        requestId: id,
        status: info.status,
        duration: Date.now() - info.startTime,
        documentLength: info.documentLength
      }))
    };
  }
}

export default AdvancedDateController;
