/**
 * Vision OCR과 DNA 시퀀싱 브리지 (Layout Enhanced)
 * 
 * Google Vision OCR 결과를 DNA 유전자 추출기와 레이아웃 복원기로 전달하여
 * 완전한 의료문서 분석 파이프라인을 구축합니다.
 */

import { MedicalGeneExtractor } from './geneExtractor.cjs';
import { LayoutReconstructor } from './layoutReconstructor.js';
import { NestedDateResolver } from './nestedDateResolver.js';
import { CausalNetworkBuilder } from './causalNetworkBuilder.js';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname 설정 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VisionDNABridge {
  constructor() {
    this.geneExtractor = new MedicalGeneExtractor();
    this.layoutReconstructor = new LayoutReconstructor();
    this.dateResolver = new NestedDateResolver();
    this.causalNetworkBuilder = new CausalNetworkBuilder();
    this.processingStats = {
      totalDocuments: 0,
      successfulExtractions: 0,
      successfulLayoutReconstructions: 0,
      successfulDateResolutions: 0,
      successfulNetworkBuilds: 0,
      averageProcessingTime: 0,
      averageLayoutTime: 0,
      averageDateResolutionTime: 0,
      averageNetworkTime: 0,
      lastProcessed: null
    };
  }

  /**
   * PDF 문서를 전체 파이프라인으로 처리합니다.
   * @param {string} imagePath - 처리할 이미지/PDF 경로
   * @param {Object} options - 처리 옵션
   * @returns {Promise<Object>} 통합 분석 결과
   */
  async processDocument(imagePath, options = {}) {
    console.log('🔄 Vision-DNA 통합 분석 시작...');
    const startTime = Date.now();
    
    try {
      // 1. Google Vision OCR 실행
      console.log('📄 1단계: Google Vision OCR 실행...');
      const ocrResult = await this.runVisionOCR(imagePath);
      
      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new Error('OCR에서 텍스트를 추출하지 못했습니다');
      }

      console.log(`✅ OCR 완료: ${ocrResult.text.length}자 추출`);

      // 2. 레이아웃 복원 실행
      console.log('🖼️ 2단계: 레이아웃 복원 실행...');
      const layoutResult = await this.layoutReconstructor.reconstructLayout(ocrResult.fullResult || {}, {
        preserveCoordinates: true,
        detectTables: true,
        medicalFocus: true
      });

      if (layoutResult.success) {
        console.log(`✅ 레이아웃 복원 완료: ${layoutResult.layout.spatialGroups}개 그룹`);
      } else {
        console.warn(`⚠️ 레이아웃 복원 실패, 기본 DNA 추출로 진행`);
      }

      // 3. 중첩 날짜 해결
      console.log('📅 3단계: 중첩 날짜 해결 실행...');
      const dateResult = await this.dateResolver.resolveNestedDates(ocrResult.text, {
        referenceDate: options.referenceDate || new Date(),
        medicalContext: true,
        layoutInfo: layoutResult.success ? layoutResult.layout : null
      });

      if (dateResult.success) {
        console.log(`✅ 날짜 해결 완료: ${dateResult.resolved.dates.length}개 시점`);
      } else {
        console.warn(`⚠️ 날짜 해결 실패, 기본 DNA 추출로 진행`);
      }

      // 4. DNA 유전자 추출 (레이아웃 + 날짜 향상)
      console.log('🧬 4단계: DNA 유전자 추출 실행...');
      let dnaResult;
      
      if (layoutResult.success && layoutResult.enhancedGenes) {
        // 레이아웃 향상된 DNA에 날짜 정보 추가
        const dateEnhancedGenes = await this.enhanceGenesWithDates(
          layoutResult.enhancedGenes, 
          dateResult.success ? dateResult.resolved.dates : []
        );
        
        dnaResult = {
          success: true,
          genes: dateEnhancedGenes,
          stats: layoutResult.stats,
          layoutEnhanced: true,
          dateEnhanced: dateResult.success
        };
      } else {
        // 기본 DNA 추출
        dnaResult = await this.geneExtractor.extractGenes(ocrResult.text, options);
        dnaResult.layoutEnhanced = false;
        dnaResult.dateEnhanced = false;
      }

      console.log(`✅ DNA 추출 완료: ${dnaResult.genes.length}개 유전자 (Layout: ${dnaResult.layoutEnhanced}, Date: ${dnaResult.dateEnhanced})`);

      // 5. 인과관계 네트워크 구축
      console.log('🔗 5단계: 인과관계 네트워크 구축 실행...');
      const networkResult = await this.causalNetworkBuilder.buildCausalNetwork(dnaResult.genes, {
        minConfidence: options.minCausalConfidence || 0.6,
        includeTemporalInfo: dateResult.success,
        includeSpatialInfo: layoutResult.success,
        medicalContext: true
      });

      if (networkResult.success) {
        console.log(`✅ 네트워크 구축 완료: ${networkResult.analysis.totalRelations}개 관계, ${networkResult.analysis.clusters}개 클러스터`);
      } else {
        console.warn(`⚠️ 네트워크 구축 실패, 기본 결과로 진행`);
      }

      // 6. 결과 통합
      const processingTime = Date.now() - startTime;
      const integratedResult = this.integrateResults(ocrResult, dnaResult, layoutResult, dateResult, networkResult, processingTime);

      // 4. 통계 업데이트
      this.updateProcessingStats(true, processingTime);

      console.log(`🎉 통합 분석 완료 (${processingTime}ms)`);
      return integratedResult;

    } catch (error) {
      console.error('❌ Vision-DNA 통합 분석 실패:', error);
      this.updateProcessingStats(false, Date.now() - startTime);
      throw new Error(`통합 분석 실패: ${error.message}`);
    }
  }

  /**
   * DNA 유전자에 날짜 정보를 추가하여 향상시킵니다.
   * @param {Array} genes - 기존 DNA 유전자 배열
   * @param {Array} resolvedDates - 해결된 날짜 배열
   * @returns {Promise<Array>} 날짜 향상된 DNA 유전자
   */
  async enhanceGenesWithDates(genes, resolvedDates) {
    if (!resolvedDates || resolvedDates.length === 0) {
      return genes;
    }

    console.log('📅 DNA 유전자에 날짜 정보 통합 중...');

    return genes.map(gene => {
      // 유전자와 가장 관련성 높은 날짜 찾기
      const relatedDate = this.findMostRelevantDate(gene, resolvedDates);
      
      if (relatedDate) {
        return {
          ...gene,
          enhancedAnchors: {
            ...gene.enhancedAnchors || gene.anchors,
            temporal: relatedDate.resolved.date,
            temporalPrecision: relatedDate.resolved.precision,
            temporalConfidence: relatedDate.resolved.confidence,
            temporalType: relatedDate.resolved.dateType
          },
          temporalContext: {
            originalExpression: relatedDate.text,
            normalizedDate: relatedDate.resolved.date,
            resolutionMethod: relatedDate.resolutionMethod,
            medicalContext: relatedDate.medicalContext || 'general',
            clinicalSignificance: relatedDate.clinicalSignificance || 0.5
          },
          dateEnhanced: true
        };
      }

      return {
        ...gene,
        dateEnhanced: false
      };
    });
  }

  /**
   * 유전자와 가장 관련성 높은 날짜를 찾습니다.
   */
  findMostRelevantDate(gene, resolvedDates) {
    if (!gene.content || !resolvedDates.length) return null;

    let bestMatch = null;
    let bestScore = 0;

    resolvedDates.forEach(dateExpr => {
      const score = this.calculateDateGeneRelevance(gene, dateExpr);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = dateExpr;
      }
    });

    // 최소 임계값 이상일 때만 반환
    return bestScore > 0.3 ? bestMatch : null;
  }

  /**
   * 날짜와 유전자 간의 관련성 점수를 계산합니다.
   */
  calculateDateGeneRelevance(gene, dateExpr) {
    let score = 0;

    // 1. 텍스트 근접성 (gene.content와 dateExpr.text의 위치)
    if (gene.layout && gene.layout.position && dateExpr.startIndex !== undefined) {
      // 레이아웃 정보가 있는 경우 공간적 근접성 고려
      const proximityScore = this.calculateTextProximity(gene.content, dateExpr.text);
      score += proximityScore * 0.4;
    }

    // 2. 의료 컨텍스트 일치
    const medicalContextScore = this.calculateMedicalContextMatch(gene, dateExpr);
    score += medicalContextScore * 0.3;

    // 3. 시간적 논리성
    const temporalLogicScore = this.calculateTemporalLogic(gene, dateExpr);
    score += temporalLogicScore * 0.2;

    // 4. 날짜 신뢰도
    const confidenceScore = dateExpr.resolved?.confidence || 0;
    score += confidenceScore * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * 텍스트 근접성을 계산합니다.
   */
  calculateTextProximity(geneContent, dateText) {
    // 단순한 텍스트 포함 관계 확인
    const geneWords = geneContent.toLowerCase().split(/\s+/);
    const dateWords = dateText.toLowerCase().split(/\s+/);
    
    let commonWords = 0;
    geneWords.forEach(word => {
      if (dateWords.includes(word)) {
        commonWords++;
      }
    });

    return commonWords > 0 ? 0.8 : 0.3; // 공통 단어가 있으면 높은 점수
  }

  /**
   * 의료 컨텍스트 일치도를 계산합니다.
   */
  calculateMedicalContextMatch(gene, dateExpr) {
    const geneContent = gene.content.toLowerCase();
    const dateContext = dateExpr.medicalContext || 'general';

    // 의료 맥락별 키워드 매칭
    const contextKeywords = {
      diagnosis: ['진단', '병명', '질환'],
      medication: ['복용', '처방', '투약', '약물'],
      examination: ['검사', '결과', '수치'],
      symptom: ['증상', '소견', '호소']
    };

    if (contextKeywords[dateContext]) {
      const hasKeyword = contextKeywords[dateContext].some(keyword => 
        geneContent.includes(keyword)
      );
      return hasKeyword ? 0.9 : 0.4;
    }

    return 0.5; // 기본 점수
  }

  /**
   * 시간적 논리성을 계산합니다.
   */
  calculateTemporalLogic(gene, dateExpr) {
    const geneContent = gene.content.toLowerCase();
    
    // 현재 시점과 관련된 표현
    const currentTimeIndicators = ['금일', '오늘', '현재', '현재일시'];
    const pastTimeIndicators = ['과거', '이전', '예전'];
    const futureTimeIndicators = ['향후', '앞으로', '추후'];

    let score = 0.5; // 기본 점수

    // 시간 지시어와 날짜 유형의 일치성 확인
    if (dateExpr.resolved?.dateType === 'relative') {
      if (currentTimeIndicators.some(indicator => geneContent.includes(indicator))) {
        score = 0.9;
      } else if (pastTimeIndicators.some(indicator => geneContent.includes(indicator))) {
        score = 0.8;
      }
    } else if (dateExpr.resolved?.dateType === 'absolute') {
      // 절대 날짜는 일반적으로 신뢰도가 높음
      score = 0.8;
    }

    return score;
  }

  /**
   * 텍스트만으로 DNA 분석을 수행합니다.
   * @param {string} medicalText - 의료 텍스트
   * @param {Object} options - 분석 옵션
   * @returns {Promise<Object>} DNA 분석 결과
   */
  async analyzeText(medicalText, options = {}) {
    console.log('🧬 텍스트 DNA 분석 시작...');
    const startTime = Date.now();
    
    try {
      // DNA 유전자 추출
      const dnaResult = await this.geneExtractor.extractGenes(medicalText, options);
      
      const processingTime = Date.now() - startTime;
      
      // 결과 포맷팅
      const result = {
        analysisType: 'text_only',
        input: {
          textLength: medicalText.length,
          source: 'direct_input'
        },
        dnaAnalysis: dnaResult,
        processingTime,
        timestamp: new Date().toISOString(),
        performance: {
          genesPerSecond: dnaResult.genes.length / (processingTime / 1000),
          confidenceScore: dnaResult.averageConfidence
        }
      };

      this.updateProcessingStats(true, processingTime);
      console.log(`✅ 텍스트 DNA 분석 완료 (${processingTime}ms)`);
      
      return result;

    } catch (error) {
      console.error('❌ 텍스트 DNA 분석 실패:', error);
      this.updateProcessingStats(false, Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Google Vision OCR을 실행합니다.
   * @param {string} imagePath - 이미지 경로
   * @returns {Promise<Object>} OCR 결과
   */
  async runVisionOCR(imagePath) {
    try {
      // 기존 visionService를 동적으로 import
      const { processPdfFile } = await import('../../services/visionService.js');
      return await processPdfFile(imagePath);
    } catch (error) {
      // 백엔드 서비스를 시도
      try {
        const { processPdfFile } = await import('../../../backend/services/visionService.js');
        return await processPdfFile(imagePath);
      } catch (backendError) {
        throw new Error(`Vision OCR 서비스 로드 실패: ${error.message}`);
      }
    }
  }

  /**
   * OCR과 DNA 결과를 통합합니다.
   * @param {Object} ocrResult - OCR 결과
   * @param {Object} dnaResult - DNA 분석 결과
   * @param {number} processingTime - 총 처리 시간
   * @returns {Object} 통합 결과
   */
  integrateResults(ocrResult, dnaResult, layoutResult, dateResult, networkResult, processingTime) {
    return {
      analysisType: 'vision_dna_integrated',
      input: {
        sourceFile: ocrResult.sourceFile || 'unknown',
        textLength: ocrResult.text.length,
        ocrConfidence: ocrResult.confidence || null
      },
      ocrAnalysis: {
        extractedText: ocrResult.text,
        pageCount: ocrResult.pageCount || 1,
        confidence: ocrResult.confidence || null,
        processingTime: ocrResult.processingTime || null
      },
      dnaAnalysis: dnaResult,
      layoutAnalysis: layoutResult.success ? {
        spatialGroups: layoutResult.layout.spatialGroups,
        documentStructure: layoutResult.layout.documentStructure,
        structuredElements: layoutResult.layout.structuredElements,
        visualContext: layoutResult.layout.visualContext,
        accuracy: layoutResult.stats.accuracy,
        confidence: layoutResult.stats.confidence,
        coverage: layoutResult.stats.coverage
      } : null,
      dateAnalysis: dateResult.success ? {
        totalDates: dateResult.analysis.totalDates,
        ambiguousResolved: dateResult.analysis.ambiguousResolved,
        conflictsResolved: dateResult.analysis.conflictsResolved,
        confidenceScore: dateResult.analysis.confidenceScore,
        medicalTimeline: dateResult.resolved.medicalTimeline,
        timeHierarchy: dateResult.resolved.timeHierarchy
      } : null,
      networkAnalysis: networkResult.success ? {
        totalNodes: networkResult.analysis.totalNodes,
        totalRelations: networkResult.analysis.totalRelations,
        strongRelations: networkResult.analysis.strongRelations,
        clusters: networkResult.analysis.clusters,
        pathways: networkResult.analysis.pathways,
        networkDensity: networkResult.analysis.networkDensity,
        averageConfidence: networkResult.analysis.averageConfidence,
        primaryCauses: networkResult.insights.primaryCauses,
        criticalPathways: networkResult.insights.criticalPathways,
        riskFactors: networkResult.insights.riskFactors,
        treatmentEffectiveness: networkResult.insights.treatmentEffectiveness
      } : null,
      integratedMetrics: {
        totalGenes: dnaResult.genes.length,
        averageConfidence: dnaResult.averageConfidence,
        genesPerPage: dnaResult.genes.length / (ocrResult.pageCount || 1),
        textToGeneRatio: dnaResult.genes.length / (ocrResult.text.length / 1000), // 1000자당 유전자 수
        layoutEnhanced: dnaResult.layoutEnhanced || false,
        dateEnhanced: dnaResult.dateEnhanced || false,
        networkEnhanced: networkResult.success || false,
        spatialAccuracy: layoutResult.success ? layoutResult.stats.accuracy : null,
        temporalAccuracy: dateResult.success ? dateResult.analysis.confidenceScore : null,
        causalAccuracy: networkResult.success ? networkResult.analysis.averageConfidence : null
      },
      processingTime,
      timestamp: new Date().toISOString(),
      qualityMetrics: this.calculateQualityMetrics(ocrResult, dnaResult)
    };
  }

  /**
   * 품질 지표를 계산합니다.
   * @param {Object} ocrResult - OCR 결과
   * @param {Object} dnaResult - DNA 결과
   * @returns {Object} 품질 지표
   */
  calculateQualityMetrics(ocrResult, dnaResult) {
    const textLength = ocrResult.text.length;
    const geneCount = dnaResult.genes.length;
    
    // 유전자 밀도 (1000자당 유전자 수)
    const geneDensity = geneCount / (textLength / 1000);
    
    // 앵커 완성도 (4개 앵커 모두 있는 유전자 비율)
    const completeGenes = dnaResult.genes.filter(gene => {
      const anchors = gene.anchors || {};
      return Object.values(anchors).filter(Boolean).length >= 3;
    }).length;
    
    const anchorCompleteness = geneCount > 0 ? completeGenes / geneCount : 0;
    
    // 시간적 일관성 (날짜 앵커가 있는 유전자 비율)
    const temporalGenes = dnaResult.genes.filter(gene => 
      gene.anchors?.temporal
    ).length;
    
    const temporalConsistency = geneCount > 0 ? temporalGenes / geneCount : 0;

    return {
      geneDensity: Math.round(geneDensity * 100) / 100,
      anchorCompleteness: Math.round(anchorCompleteness * 100) / 100,
      temporalConsistency: Math.round(temporalConsistency * 100) / 100,
      averageConfidence: Math.round(dnaResult.averageConfidence * 100) / 100,
      qualityScore: Math.round((anchorCompleteness + temporalConsistency + dnaResult.averageConfidence) * 100 / 3) / 100
    };
  }

  /**
   * 처리 통계를 업데이트합니다.
   * @param {boolean} success - 성공 여부
   * @param {number} processingTime - 처리 시간
   */
  updateProcessingStats(success, processingTime) {
    this.processingStats.totalDocuments++;
    if (success) {
      this.processingStats.successfulExtractions++;
    }
    
    // 평균 처리 시간 업데이트
    this.processingStats.averageProcessingTime = (
      (this.processingStats.averageProcessingTime * (this.processingStats.totalDocuments - 1)) + 
      processingTime
    ) / this.processingStats.totalDocuments;
    
    this.processingStats.lastProcessed = new Date().toISOString();
  }

  /**
   * 현재 처리 통계를 반환합니다.
   * @returns {Object} 처리 통계
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      successRate: this.processingStats.totalDocuments > 0 
        ? this.processingStats.successfulExtractions / this.processingStats.totalDocuments 
        : 0,
      geneExtractorStats: this.geneExtractor.getStats()
    };
  }

  /**
   * 시스템 상태를 확인합니다.
   * @returns {Promise<Object>} 시스템 상태
   */
  async checkSystemHealth() {
    const health = {
      timestamp: new Date().toISOString(),
      components: {}
    };

    try {
      // OpenAI API 키 확인
      if (process.env.OPENAI_API_KEY) {
        health.components.openai = { status: 'configured', message: 'API 키 설정됨' };
      } else {
        health.components.openai = { status: 'error', message: 'API 키 미설정' };
      }

      // Vision OCR 상태 확인
      try {
        await this.runVisionOCR('test');
      } catch (error) {
        if (error.message.includes('Vision OCR 서비스 로드 실패')) {
          health.components.vision = { status: 'error', message: 'Vision OCR 서비스 로드 실패' };
        } else {
          health.components.vision = { status: 'configured', message: 'Vision OCR 서비스 로드됨' };
        }
      }

      // DNA 추출기 상태
      health.components.dnaExtractor = { 
        status: 'ready', 
        message: 'DNA 추출기 준비됨',
        stats: this.geneExtractor.getStats()
      };

      // 전체 상태 결정
      const hasErrors = Object.values(health.components).some(comp => comp.status === 'error');
      health.overallStatus = hasErrors ? 'degraded' : 'healthy';

    } catch (error) {
      health.overallStatus = 'error';
      health.error = error.message;
    }

    return health;
  }

  /**
   * 간단한 통합 테스트
   */
  async test() {
    console.log('🧪 Vision-DNA 브리지 통합 테스트 시작');
    
    const testText = `
2024-01-15 서울대병원 응급실
환자: 홍길동 (1980-05-15)
주증상: 급성 복통으로 응급실 내원
응급검사: 복부 CT, 혈액검사
진단: 급성 충수염 (K35.9)
수술: 복강경 충수절제술 시행
수술일: 2024-01-16

2024-01-18 퇴원
상태: 양호, 항생제 투약 완료
퇴원약: 진통제 3일분
추적관찰: 1주 후 외래 예약
`;

    try {
      const result = await this.analyzeText(testText);
      console.log('📋 통합 테스트 결과:');
      console.log(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('통합 테스트 실패:', error);
      throw error;
    }
  }
}

// 직접 실행 시 테스트
if (import.meta.url === `file://${process.argv[1]}`) {
  const bridge = new VisionDNABridge();
  bridge.test().catch(console.error);
}