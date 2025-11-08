/**
 * Post-Processing Module Entry Point
 * 
 * 역할:
 * 1. OCR 결과 후처리 통합 관리
 * 2. 거대 날짜 블록 처리 로직 통합
 * 3. 메인 앱과 개발자 스튜디오 연동 지원
 * 4. 엔드-투-엔드 파이프라인 구축
 */

import massiveDateBlockProcessor from './massiveDateBlockProcessor.js';
import EnhancedMassiveDateBlockProcessor from './enhancedMassiveDateBlockProcessor.js';
import DateOrganizer from './dateOrganizer.js';
import preprocessor from './preprocessor.js';
import reportBuilder from './reportBuilder.js';
import aiEntityExtractor from './aiEntityExtractor.js';
import EnhancedEntityExtractor from './enhancedEntityExtractor.js';

class PostProcessingManager {
  constructor() {
    this.massiveDateProcessor = massiveDateBlockProcessor;
    this.enhancedMassiveDateProcessor = new EnhancedMassiveDateBlockProcessor();
    this.dateOrganizer = new DateOrganizer();
    this.preprocessor = preprocessor;
    this.reportBuilder = reportBuilder;
    this.aiEntityExtractor = aiEntityExtractor;
    this.enhancedEntityExtractor = new EnhancedEntityExtractor();
    
    // 처리 통계
    this.processingStats = {
      totalProcessed: 0,
      successfulProcessing: 0,
      averageProcessingTime: 0,
      lastProcessingTime: null
    };
  }

  /**
   * 메인 후처리 파이프라인 실행
   * @param {string} ocrText OCR로 추출된 텍스트
   * @param {Object} options 처리 옵션
   * @returns {Promise<Object>} 후처리 결과
   */
  async processOCRResult(ocrText, options = {}) {
    const startTime = Date.now();
    
    try {
      console.log('🚀 후처리 파이프라인 시작...');
      console.log(`📄 입력 텍스트 크기: ${ocrText.length} 문자`);
      
      // 1단계: 향상된 거대 날짜 블록 처리 (새로운 핵심 로직)
      console.log('\n=== 1단계: 향상된 거대 날짜 블록 처리 ===');
      const enhancedDateResult = await this.enhancedMassiveDateProcessor.processEnhancedDateBlocks(ocrText, {
        minConfidence: options.minConfidence || 0.4,
        includeAll: options.includeAll || false,
        useHybridApproach: options.useHybridApproach !== false
      });
      
      // 기존 프로세서와의 호환성을 위한 결과 변환
      const massiveDateResult = {
        dateBlocks: enhancedDateResult.blocks || [],
        structuredGroups: enhancedDateResult.timeline?.dateGroups || [],
        processedSize: enhancedDateResult.processedSize || 0,
        statistics: {
          averageConfidence: enhancedDateResult.qualityMetrics?.avgConfidence || 0,
          filteringRate: enhancedDateResult.qualityMetrics?.completeness ? 
            (1 - enhancedDateResult.qualityMetrics.completeness) * 100 : 0
        }
      };
      
      // 2단계: 기존 전처리 로직 적용
      console.log('\n=== 2단계: 전처리 로직 적용 ===');
      const preprocessedData = await this.preprocessor.run(ocrText, {
        translateTerms: options.translateTerms || false,
        requireKeywords: options.requireKeywords || false
      });
      
      // 3단계: 날짜 기반 데이터 정렬 및 구조화
      console.log('\n=== 3단계: 날짜 데이터 정렬 및 구조화 ===');
      
      // 거대 날짜 블록과 전처리된 데이터를 결합
      console.log('전처리된 데이터 타입:', typeof preprocessedData);
      console.log('전처리된 데이터 배열 여부:', Array.isArray(preprocessedData));
      console.log('전처리된 데이터:', preprocessedData);
      
      const combinedData = [
        ...(massiveDateResult.dateBlocks || []),
        ...(Array.isArray(preprocessedData) ? preprocessedData : [])
      ];
      
      console.log('결합된 데이터 길이:', combinedData.length);
      console.log('결합된 데이터 타입:', typeof combinedData);
      
      const organizedData = await this.dateOrganizer.sortAndFilter(combinedData, {
        enrollmentDate: options.enrollmentDate || new Date().toISOString().split('T')[0],
        periodType: options.period || 'all',
        sortDirection: options.sortDirection || 'asc',
        groupByDate: options.groupByDate || false
      });
      
      // 4단계: AI 기반 엔티티 추출 (선택적)
      let aiExtractedData = null;
      if (options.useAIExtraction) {
        console.log('\n=== 4단계: AI 엔티티 추출 ===');
        // massiveDateResult.structuredGroups를 텍스트로 변환
        const textForExtraction = Array.isArray(massiveDateResult.structuredGroups) 
          ? massiveDateResult.structuredGroups.map(group => 
              typeof group === 'string' ? group : 
              (group.text || group.content || JSON.stringify(group))
            ).join('\n')
          : (typeof massiveDateResult.structuredGroups === 'string' 
              ? massiveDateResult.structuredGroups 
              : ocrText);
        
        aiExtractedData = await this.enhancedEntityExtractor.extractAllEntities(
          textForExtraction,
          options.aiExtractionOptions || {}
        );
      }
      
      // 5단계: 최종 보고서 생성
      console.log('\n=== 5단계: 최종 보고서 생성 ===');
      const finalReport = await this.reportBuilder.buildReport(
        organizedData,
        options.patientInfo || {},
        {
          format: options.reportFormat || 'json',
          includeRawText: options.includeRawText || false
        }
      );
      
      // 처리 통계 업데이트
      const processingTime = Date.now() - startTime;
      this._updateProcessingStats(processingTime, true);
      
      console.log(`\n✅ 후처리 파이프라인 완료 (${processingTime}ms)`);
      
      return {
        success: true,
        processingTime,
        pipeline: {
          massiveDateBlocks: massiveDateResult,
          preprocessedData,
          organizedData,
          aiExtractedData,
          finalReport
        },
        statistics: {
          originalTextLength: ocrText.length,
          processedGroups: massiveDateResult.structuredGroups.length,
          dateBlocks: massiveDateResult.dateBlocks.length,
          confidence: massiveDateResult.statistics.averageConfidence,
          filteringRate: massiveDateResult.statistics.filteringRate
        },
        metadata: {
          version: '7.2',
          timestamp: new Date().toISOString(),
          processingMode: options.useAIExtraction ? 'AI_ENHANCED' : 'RULE_BASED',
          pipelineSteps: 5
        }
      };
      
    } catch (error) {
      console.error('❌ 후처리 파이프라인 오류:', error);
      
      // 처리 통계 업데이트 (실패)
      const processingTime = Date.now() - startTime;
      this._updateProcessingStats(processingTime, false);
      
      throw new Error(`후처리 파이프라인 실패: ${error.message}`);
    }
  }

  /**
   * 개발자 스튜디오용 디버깅 정보 제공
   * @param {string} ocrText OCR 텍스트
   * @param {Object} options 옵션
   * @returns {Promise<Object>} 디버깅 정보
   */
  async getDebugInfo(ocrText, options = {}) {
    try {
      console.log('🔧 개발자 스튜디오 디버깅 정보 생성...');
      
      // 거대 날짜 블록 분석 정보
      const massiveDateAnalysis = await this.massiveDateProcessor.processMassiveDateBlocks(ocrText, {
        includeAll: true,
        minConfidence: 0.1
      });
      
      // 전처리 분석 정보
      const preprocessAnalysis = await this.preprocessor.run(ocrText, {
        translateTerms: true,
        requireKeywords: false
      });
      
      return {
        success: true,
        debugInfo: {
          textAnalysis: {
            originalLength: ocrText.length,
            cleanedLength: massiveDateAnalysis.processedSize,
            reductionRate: ((ocrText.length - massiveDateAnalysis.processedSize) / ocrText.length * 100).toFixed(1)
          },
          dateBlockAnalysis: {
            totalGroups: massiveDateAnalysis.structuredGroups.length,
            dateBlocks: massiveDateAnalysis.dateBlocks.length,
            averageConfidence: massiveDateAnalysis.statistics.averageConfidence,
            dateRange: massiveDateAnalysis.structuredGroups.length > 0 ? {
              earliest: massiveDateAnalysis.structuredGroups[0].date,
              latest: massiveDateAnalysis.structuredGroups[massiveDateAnalysis.structuredGroups.length - 1].date
            } : null
          },
          preprocessingAnalysis: {
            extractedDates: preprocessAnalysis.dates || [],
            hospitalNames: preprocessAnalysis.hospitalNames || [],
            keywords: preprocessAnalysis.keywords || []
          },
          processingStats: this.processingStats,
          recommendations: this._generateRecommendations(massiveDateAnalysis, preprocessAnalysis)
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ 디버깅 정보 생성 오류:', error);
      throw new Error(`디버깅 정보 생성 실패: ${error.message}`);
    }
  }

  /**
   * 메인 앱용 간소화된 처리
   * @param {string} ocrText OCR 텍스트
   * @param {Object} options 옵션
   * @returns {Promise<Object>} 간소화된 결과
   */
  async processForMainApp(ocrText, options = {}) {
    try {
      console.log('📱 메인 앱용 간소화 처리 시작...');
      
      const result = await this.processOCRResult(ocrText, {
        ...options,
        useAIExtraction: false, // 메인 앱에서는 룰 기반만 사용
        minConfidence: 0.5 // 높은 신뢰도만 사용
      });
      
      // 메인 앱에 필요한 정보만 추출
      return {
        success: result.success,
        dateBlocks: result.pipeline.massiveDateBlocks.dateBlocks,
        organizedData: result.pipeline.organizedData,
        finalReport: result.pipeline.finalReport,
        statistics: {
          processedGroups: result.statistics.processedGroups,
          confidence: result.statistics.confidence,
          processingTime: result.processingTime
        },
        metadata: {
          version: result.metadata.version,
          timestamp: result.metadata.timestamp
        }
      };
      
    } catch (error) {
      console.error('❌ 메인 앱 처리 오류:', error);
      throw new Error(`메인 앱 처리 실패: ${error.message}`);
    }
  }

  /**
   * 처리 통계 업데이트
   * @param {number} processingTime 처리 시간
   * @param {boolean} success 성공 여부
   * @private
   */
  _updateProcessingStats(processingTime, success) {
    this.processingStats.totalProcessed++;
    if (success) {
      this.processingStats.successfulProcessing++;
    }
    
    // 평균 처리 시간 계산
    if (this.processingStats.averageProcessingTime === 0) {
      this.processingStats.averageProcessingTime = processingTime;
    } else {
      this.processingStats.averageProcessingTime = 
        (this.processingStats.averageProcessingTime + processingTime) / 2;
    }
    
    this.processingStats.lastProcessingTime = new Date().toISOString();
  }

  /**
   * 개선 권장사항 생성
   * @param {Object} massiveDateAnalysis 거대 날짜 블록 분석 결과
   * @param {Object} preprocessAnalysis 전처리 분석 결과
   * @returns {Array} 권장사항 목록
   * @private
   */
  _generateRecommendations(massiveDateAnalysis, preprocessAnalysis) {
    const recommendations = [];
    
    // 신뢰도 기반 권장사항
    const avgConfidence = parseFloat(massiveDateAnalysis.statistics.averageConfidence);
    if (avgConfidence < 0.5) {
      recommendations.push({
        type: 'confidence',
        level: 'warning',
        message: '평균 신뢰도가 낮습니다. OCR 품질을 확인하거나 전처리 로직을 개선하세요.',
        value: avgConfidence
      });
    }
    
    // 필터링 비율 기반 권장사항
    const filteringRate = parseFloat(massiveDateAnalysis.statistics.filteringRate);
    if (filteringRate < 30) {
      recommendations.push({
        type: 'filtering',
        level: 'info',
        message: '필터링 비율이 낮습니다. 더 많은 데이터가 보존되고 있습니다.',
        value: filteringRate
      });
    }
    
    // 날짜 블록 수 기반 권장사항
    if (massiveDateAnalysis.dateBlocks.length === 0) {
      recommendations.push({
        type: 'dateBlocks',
        level: 'error',
        message: '날짜 블록이 발견되지 않았습니다. 입력 텍스트나 날짜 패턴을 확인하세요.',
        value: 0
      });
    }
    
    return recommendations;
  }

  /**
   * 처리 통계 조회
   * @returns {Object} 처리 통계
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      successRate: this.processingStats.totalProcessed > 0 ? 
        (this.processingStats.successfulProcessing / this.processingStats.totalProcessed * 100).toFixed(1) : 0
    };
  }

  /**
   * 통계 초기화
   */
  resetStats() {
    this.processingStats = {
      totalProcessed: 0,
      successfulProcessing: 0,
      averageProcessingTime: 0,
      lastProcessingTime: null
    };
  }
}

export default new PostProcessingManager();