/**
 * Post-Processing Module Entry Point
 * 
 * 역할:
 * 1. OCR 결과 후처리 통합 관리
 * 2. 거대 날짜 블록 처리 로직 통합
 * 3. 메인 앱과 개발자 스튜디오 연동 지원
 * 4. 엔드-투-엔드 파이프라인 구축
 */

import EnhancedMassiveDateBlockProcessor from './enhancedMassiveDateBlockProcessor.js';
import DateOrganizer from './dateOrganizer.js';
import preprocessor from './preprocessor.js';
import reportBuilder from './reportBuilder.js';
import EnhancedEntityExtractor from './enhancedEntityExtractor.js';
import medicalEventModel from './medicalEventModel.js';
import { MedicalEventSchema } from '../../src/modules/reports/types/structuredOutput.js';
import fs from 'fs';
import ReportSubsetValidator from '../eval/report_subset_validator.js';

// Phase 2 모듈 (T04, T05, T08, T09)
import eventScoringEngine from './eventScoringEngine.js';
import criticalRiskEngine from './criticalRiskRules.js';
import disclosureReportBuilder from './disclosureReportBuilder.js';
import safeModeGuard from './safeModeGuard.js';

// Phase 3 — 통합 보고서
import { UnifiedReportBuilder } from './unifiedReportBuilder.js';

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function computeSectionRatios(blocks, top = 0.05, bottom = 0.95) {
  const byPage = new Map();
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const page = Number(b?.page);
    const bb = b?.bbox || {};
    if (!Number.isFinite(page) || page <= 0) continue;
    const cur = byPage.get(page) || { page, widthMax: 0, heightMax: 0, blocks: [] };
    const xMax = Number(bb?.xMax);
    const yMax = Number(bb?.yMax);
    if (Number.isFinite(xMax) && xMax > cur.widthMax) cur.widthMax = xMax;
    if (Number.isFinite(yMax) && yMax > cur.heightMax) cur.heightMax = yMax;
    cur.blocks.push(b);
    byPage.set(page, cur);
  }
  const pages = [...byPage.values()].sort((a, b) => a.page - b.page);
  const normalized = [];
  for (const p of pages) {
    const w = p.widthMax > 0 ? p.widthMax : 1;
    const h = p.heightMax > 0 ? p.heightMax : 1;
    for (const b of p.blocks) {
      const bb = b?.bbox || {};
      const nxMin = clamp01(bb.xMin / w);
      const nyMin = clamp01(bb.yMin / h);
      const nxMax = clamp01(bb.xMax / w);
      const nyMax = clamp01(bb.yMax / h);
      normalized.push({
        page: Number(b.page),
        blockIndex: Number(b.blockIndex),
        bboxNorm: { xMin: nxMin, yMin: nyMin, xMax: nxMax, yMax: nyMax }
      });
    }
  }
  const total = normalized.length;
  let headerCount = 0;
  let footerCount = 0;
  for (const n of normalized) {
    if (Number.isFinite(n?.bboxNorm?.yMin) && n.bboxNorm.yMin < top) headerCount += 1;
    if (Number.isFinite(n?.bboxNorm?.yMax) && n.bboxNorm.yMax > bottom) footerCount += 1;
  }
  const headerRatio = total > 0 ? headerCount / total : 0;
  const footerRatio = total > 0 ? footerCount / total : 0;
  return { headerCount, footerCount, headerRatio, footerRatio, total };
}

class PostProcessingManager {
  constructor() {
    this.enhancedMassiveDateProcessor = new EnhancedMassiveDateBlockProcessor();
    this.dateOrganizer = new DateOrganizer();
    this.preprocessor = preprocessor;
    this.reportBuilder = reportBuilder;
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
        requireKeywords: options.requireKeywords || false,
        // enableTemplateCache: false → 다중 PDF 혼합 텍스트에서 과도한 노이즈 제거 방지
        enableTemplateCache: options.enableTemplateCache !== undefined
          ? options.enableTemplateCache
          : true
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
        groupByDate: options.groupByDate || false,
        excludeNoise: options.excludeNoise !== false
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
      const requestedFormat = options.reportFormat || 'json';
      const normalizedFormat = requestedFormat === 'txt' ? 'text' : requestedFormat;

      const rawEvents = medicalEventModel.buildEvents({
        dateBlocks: combinedData,
        entities: aiExtractedData || {},
        rawText: ocrText,
        patientInfo: options.patientInfo || {},
        coordinateBlocks: Array.isArray(options.coordinateBlocks) ? options.coordinateBlocks : []
      });
      const medicalEvents = [];
      for (const evt of rawEvents) {
        const transformed = {
          id: evt.id,
          date: evt.date,
          hospital: evt.hospital,
          eventType: evt.eventType || '진료',
          description: evt.shortFact || '',
          diagnosis:
            evt.diagnosis && (typeof evt.diagnosis.name === 'string' || typeof evt.diagnosis.code === 'string')
              ? {
                  name: typeof evt.diagnosis.name === 'string' ? evt.diagnosis.name : undefined,
                  code: typeof evt.diagnosis.code === 'string' ? evt.diagnosis.code : undefined
                }
              : undefined,
          procedures: Array.isArray(evt.procedures)
            ? evt.procedures
                .map(p =>
                  typeof p === 'string'
                    ? { name: p }
                    : {
                        name: typeof p.name === 'string' ? p.name : undefined,
                        code: typeof p.code === 'string' ? p.code : undefined
                      }
                )
                .filter(x => typeof x.name === 'string' && x.name.length > 0)
            : undefined,
          medications: Array.isArray(evt.treatments)
            ? evt.treatments
                .map(t =>
                  typeof t === 'string'
                    ? { name: t }
                    : {
                        name: typeof t.name === 'string' ? t.name : undefined,
                        dose: typeof t.dose === 'string' ? t.dose : undefined
                      }
                )
                .filter(x => typeof x.name === 'string' && x.name.length > 0)
            : undefined,
          anchors: evt.sourceSpan
            ? (() => {
                const b = evt.sourceSpan.bounds || {};
                const pos = {};
                if (Number.isFinite(evt.sourceSpan.page)) pos.page = evt.sourceSpan.page;
                if (Number.isFinite(b.xMin)) pos.xMin = b.xMin;
                if (Number.isFinite(b.yMin)) pos.yMin = b.yMin;
                if (Number.isFinite(b.xMax)) pos.xMax = b.xMax;
                if (Number.isFinite(b.yMax)) pos.yMax = b.yMax;
                const hasPos = Object.keys(pos).length > 0;
                return {
                  position: hasPos ? pos : undefined,
                  sourceSpan:
                    evt.sourceSpan.blockIndex !== undefined ? { blockIndex: evt.sourceSpan.blockIndex } : undefined,
                  confidence: typeof evt.sourceSpan.confidence === 'number' ? evt.sourceSpan.confidence : undefined
                };
              })()
            : undefined,
          confidence: typeof evt.confidence === 'number' ? Math.max(0, Math.min(1, evt.confidence)) : 0.8,
          tags: evt.tags,
          payload: evt.payload
        };
        const parsed = MedicalEventSchema.safeParse(transformed);
        if (parsed.success) {
          medicalEvents.push(parsed.data);
        }
      }
      const unifiedMedicalEvents = medicalEventModel.unifyDuplicateEvents(medicalEvents);

      const finalReport = await this.reportBuilder.buildReport(
        organizedData,
        options.patientInfo || {},
        {
          format: normalizedFormat,
          includeRawText: options.includeRawText || false,
          title: options.reportTitle || options.title
        }
      );
      let reportText = '';
      try {
        if (finalReport?.results?.text?.filePath && fs.existsSync(finalReport.results.text.filePath)) {
          reportText = fs.readFileSync(finalReport.results.text.filePath, 'utf-8');
        } else if (finalReport?.results?.json?.data?.items) {
          reportText = finalReport.results.json.data.items.map(i => `${i.date} | ${i.hospital} | ${i.content || ''}`).join('\n');
        }
      } catch {}
      const vnexsusText = unifiedMedicalEvents.map(e => {
        const code = e?.diagnosis?.code ? ` ${e.diagnosis.code}` : '';
        return `${e.date || ''} ${e.hospital || ''}${code} ${e.description || ''}`;
      }).join('\n');

      // Phase 2: 안전모드 검증 (T09)
      let safeModeResult = null;
      try {
        safeModeResult = safeModeGuard.validateAndGuard(unifiedMedicalEvents);
        if (safeModeResult.safeModeActive) {
          console.log(`🛡️ 안전모드 활성화: ${safeModeResult.safeModeReason}`);
        }
      } catch (safeModeErr) {
        console.warn(`⚠️ 안전모드 검증 실패: ${safeModeErr.message}`);
      }

      // Phase 2: 고지의무 분석 보고서 생성 (T08)
      let disclosureReport = null;
      try {
        disclosureReport = disclosureReportBuilder.buildReport(
          unifiedMedicalEvents,
          options.patientInfo || {},
          { format: options.reportFormat }
        );
        console.log(`📋 고지의무 보고서 생성 완료: Core ${disclosureReport.metadata.coreEvents}건, Critical ${disclosureReport.metadata.criticalEvents}건`);
      } catch (disclosureErr) {
        console.warn(`⚠️ 고지의무 보고서 생성 실패: ${disclosureErr.message}`);
      }

      // Phase 3: 통합 보고서 생성 (UnifiedReportBuilder)
      let unifiedReport = null;
      try {
        const unifiedBuilder = new UnifiedReportBuilder(
          { pipeline: { medicalEvents: unifiedMedicalEvents, disclosureReport } },
          options.patientInfo || {}
        );
        unifiedReport = unifiedBuilder.buildReport();
        console.log(`📄 통합 보고서 생성 완료: 3M ${unifiedReport.metadata.within3M}건, 5Y ${unifiedReport.metadata.within5Y}건`);
      } catch (unifiedErr) {
        console.warn(`⚠️ 통합 보고서 생성 실패: ${unifiedErr.message}`);
      }

      let subsetValidation = null;
      try {
        const validator = new ReportSubsetValidator();
        const res = validator.validateCase('inline', reportText, vnexsusText);
        subsetValidation = {
          dateMatchRate: res.matching?.dates?.matchRate || 0,
          icdMatchRate: res.matching?.icds?.matchRate || 0,
          hospitalMatchRate: res.matching?.hospitals?.matchRate || 0,
          missing: {
            dates: res.matching?.dates?.missing || [],
            icds: res.matching?.icds?.missing || [],
            hospitals: res.matching?.hospitals?.missing || []
          }
        };
      } catch {}
      let coordinateSections = null;
      if (Array.isArray(options.coordinateBlocks) && options.coordinateBlocks.length > 0) {
        try {
          coordinateSections = computeSectionRatios(options.coordinateBlocks);
        } catch {}
      }
      
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
          medicalEvents: unifiedMedicalEvents,
          finalReport,
          reportSubsetValidation: subsetValidation,
          coordinateSections,
          // Phase 2 결과
          disclosureReport,
          safeModeResult,
          // Phase 3 결과
          unifiedReport,
        },
        statistics: {
          originalTextLength: ocrText.length,
          processedGroups: massiveDateResult.structuredGroups.length,
          dateBlocks: massiveDateResult.dateBlocks.length,
          confidence: massiveDateResult.statistics.averageConfidence,
          filteringRate: massiveDateResult.statistics.filteringRate,
          // Phase 2 통계
          coreEvents: disclosureReport?.metadata?.coreEvents || 0,
          criticalEvents: disclosureReport?.metadata?.criticalEvents || 0,
          safeModeActive: safeModeResult?.safeModeActive || false,
        },
        metadata: {
          version: '7.3',
          timestamp: new Date().toISOString(),
          processingMode: options.useAIExtraction ? 'AI_ENHANCED' : 'RULE_BASED',
          pipelineSteps: 5,
          phase2Enabled: true,
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

      // Enhanced 거대 날짜 블록 분석 정보
      const enhancedDateResult = await this.enhancedMassiveDateProcessor.processEnhancedDateBlocks(ocrText, {
        includeAll: true,
        minConfidence: 0.1
      });

      // 기존 형식과 호환성을 위한 변환
      const massiveDateAnalysis = {
        dateBlocks: enhancedDateResult.blocks || [],
        structuredGroups: enhancedDateResult.timeline?.dateGroups || [],
        processedSize: enhancedDateResult.processedSize || 0,
        statistics: {
          averageConfidence: enhancedDateResult.qualityMetrics?.avgConfidence || 0,
          filteringRate: enhancedDateResult.qualityMetrics?.completeness ?
            (1 - enhancedDateResult.qualityMetrics.completeness) * 100 : 0
        }
      };
      
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
