import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 후처리 모듈들 import
import dictionaryManager from '../postprocess/dictionaryManager.js';
import preprocessor from '../postprocess/preprocessor.js';
import dateOrganizer from '../postprocess/dateOrganizer.js';
import reportBuilder from '../postprocess/reportBuilder.js';
import enhancedEntityExtractor from '../postprocess/enhancedEntityExtractor.js';
import aiEntityExtractor from '../postprocess/aiEntityExtractor.js'; // 🤖 AI 기반 추출기

// 🚀 Enhanced Date-Data Anchoring Engine (GPT-5 분석 기반)
import { EnhancedDateAnchor } from '../../src/dna-engine/core/enhancedDateAnchor.js';

// 🔧 통합 Confidence Pipeline (GPT-5 분석 기반)
import UnifiedConfidencePipeline from '../../src/dna-engine/core/confidencePipeline.js';
import RealTimeQualityMonitor from '../../src/dna-engine/core/realTimeQualityMonitor.js';

// OpenAI import
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// OpenAI 클라이언트 lazy initialization
function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
  });
}

/**
 * 🧬 진정한 DNA 시퀀싱 4단계 파이프라인 + AI 검증 시스템
 * 
 * 단계별 처리:
 * 1단계: 원시 데이터 세그멘테이션 (후처리 로직)
 * 2단계: 시간축 데이터 정규화 (후처리 로직)  
 * 3단계: 엔티티 정규화 및 통계 집계 (후처리 로직)
 * 4단계: AI 기반 최종 보고서 합성
 * 
 * Rate Limit 안전장치:
 * - 단계별 지연 시간 설정
 * - 토큰 수 제한 확인
 * - 재시도 로직 구현
 */

class EnhancedDnaValidator {
  constructor() {
    this.rateLimitDelay = 2000; // 2초 대기
    this.maxRetries = 3;
    this.maxTokensPerRequest = 15000; // 안전한 토큰 수
    
    // 🚀 Enhanced Date-Data Anchoring Engine 초기화
    this.dateAnchorEngine = new EnhancedDateAnchor();
    console.log('🔗 Enhanced Date-Data Anchoring Engine 초기화 완료');
    
    // 📊 통합 Confidence Pipeline 초기화
    this.confidencePipeline = new UnifiedConfidencePipeline();
    console.log('📊 통합 Confidence Pipeline 초기화 완료');
    
    // 🔍 실시간 품질 모니터링 시스템 초기화
    this.qualityMonitor = new RealTimeQualityMonitor();
    console.log('🔍 실시간 품질 모니터링 시스템 초기화 완료');
  }

  /**
   * Rate Limit 안전 대기
   */
  async safeDelay() {
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  /**
   * 토큰 수 추정 (대략적)
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // 대략적인 토큰 추정
  }

  /**
   * 1단계: 원시 데이터 세그멘테이션
   */
  async stage1_DataSegmentation(rawText) {
    console.log('🔬 1단계: 원시 데이터 세그멘테이션 시작...');
    
    const sessionId = `session_${Date.now()}`;
    const stageStartTime = Date.now();
    
    // 사전 데이터 로드
    await dictionaryManager.loadData();
    
    // 전처리 실행
    const preprocessOptions = {
      translateTerms: true,
      requireKeywords: true
    };
    
    const segmentedData = await preprocessor.run(rawText, preprocessOptions);
    
    console.log(`✅ 1단계 완료: ${segmentedData.length}개 세그먼트 추출`);
    
    // 🔍 실시간 품질 모니터링 적용
    const stage1Result = {
      stage: 1,
      name: '원시 데이터 세그멘테이션',
      input: rawText.substring(0, 500) + '...',
      output: segmentedData,
      summary: {
        totalSegments: segmentedData.length,
        hospitalsFound: [...new Set(segmentedData.map(d => d.hospital))].length,
        datesFound: segmentedData.filter(d => d.date).length
      }
    };
    
    // 품질 모니터링 실행
    try {
      const qualityMetrics = await this.qualityMonitor.monitorProcessingStage(
        'data_segmentation',
        rawText,
        stage1Result,
        { sessionId }
      );
      stage1Result.qualityMetrics = qualityMetrics;
    } catch (qualityError) {
      console.warn('⚠️ Stage 1 품질 모니터링 실패:', qualityError.message);
    }
    
    return stage1Result;
  }

  /**
   * 2단계: Enhanced Date-Data Anchoring을 활용한 시간축 데이터 정규화
   */
  async stage2_TimelineNormalization(segmentedData, patientInfo = {}) {
    console.log('📅 2단계: Enhanced Date-Data Anchoring 기반 시간축 정규화 시작...');
    
    const sessionId = patientInfo.sessionId || `session_${Date.now()}`;
    const stageStartTime = Date.now();
    
    try {
      // 🔗 Step 1: 전체 텍스트에서 Enhanced Date Anchoring 수행
      const fullText = this.extractFullTextFromSegments(segmentedData);
      console.log(`📝 전체 텍스트 길이: ${fullText.length}자`);
      
      const anchoringContext = {
        referenceDate: patientInfo.insuranceJoinDate ? new Date(patientInfo.insuranceJoinDate) : new Date(),
        patientInfo,
        medicalContext: true
      };
      
      // 🚀 Enhanced Date-Data Anchoring 실행
      const anchoringResult = await this.dateAnchorEngine.dualSweepAnalysis(fullText, anchoringContext);
      
      if (!anchoringResult.success) {
        console.warn('⚠️ Date Anchoring 실패, 기존 방식으로 fallback');
        return await this.fallbackTimelineNormalization(segmentedData, patientInfo);
      }
      
      console.log(`🎯 Date Anchoring 성공: Primary ${anchoringResult.result.primary.length}개, Secondary ${anchoringResult.result.secondary.length}개`);
      
      // 🔗 Step 2: 기존 데이터와 Enhanced Anchoring 결과 통합
      const enhancedNormalizedData = this.integrateAnchoringResults(
        segmentedData, 
        anchoringResult,
        patientInfo
      );
      
      // 🔗 Step 3: 기존 dateOrganizer로 최종 정렬 및 그룹화
      const dateOptions = {
        enrollmentDate: patientInfo.insuranceJoinDate,
        periodType: 'all',
        sortDirection: 'asc',
        groupByDate: true
      };
      
      const finalNormalizedData = dateOrganizer.sortAndFilter(enhancedNormalizedData, dateOptions);
      
      // 기간별 분포 분석
      let periodDistribution = null;
      if (patientInfo.insuranceJoinDate) {
        periodDistribution = dateOrganizer.analyzePeriodDistribution(
          enhancedNormalizedData,
          patientInfo.insuranceJoinDate
        );
      }
      
      console.log(`✅ 2단계 완료: ${finalNormalizedData.length}개 항목 Enhanced Anchoring 적용`);
      
      // 🔍 실시간 품질 모니터링 적용
      const stage2Result = {
        stage: 2,
        name: 'Enhanced Date-Data Anchoring 기반 시간축 정규화',
        input: segmentedData.length + '개 세그먼트',
        output: finalNormalizedData,
        enhancedAnchoring: {
          success: true,
          processingTime: anchoringResult.processingTime,
          primaryAnchors: anchoringResult.result.primary.length,
          secondaryAnchors: anchoringResult.result.secondary.length,
          overallConfidence: anchoringResult.result.confidence,
          conflictsResolved: anchoringResult.analysis.conflictResolution.conflictCount,
          hierarchy: anchoringResult.result.hierarchy
        },
        summary: {
          totalItems: finalNormalizedData.length,
          dateRange: this.getDateRange(finalNormalizedData),
          periodDistribution,
          anchoringQuality: this.assessAnchoringQuality(anchoringResult)
        }
      };
      
      // 품질 모니터링 실행
      try {
        const qualityMetrics = await this.qualityMonitor.monitorProcessingStage(
          'date_resolution',
          segmentedData,
          stage2Result,
          { sessionId, patientInfo }
        );
        stage2Result.qualityMetrics = qualityMetrics;
      } catch (qualityError) {
        console.warn('⚠️ Stage 2 품질 모니터링 실패:', qualityError.message);
      }
      
      return stage2Result;
      
    } catch (error) {
      console.error('❌ Enhanced Date Anchoring 실패:', error);
      console.log('🔄 기존 방식으로 fallback 실행...');
      return await this.fallbackTimelineNormalization(segmentedData, patientInfo);
    }
  }
  
  /**
   * 기존 방식 fallback (Enhanced Anchoring 실패 시)
   */
  async fallbackTimelineNormalization(segmentedData, patientInfo = {}) {
    console.log('🔄 Fallback: 기존 시간축 정규화 방식 사용...');
    
    const dateOptions = {
      enrollmentDate: patientInfo.insuranceJoinDate,
      periodType: 'all',
      sortDirection: 'asc',
      groupByDate: true
    };
    
    const normalizedData = dateOrganizer.sortAndFilter(segmentedData, dateOptions);
    
    let periodDistribution = null;
    if (patientInfo.insuranceJoinDate) {
      periodDistribution = dateOrganizer.analyzePeriodDistribution(
        segmentedData,
        patientInfo.insuranceJoinDate
      );
    }
    
    return {
      stage: 2,
      name: '시간축 데이터 정규화 (Fallback)',
      input: segmentedData.length + '개 세그먼트',
      output: normalizedData,
      enhancedAnchoring: {
        success: false,
        reason: 'fallback_used'
      },
      summary: {
        totalItems: normalizedData.length,
        dateRange: this.getDateRange(normalizedData),
        periodDistribution
      }
    };
  }
  
  /**
   * 세그먼트에서 전체 텍스트 추출
   */
  extractFullTextFromSegments(segmentedData) {
    if (!Array.isArray(segmentedData)) return '';
    
    return segmentedData.map(segment => {
      if (typeof segment === 'string') return segment;
      if (segment.rawText) return segment.rawText;
      if (segment.text) return segment.text;
      if (segment.content) return segment.content;
      return JSON.stringify(segment);
    }).join('\n\n');
  }
  
  /**
   * Enhanced Anchoring 결과와 기존 데이터 통합
   */
  integrateAnchoringResults(segmentedData, anchoringResult, patientInfo) {
    console.log('🔗 Enhanced Anchoring 결과 통합 중...');
    
    const enhancedData = [...segmentedData];
    
    // Primary anchors를 기존 데이터에 매핑
    anchoringResult.result.primary.forEach(anchor => {
      const matchingSegments = this.findMatchingSegments(enhancedData, anchor);
      
      matchingSegments.forEach(segment => {
        // Enhanced date information 추가
        segment.enhancedDate = {
          originalDate: segment.date,
          anchoredDate: anchor.normalized.date,
          confidence: anchor.finalConfidence?.value || anchor.normalized.confidence,
          anchorType: 'primary',
          anchorId: anchor.id,
          evidence: anchor.text,
          medicalContext: anchor.medicalContext
        };
        
        // 더 신뢰도 높은 날짜로 업데이트
        if (anchor.normalized.isValid && anchor.normalized.confidence > 0.8) {
          segment.date = anchor.normalized.date;
        }
      });
    });
    
    // Secondary anchors 정보도 추가 (참고용)
    anchoringResult.result.secondary.forEach(anchor => {
      const matchingSegments = this.findMatchingSegments(enhancedData, anchor);
      
      matchingSegments.forEach(segment => {
        if (!segment.enhancedDate) {
          segment.enhancedDate = {
            originalDate: segment.date,
            anchoredDate: anchor.normalized.date,
            confidence: anchor.finalConfidence?.value || anchor.normalized.confidence,
            anchorType: 'secondary',
            anchorId: anchor.id,
            evidence: anchor.text,
            medicalContext: anchor.medicalContext
          };
        }
      });
    });
    
    console.log(`✅ ${enhancedData.filter(d => d.enhancedDate).length}개 세그먼트에 Enhanced Anchoring 적용`);
    
    return enhancedData;
  }
  
  /**
   * 앵커와 매칭되는 세그먼트 찾기
   */
  findMatchingSegments(segmentedData, anchor) {
    const anchorText = anchor.text.toLowerCase();
    const anchorContext = anchor.context.toLowerCase();
    
    return segmentedData.filter(segment => {
      const segmentText = (segment.rawText || segment.text || segment.content || '').toLowerCase();
      
      // 텍스트 매칭 (부분 문자열 포함)
      if (segmentText.includes(anchorText) || anchorContext.includes(segmentText.substring(0, 50))) {
        return true;
      }
      
      // 날짜 매칭
      if (segment.date && anchor.normalized.date) {
        const segmentDate = new Date(segment.date);
        const anchorDate = new Date(anchor.normalized.date);
        const daysDiff = Math.abs((segmentDate - anchorDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) { // 7일 이내 매칭
          return true;
        }
      }
      
      return false;
    });
  }
  
  /**
   * Anchoring 품질 평가
   */
  assessAnchoringQuality(anchoringResult) {
    const { primary, secondary, confidence } = anchoringResult.result;
    
    let quality = 'good';
    
    if (confidence > 0.9 && primary.length > 0) {
      quality = 'excellent';
    } else if (confidence > 0.7 && primary.length > 0) {
      quality = 'good';
    } else if (confidence > 0.5) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }
    
    return {
      level: quality,
      confidence,
      primaryCount: primary.length,
      secondaryCount: secondary.length,
      processingTime: anchoringResult.processingTime
    };
  }

  /**
   * Stage3: 엔티티 정규화 및 통계 집계 (강화된 버전)
   */
  async runStage3(stage2Result) {
    console.log('  🤖 Stage3: AI 기반 엔티티 추출 및 정규화...');
    
    const startTime = Date.now();
    
    try {
      // Stage2에서 받은 텍스트 데이터 추출
      const textData = this.extractTextFromStage2(stage2Result);
      
      // 🔍 디버깅: 추출된 텍스트를 파일로 저장
      const fs = require('fs');
      const debugDir = 'temp/debug';
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      fs.writeFileSync(`${debugDir}/stage3_input_text.txt`, textData || 'EMPTY_TEXT', 'utf8');
      console.log(`  🔍 Stage3 입력 텍스트 저장: ${debugDir}/stage3_input_text.txt`);
      console.log(`  📊 텍스트 길이: ${textData ? textData.length : 0}자`);
      
      // 🤖 AI 기반 엔티티 추출 실행 (기존 정규식 대체)
      const extractionResult = await aiEntityExtractor.extractAllEntities(textData);
      
      // 🔧 통합 Confidence Pipeline 적용
      console.log('  📊 Confidence Pipeline 적용 중...');
      const confidenceContext = {
        stage: 'entity_extraction',
        documentId: stage2Result.summary?.documentId || 'unknown',
        medicalContext: {
          hasHospitals: extractionResult.hospitals.length > 0,
          hasDiagnoses: extractionResult.diagnoses.length > 0,
          hasTreatments: extractionResult.treatments.length > 0
        }
      };
      
      // 각 엔티티 타입별 신뢰도 계산
      const enhancedResults = {
        hospitals: await this.enhanceEntitiesWithConfidence(extractionResult.hospitals, 'hospital', confidenceContext),
        diagnoses: await this.enhanceEntitiesWithConfidence(extractionResult.diagnoses, 'diagnosis', confidenceContext),
        doctors: await this.enhanceEntitiesWithConfidence(extractionResult.doctors, 'doctor', confidenceContext),
        treatments: await this.enhanceEntitiesWithConfidence(extractionResult.treatments, 'treatment', confidenceContext),
        visits: await this.enhanceEntitiesWithConfidence(extractionResult.visits, 'visit', confidenceContext)
      };
      
      // 전체 신뢰도 통계 계산
      const confidenceStats = this.calculateConfidenceStatistics(enhancedResults);
      
      const processingTime = (Date.now() - startTime) / 1000;
      
      return {
        name: 'AI 기반 엔티티 추출 및 정규화 + Confidence Pipeline',
        success: true,
        processingTime,
        summary: {
          uniqueHospitals: extractionResult.statistics.uniqueHospitals,
          uniqueDiagnoses: extractionResult.statistics.uniqueDiagnoses,
          totalVisits: extractionResult.statistics.totalVisits,
          dateRange: extractionResult.statistics.dateRange,
          extractionMethod: extractionResult.extractionMethod,
          confidenceStats
        },
        data: {
          hospitals: enhancedResults.hospitals,
          diagnoses: enhancedResults.diagnoses,
          doctors: enhancedResults.doctors,
          treatments: enhancedResults.treatments,
          visits: enhancedResults.visits,
          statistics: extractionResult.statistics,
          extractedText: textData.substring(0, 500) + '...' // 미리보기
        }
      };
    } catch (error) {
      console.error('  ❌ Stage3 실패:', error.message);
      return {
        name: '엔티티 정규화 및 통계',
        success: false,
        error: error.message,
        summary: {
          uniqueHospitals: 0,
          uniqueDiagnoses: 0,
          totalVisits: 0
        }
      };
    }
  }

  /**
   * 엔티티에 신뢰도 정보 추가
   */
  async enhanceEntitiesWithConfidence(entities, entityType, context) {
    if (!entities || entities.length === 0) return [];
    
    const enhancedEntities = [];
    
    for (const entity of entities) {
      try {
        // 엔티티별 텍스트 컨텍스트 생성
        const entityText = this.extractEntityText(entity);
        
        // Confidence Pipeline을 통한 신뢰도 계산
        const confidenceResult = await this.confidencePipeline.calculateConfidence(
          entityText,
          {
            ...context,
            entityType,
            entityData: entity
          }
        );
        
        enhancedEntities.push({
          ...entity,
          confidence: confidenceResult
        });
      } catch (error) {
        console.warn(`    ⚠️ ${entityType} 신뢰도 계산 실패:`, error.message);
        enhancedEntities.push({
          ...entity,
          confidence: {
            score: 0.5,
            level: 'medium',
            factors: { error: error.message }
          }
        });
      }
    }
    
    return enhancedEntities;
  }
  
  /**
   * 엔티티에서 텍스트 추출
   */
  extractEntityText(entity) {
    if (typeof entity === 'string') return entity;
    if (entity.name) return entity.name;
    if (entity.text) return entity.text;
    if (entity.value) return entity.value;
    return JSON.stringify(entity);
  }
  
  /**
   * 전체 품질 점수 계산
   */
  calculateOverallQualityScore(results) {
    const scores = [];
    
    // 각 단계별 품질 점수 수집
    Object.values(results).forEach(result => {
      if (result.qualityMetrics && result.qualityMetrics.overallScore) {
        scores.push(result.qualityMetrics.overallScore);
      }
    });
    
    if (scores.length === 0) return 75; // 기본값
    
    // 가중 평균 계산 (최신 단계에 더 높은 가중치)
    const weights = [0.15, 0.25, 0.35, 0.25]; // Stage 1-4 가중치
    let weightedSum = 0;
    let totalWeight = 0;
    
    scores.forEach((score, index) => {
      const weight = weights[index] || 0.25;
      weightedSum += score * weight;
      totalWeight += weight;
    });
    
    return Math.round(weightedSum / totalWeight);
  }
  
  /**
   * 이상 징후 개수 계산
   */
  countAnomalies(results) {
    let totalAnomalies = 0;
    
    Object.values(results).forEach(result => {
      if (result.qualityMetrics && result.qualityMetrics.anomalies) {
        totalAnomalies += result.qualityMetrics.anomalies.length;
      }
    });
    
    return totalAnomalies;
  }
  
  /**
   * 품질 개선 권장사항 생성
   */
  generateQualityRecommendations(results) {
    const recommendations = [];
    
    // Stage별 품질 분석
    Object.entries(results).forEach(([stageName, result]) => {
      if (result.qualityMetrics) {
        const metrics = result.qualityMetrics;
        
        if (metrics.overallScore < 70) {
          recommendations.push(`${stageName}: 품질 점수가 낮습니다 (${metrics.overallScore}/100). 데이터 검증이 필요합니다.`);
        }
        
        if (metrics.anomalies && metrics.anomalies.length > 0) {
          recommendations.push(`${stageName}: ${metrics.anomalies.length}개의 이상 징후가 발견되었습니다.`);
        }
        
        if (metrics.processingTime > 10) {
          recommendations.push(`${stageName}: 처리 시간이 길어졌습니다 (${metrics.processingTime}초). 성능 최적화가 필요합니다.`);
        }
      }
    });
    
    if (recommendations.length === 0) {
      recommendations.push('모든 단계가 정상적으로 처리되었습니다.');
    }
    
    return recommendations;
  }
  
  /**
   * 전체 신뢰도 통계 계산
   */
  calculateConfidenceStatistics(enhancedResults) {
    const allEntities = [
      ...enhancedResults.hospitals,
      ...enhancedResults.diagnoses,
      ...enhancedResults.doctors,
      ...enhancedResults.treatments,
      ...enhancedResults.visits
    ];
    
    if (allEntities.length === 0) {
      return {
        averageScore: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
        totalEntities: 0
      };
    }
    
    const scores = allEntities.map(entity => entity.confidence?.score || 0);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    const confidenceLevels = allEntities.map(entity => entity.confidence?.level || 'low');
    const highConfidenceCount = confidenceLevels.filter(level => level === 'high').length;
    const mediumConfidenceCount = confidenceLevels.filter(level => level === 'medium').length;
    const lowConfidenceCount = confidenceLevels.filter(level => level === 'low').length;
    
    return {
      averageScore: Math.round(averageScore * 100) / 100,
      highConfidenceCount,
      mediumConfidenceCount,
      lowConfidenceCount,
      totalEntities: allEntities.length
    };
  }

  /**
   * Stage2 결과에서 텍스트 데이터 추출
   */
  extractTextFromStage2(stage2Result) {
    console.log('    🔍 Stage2 데이터 구조 분석:', {
      hasOutput: !!stage2Result.output,
      outputType: typeof stage2Result.output,
      outputLength: Array.isArray(stage2Result.output) ? stage2Result.output.length : 'not array'
    });

    // Stage2의 실제 구조: { output: [ {date, hospitals, items: [{rawText, hospital, date}]} ] }
    if (stage2Result.output && Array.isArray(stage2Result.output)) {
      const allTextParts = [];
      let totalHospitals = new Set();
      let totalItems = 0;
      
      stage2Result.output.forEach((dateGroup, index) => {
        console.log(`    📅 처리 중: ${dateGroup.date} (${dateGroup.hospitals?.length || 0}개 병원)`);
        
        // 각 날짜 그룹의 병원들 수집
        if (dateGroup.hospitals) {
          dateGroup.hospitals.forEach(h => totalHospitals.add(h));
        }
        
        // 각 날짜 그룹의 아이템들에서 텍스트 추출
        if (dateGroup.items && Array.isArray(dateGroup.items)) {
          dateGroup.items.forEach(item => {
            if (item.rawText) {
              // 날짜와 병원 정보를 포함한 컨텍스트 생성
              const contextualText = `
[날짜: ${item.date || dateGroup.date}]
[병원: ${item.hospital || '미상'}]
${item.rawText}
---`;
              allTextParts.push(contextualText);
              totalItems++;
            }
          });
        }
      });
      
      const combinedText = allTextParts.join('\n');
      
      console.log('    ✅ Stage2에서 텍스트 추출 완료:');
      console.log(`       - 총 텍스트 길이: ${combinedText.length}자`);
      console.log(`       - 고유 병원 수: ${totalHospitals.size}개`);
      console.log(`       - 총 아이템 수: ${totalItems}개`);
      console.log(`       - 병원 목록: ${Array.from(totalHospitals).slice(0, 3).join(', ')}${totalHospitals.size > 3 ? '...' : ''}`);
      
      return combinedText;
    }
    
    // Fallback 로직들...
    if (stage2Result.data && typeof stage2Result.data === 'string') {
      console.log('    🔄 Fallback: stage2Result.data 사용');
      return stage2Result.data;
    }
    
    if (stage2Result.data && Array.isArray(stage2Result.data)) {
      console.log('    🔄 Fallback: stage2Result.data 배열 처리');
      return stage2Result.data.map(item => {
        if (typeof item === 'string') return item;
        if (item.text) return item.text;
        if (item.rawText) return item.rawText;
        return JSON.stringify(item);
      }).join('\n');
    }
    
    // 최후의 수단
    console.warn('    ⚠️ Stage2 데이터 추출 실패, 전체 객체 문자열화 사용');
    return JSON.stringify(stage2Result, null, 2);
  }

  /**
   * 객체에서 재귀적으로 텍스트 추출
   */
  extractTextFromObject(obj, textFields) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > 10) {
        // 의미있는 길이의 문자열만 추출
        textFields.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string' && item.length > 10) {
            textFields.push(item);
          } else if (typeof item === 'object' && item !== null) {
            this.extractTextFromObject(item, textFields);
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        this.extractTextFromObject(value, textFields);
      }
    }
  }

  /**
   * Stage4: AI 기반 최종 보고서 합성 (강화된 데이터 활용)
   */
  async stage4_AIReportSynthesis(stage3Data, patientInfo) {
    console.log('  🤖 Stage4: AI 기반 최종 보고서 합성...');
    
    const sessionId = patientInfo?.sessionId || `session_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      // 강화된 엔티티 데이터를 AI 프롬프트에 최적화된 형태로 변환
      const structuredData = this.prepareDataForAI(stage3Data);
      
      const systemPrompt = `당신은 의료 보험 심사 전문가입니다. 추출된 의료 데이터를 바탕으로 정확하고 체계적인 보고서를 작성해주세요.

## 📋 작성 지침
1. 추출된 데이터를 바탕으로 객관적 사실만 기술
2. 시간순으로 의료 이벤트 정리
3. 보험 가입일 기준으로 사전/사후 구분
4. 병원별 방문 통계 포함

## 📊 보고서 형식
### 1. 환자 기본정보
- 이름: [추출된 환자명 또는 "추출 불가"]
- 주요 진료 병원: [병원 목록]

### 2. 보험 조건들
- 보험 가입일: ${patientInfo?.insuranceJoinDate || '정보 없음'}
- 주요 진단명: [추출된 진단명들]

### 3. 시간축 의료 이벤트
[날짜순으로 정리된 의료 이벤트]

### 4. 병원별 방문 통계
[병원별 방문 횟수 및 주요 진료 내용]

### 5. 보험 심사 관련 소견
[보험 가입 전후 의료 이벤트 분석]`;

      const userPrompt = `다음은 의료 기록에서 추출된 구조화된 데이터입니다:

## 🏥 병원 정보
${structuredData.hospitals.length > 0 ? 
  structuredData.hospitals.map((h, i) => `${i+1}. ${h}`).join('\n') : 
  '- 병원 정보 추출되지 않음'}

## 🩺 진단명 정보
${structuredData.diagnoses.length > 0 ? 
  structuredData.diagnoses.map((d, i) => `${i+1}. ${d}`).join('\n') : 
  '- 진단명 정보 추출되지 않음'}

## 👨‍⚕️ 의료진 정보
${structuredData.doctors.length > 0 ? 
  structuredData.doctors.map((d, i) => `${i+1}. ${d}`).join('\n') : 
  '- 의료진 정보 추출되지 않음'}

## 💊 치료 정보
${structuredData.treatments.length > 0 ? 
  structuredData.treatments.slice(0, 10).map((t, i) => `${i+1}. ${t}`).join('\n') : 
  '- 치료 정보 추출되지 않음'}

## 📅 진료 날짜
${structuredData.dates.length > 0 ? 
  structuredData.dates.slice(0, 20).join(', ') : 
  '- 진료 날짜 추출되지 않음'}

## 📊 방문 통계
- 총 방문 횟수: ${structuredData.visitInfo.totalVisits}회
- 의료 복잡도: ${structuredData.complexity}점

위 데이터를 바탕으로 체계적인 의료 보고서를 작성해주세요.`;

      // OpenAI API 호출
      const response = await getOpenAIClient().chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.maxTokensPerRequest,
        temperature: 0.3
      });

      const reportText = response.choices[0]?.message?.content || '보고서 생성 실패';
      const tokensUsed = response.usage?.total_tokens || 0;
      const processingTime = (Date.now() - startTime) / 1000;

      // 🔍 실시간 품질 모니터링 적용
      const stage4Result = {
        name: 'AI 보고서 합성',
        success: true,
        processingTime,
        summary: {
          reportLength: reportText.length,
          tokensUsed,
          dataQuality: this.assessDataQuality(structuredData)
        },
        data: reportText
      };
      
      // 품질 모니터링 실행
      try {
        const qualityMetrics = await this.qualityMonitor.monitorProcessingStage(
          'report_synthesis',
          structuredData,
          stage4Result,
          { sessionId, patientInfo }
        );
        stage4Result.qualityMetrics = qualityMetrics;
      } catch (qualityError) {
        console.warn('⚠️ Stage 4 품질 모니터링 실패:', qualityError.message);
      }
      
      return stage4Result;
    } catch (error) {
      console.error('  ❌ Stage4 실패:', error.message);
      return {
        name: 'AI 보고서 합성',
        success: false,
        error: error.message,
        summary: {
          reportLength: 0,
          tokensUsed: 0
        }
      };
    }
  }

  /**
   * Stage3 데이터를 AI에 최적화된 형태로 변환
   */
  prepareDataForAI(stage3Data) {
    if (!stage3Data || !stage3Data.entities) {
      return {
        hospitals: [],
        diagnoses: [],
        doctors: [],
        treatments: [],
        dates: [],
        visitInfo: { totalVisits: 0 },
        complexity: 0
      };
    }

    const entities = stage3Data.entities;
    const statistics = stage3Data.statistics || {};

    return {
      hospitals: entities.hospitals || [],
      diagnoses: entities.diagnoses || [],
      doctors: entities.doctors || [],
      treatments: entities.treatments || [],
      dates: entities.dates || [],
      visitInfo: entities.visits || { totalVisits: 0 },
      complexity: statistics.medicalComplexity || 0
    };
  }

  /**
   * 데이터 품질 평가
   */
  assessDataQuality(structuredData) {
    let qualityScore = 0;
    
    if (structuredData.hospitals.length > 0) qualityScore += 25;
    if (structuredData.diagnoses.length > 0) qualityScore += 30;
    if (structuredData.dates.length > 0) qualityScore += 20;
    if (structuredData.visitInfo.totalVisits > 0) qualityScore += 15;
    if (structuredData.treatments.length > 0) qualityScore += 10;
    
    return qualityScore;
  }

  /**
   * Rate Limit 안전 AI 호출
   */
  async callAIWithRateLimit(structuredInput) {
    const systemPrompt = `당신은 의료문서 전문 분석가입니다. 
구조화된 의료 데이터를 받아 보험 손해사정용 시간축 경과표를 작성하세요.

반드시 다음 형식을 따르세요:
### 1. 환자 기본정보
### 2. 보험 조건들 (각 보험사별로 구분)  
### 3. 보험 가입 시점 표시
### 4. 시간축 의료 이벤트 (날짜순 정렬)

특히 중요한 점:
- 병원별 통원 통계는 "YYYY.MM.DD ~ YYYY.MM.DD / X회 통원" 형식으로 표시
- 보험 가입 전후 구분하여 고지의무 위반 우려 명시
- 모든 날짜는 시간순으로 정렬`;

    const userPrompt = `다음 구조화된 의료 데이터를 분석하여 보고서를 작성하세요:

${JSON.stringify(structuredInput, null, 2)}`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    return response.choices[0].message.content;
  }

  /**
   * AI용 구조화된 입력 데이터 준비
   */
  prepareAIInput(hospitalStats, diagnosisStats, insuranceInfo, patientInfo) {
    return {
      patientInfo: {
        name: patientInfo.name || '환자명 미상',
        birthDate: patientInfo.birthDate || '생년월일 미상',
        insuranceJoinDate: patientInfo.insuranceJoinDate
      },
      hospitalStatistics: hospitalStats.map(h => ({
        hospital: h.hospital,
        visitCount: h.visitCount,
        firstVisit: h.firstVisit,
        lastVisit: h.lastVisit,
        period: `${h.firstVisit} ~ ${h.lastVisit} / ${h.visitCount}회 통원`
      })),
      diagnosisStatistics: diagnosisStats,
      insuranceInfo: insuranceInfo,
      summary: {
        totalHospitals: hospitalStats.length,
        totalVisits: hospitalStats.reduce((sum, h) => sum + h.visitCount, 0),
        dateRange: this.getDateRange(hospitalStats.flatMap(h => [h.firstVisit, h.lastVisit]))
      }
    };
  }

  /**
   * 병원별 방문 통계 계산
   */
  calculateHospitalStatistics(normalizedData) {
    const hospitalMap = new Map();
    
    normalizedData.forEach(item => {
      if (!item.hospital || !item.date) return;
      
      const hospital = item.hospital;
      if (!hospitalMap.has(hospital)) {
        hospitalMap.set(hospital, {
          hospital,
          visits: [],
          diagnoses: new Set()
        });
      }
      
      const hospitalData = hospitalMap.get(hospital);
      hospitalData.visits.push(item.date);
      
      // 진단명 추출 (키워드 매치에서)
      if (item.keywordMatches) {
        item.keywordMatches.forEach(match => {
          if (match.includes('진단') || match.includes('병명')) {
            hospitalData.diagnoses.add(match);
          }
        });
      }
    });
    
    return Array.from(hospitalMap.values()).map(data => ({
      hospital: data.hospital,
      visitCount: data.visits.length,
      firstVisit: data.visits.sort()[0],
      lastVisit: data.visits.sort()[data.visits.length - 1],
      diagnoses: Array.from(data.diagnoses)
    }));
  }

  /**
   * 진단명 통계 계산
   */
  calculateDiagnosisStatistics(normalizedData) {
    const diagnosisMap = new Map();
    
    normalizedData.forEach(item => {
      if (item.keywordMatches) {
        item.keywordMatches.forEach(match => {
          if (match.includes('진단') || match.includes('병명') || match.includes('증상')) {
            const key = match.toLowerCase();
            diagnosisMap.set(key, (diagnosisMap.get(key) || 0) + 1);
          }
        });
      }
    });
    
    return Array.from(diagnosisMap.entries()).map(([diagnosis, count]) => ({
      diagnosis,
      count
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * 보험사 정보 추출
   */
  extractInsuranceInfo(normalizedData) {
    const insurers = new Set();
    
    normalizedData.forEach(item => {
      if (item.keywordMatches) {
        item.keywordMatches.forEach(match => {
          if (match.includes('보험') || match.includes('화재') || match.includes('생명')) {
            insurers.add(match);
          }
        });
      }
    });
    
    return Array.from(insurers);
  }

  /**
   * 날짜 범위 계산
   */
  getDateRange(data) {
    const dates = data
      .map(item => item.date || item)
      .filter(date => date)
      .sort();
    
    if (dates.length === 0) return null;
    
    return {
      start: dates[0],
      end: dates[dates.length - 1],
      span: dates.length
    };
  }
}

// 라우터 인스턴스
const validator = new EnhancedDnaValidator();

/**
 * 🧬 4단계 DNA 파이프라인 + AI 검증 API
 * POST /api/enhanced-dna-validation/analyze
 */
router.post('/analyze', async (req, res) => {
  try {
    const { extractedText, patientInfo = {} } = req.body;
    
    if (!extractedText) {
      return res.status(400).json({
        success: false,
        error: '분석할 텍스트가 제공되지 않았습니다'
      });
    }
    
    console.log('🚀 4단계 DNA 파이프라인 + AI 검증 시작...');
    const startTime = Date.now();
    
    const results = {};
    
    // 1단계: 원시 데이터 세그멘테이션
    results.stage1 = await validator.stage1_DataSegmentation(extractedText);
    
    // 2단계: 시간축 데이터 정규화
    results.stage2 = await validator.stage2_TimelineNormalization(
      results.stage1.output, 
      patientInfo
    );
    
    // 3단계: 엔티티 정규화 및 통계 집계
    results.stage3 = await validator.runStage3(results.stage2);
    
    // 4단계: AI 기반 최종 보고서 합성
    results.stage4 = await validator.stage4_AIReportSynthesis(
      results.stage3.data,
      patientInfo
    );
    
    const processingTime = (Date.now() - startTime) / 1000;
    
    // 🔍 전체 파이프라인 품질 모니터링 결과 집계
    const qualityOverview = {
      stage1: results.stage1.qualityMetrics || null,
      stage2: results.stage2.qualityMetrics || null,
      stage3: results.stage3.qualityMetrics || null,
      stage4: results.stage4.qualityMetrics || null,
      overallScore: this.calculateOverallQualityScore(results),
      anomaliesDetected: this.countAnomalies(results),
      recommendations: this.generateQualityRecommendations(results)
    };
    
    console.log(`🏁 4단계 파이프라인 완료 (${processingTime}초)`);
    console.log(`📊 전체 품질 점수: ${qualityOverview.overallScore}/100`);
    
    res.json({
      success: true,
      processingTime,
      pipelineResults: results,
      finalReport: results.stage4.data,
      qualityMonitoring: qualityOverview,
      summary: {
        stage1: results.stage1.summary,
        stage2: results.stage2.summary, 
        stage3: results.stage3.summary,
        stage4: results.stage4.summary
      }
    });
    
  } catch (error) {
    console.error('4단계 파이프라인 실패:', error);
    
    // Rate Limit 에러 특별 처리
    if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
      res.status(429).json({
        success: false,
        error: 'API Rate Limit 초과. 잠시 후 다시 시도해주세요.',
        retryAfter: 60
      });
    } else {
      res.status(500).json({
        success: false,
        error: `파이프라인 실패: ${error.message}`
      });
    }
  }
});

/**
 * 케이스 샘플 기반 자동 검증 API
 * POST /api/enhanced-dna-validation/validate-case
 */
router.post('/validate-case', async (req, res) => {
  try {
    const { caseNumber, insuranceJoinDate } = req.body;
    
    if (!caseNumber) {
      return res.status(400).json({
        success: false,
        error: '케이스 번호가 제공되지 않았습니다'
      });
    }
    
    // 케이스 파일 읽기
    const casePath = path.join(__dirname, '../src/rag/case_sample', `${caseNumber}.txt`);
    const reportPath = path.join(__dirname, '../src/rag/case_sample', `${caseNumber}_report.txt`);
    
    if (!fs.existsSync(casePath)) {
      return res.status(404).json({
        success: false,
        error: `케이스 파일을 찾을 수 없습니다: ${caseNumber}.txt`
      });
    }
    
    const caseContent = fs.readFileSync(casePath, 'utf8');
    let expectedReport = null;
    
    if (fs.existsSync(reportPath)) {
      expectedReport = fs.readFileSync(reportPath, 'utf8');
    }
    
    // 4단계 파이프라인 실행
    const pipelineResult = await fetch(`${req.protocol}://${req.get('host')}/api/enhanced-dna-validation/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedText: caseContent,
        patientInfo: { insuranceJoinDate }
      })
    });
    
    const pipelineData = await pipelineResult.json();
    
    if (!pipelineData.success) {
      throw new Error(pipelineData.error);
    }
    
    // 결과 비교 (expectedReport가 있는 경우)
    let comparison = null;
    if (expectedReport) {
      comparison = {
        hasExpectedReport: true,
        aiReportLength: pipelineData.finalReport?.length || 0,
        expectedReportLength: expectedReport.length,
        // 추가 비교 로직은 여기에 구현
      };
    }
    
    res.json({
      success: true,
      caseNumber,
      pipelineResults: pipelineData.pipelineResults,
      finalReport: pipelineData.finalReport,
      expectedReport: expectedReport?.substring(0, 1000) + '...' || null,
      comparison,
      processingTime: pipelineData.processingTime
    });
    
  } catch (error) {
    console.error('케이스 검증 실패:', error);
    res.status(500).json({
      success: false,
      error: `케이스 검증 실패: ${error.message}`
    });
  }
});

export default router;