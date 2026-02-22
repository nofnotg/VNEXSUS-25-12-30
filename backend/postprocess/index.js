/**
 * Post-Processing Pipeline Entry Point  v8.0
 *
 * 파이프라인 흐름:
 *   OCR 텍스트
 *     → [1] preprocessor          : 날짜·병원명·키워드 파싱, 보일러플레이트 제거
 *     → [2] medicalEventModel     : 이벤트 객체 생성 + 중복 병합
 *     → [3] safeModeGuard         : 저신뢰도 이벤트 보호 검증
 *     → [4] disclosureReportBuilder : 고지의무 분류 분석
 *     → [5] UnifiedReportBuilder  : 최종 통합 보고서 생성
 */

import preprocessor        from './preprocessor.js';
import medicalEventModel   from './medicalEventModel.js';
import { MedicalEventSchema } from '../../src/modules/reports/types/structuredOutput.js';
import safeModeGuard       from './safeModeGuard.js';
import disclosureReportBuilder from './disclosureReportBuilder.js';
import { UnifiedReportBuilder } from './unifiedReportBuilder.js';
import ReportSubsetValidator from '../eval/report_subset_validator.js';

class PostProcessingManager {
  constructor() {
    this.preprocessor    = preprocessor;
    this.processingStats = {
      totalProcessed: 0,
      successfulProcessing: 0,
      averageProcessingTime: 0,
      lastProcessingTime: null
    };
  }

  /**
   * 메인 후처리 파이프라인
   * @param {string} ocrText  OCR 추출 텍스트
   * @param {Object} options  처리 옵션
   * @returns {Promise<Object>}
   */
  async processOCRResult(ocrText, options = {}) {
    const startTime = Date.now();

    try {
      // ── 1단계: 날짜·병원명 파싱 및 보일러플레이트 제거 ─────────────────
      const dateBlocks = await this.preprocessor.run(ocrText, {
        translateTerms:    options.translateTerms    ?? false,
        requireKeywords:   options.requireKeywords   ?? false,
        enableTemplateCache: options.enableTemplateCache ?? true,
      });

      // ── 2단계: 이벤트 객체 생성 ──────────────────────────────────────────
      const rawEvents = medicalEventModel.buildEvents({
        dateBlocks,
        entities:    {},
        rawText:     ocrText,
        patientInfo: options.patientInfo || {},
        coordinateBlocks: Array.isArray(options.coordinateBlocks)
          ? options.coordinateBlocks : [],
      });

      // Zod 스키마 검증 (필드 정규화)
      const medicalEvents = [];
      for (const evt of rawEvents) {
        const transformed = {
          id:        evt.id,
          date:      evt.date,
          hospital:  evt.hospital,
          eventType: evt.eventType || '진료',
          description: evt.shortFact || evt.rawText || '',
          // rawText 보존 — unifiedReportBuilder._enrichFromRawText() 에서 사용
          rawText: typeof evt.rawText === 'string' ? evt.rawText : undefined,
          diagnosis: evt.diagnosis &&
            (typeof evt.diagnosis.name === 'string' || typeof evt.diagnosis.code === 'string')
              ? {
                  name: typeof evt.diagnosis.name === 'string' ? evt.diagnosis.name : undefined,
                  code: typeof evt.diagnosis.code === 'string' ? evt.diagnosis.code : undefined,
                }
              : undefined,
          procedures: Array.isArray(evt.procedures)
            ? evt.procedures
                .map(p => typeof p === 'string' ? { name: p }
                  : { name: typeof p.name === 'string' ? p.name : undefined,
                      code: typeof p.code === 'string' ? p.code : undefined })
                .filter(x => typeof x.name === 'string' && x.name.length > 0)
            : undefined,
          medications: Array.isArray(evt.treatments)
            ? evt.treatments
                .map(t => typeof t === 'string' ? { name: t }
                  : { name: typeof t.name === 'string' ? t.name : undefined,
                      dose: typeof t.dose === 'string' ? t.dose : undefined })
                .filter(x => typeof x.name === 'string' && x.name.length > 0)
            : undefined,
          anchors: evt.sourceSpan
            ? (() => {
                const b   = evt.sourceSpan.bounds || {};
                const pos = {};
                if (Number.isFinite(evt.sourceSpan.page)) pos.page = evt.sourceSpan.page;
                if (Number.isFinite(b.xMin)) pos.xMin = b.xMin;
                if (Number.isFinite(b.yMin)) pos.yMin = b.yMin;
                if (Number.isFinite(b.xMax)) pos.xMax = b.xMax;
                if (Number.isFinite(b.yMax)) pos.yMax = b.yMax;
                return {
                  position:   Object.keys(pos).length > 0 ? pos : undefined,
                  sourceSpan: evt.sourceSpan.blockIndex !== undefined
                    ? { blockIndex: evt.sourceSpan.blockIndex } : undefined,
                  confidence: typeof evt.sourceSpan.confidence === 'number'
                    ? evt.sourceSpan.confidence : undefined,
                };
              })()
            : undefined,
          confidence: typeof evt.confidence === 'number'
            ? Math.max(0, Math.min(1, evt.confidence)) : 0.8,
          tags:    evt.tags,
          payload: evt.payload,
        };
        const parsed = MedicalEventSchema.safeParse(transformed);
        if (parsed.success) medicalEvents.push(parsed.data);
      }

      // 중복 이벤트 병합
      const unifiedMedicalEvents = medicalEventModel.unifyDuplicateEvents(medicalEvents);

      // ── 3단계: 안전모드 검증 ─────────────────────────────────────────────
      let safeModeResult = null;
      try {
        safeModeResult = safeModeGuard.validateAndGuard(unifiedMedicalEvents);
        if (safeModeResult.safeModeActive) {
          console.log(`🛡️ 안전모드 활성화: ${safeModeResult.safeModeReason}`);
        }
      } catch (e) {
        console.warn(`⚠️ 안전모드 검증 실패: ${e.message}`);
      }

      // ── 4단계: 고지의무 분석 ─────────────────────────────────────────────
      let disclosureReport = null;
      try {
        disclosureReport = disclosureReportBuilder.buildReport(
          unifiedMedicalEvents,
          options.patientInfo || {},
          { format: options.reportFormat }
        );
        console.log(`📋 고지의무 보고서: Core ${disclosureReport.metadata.coreEvents}건, Critical ${disclosureReport.metadata.criticalEvents}건`);
      } catch (e) {
        console.warn(`⚠️ 고지의무 보고서 실패: ${e.message}`);
      }

      // ── 5단계: 통합 보고서 생성 ──────────────────────────────────────────
      let unifiedReport = null;
      try {
        const builder = new UnifiedReportBuilder(
          { pipeline: { medicalEvents: unifiedMedicalEvents, disclosureReport } },
          options.patientInfo || {}
        );
        unifiedReport = builder.buildReport();
        console.log(`📄 통합 보고서: 3M ${unifiedReport.metadata.within3M}건, 5Y ${unifiedReport.metadata.within5Y}건`);
      } catch (e) {
        console.warn(`⚠️ 통합 보고서 실패: ${e.message}`);
      }

      // ── 서브셋 검증 (선택) ───────────────────────────────────────────────
      let subsetValidation = null;
      try {
        const vnexsusText = unifiedMedicalEvents.map(e => {
          const code = e?.diagnosis?.code ? ` ${e.diagnosis.code}` : '';
          return `${e.date || ''} ${e.hospital || ''}${code} ${e.description || ''}`;
        }).join('\n');
        const validator = new ReportSubsetValidator();
        const res = validator.validateCase('inline', '', vnexsusText);
        subsetValidation = {
          dateMatchRate:     res.matching?.dates?.matchRate || 0,
          icdMatchRate:      res.matching?.icds?.matchRate  || 0,
          hospitalMatchRate: res.matching?.hospitals?.matchRate || 0,
          missing: {
            dates:     res.matching?.dates?.missing     || [],
            icds:      res.matching?.icds?.missing      || [],
            hospitals: res.matching?.hospitals?.missing || [],
          },
        };
      } catch { /* 검증 실패는 무시 */ }

      const processingTime = Date.now() - startTime;
      this._updateStats(processingTime, true);
      console.log(`✅ 후처리 완료 (${processingTime}ms) — 이벤트 ${unifiedMedicalEvents.length}건`);

      return {
        success: true,
        processingTime,
        pipeline: {
          dateBlocks,
          medicalEvents: unifiedMedicalEvents,
          disclosureReport,
          safeModeResult,
          unifiedReport,
          reportSubsetValidation: subsetValidation,
        },
        statistics: {
          originalTextLength: ocrText.length,
          eventCount:         unifiedMedicalEvents.length,
          coreEvents:         disclosureReport?.metadata?.coreEvents   || 0,
          criticalEvents:     disclosureReport?.metadata?.criticalEvents || 0,
          safeModeActive:     safeModeResult?.safeModeActive || false,
        },
        metadata: {
          version:       '8.0',
          timestamp:     new Date().toISOString(),
          processingMode: 'RULE_BASED',
          pipelineSteps:  5,
        },
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this._updateStats(processingTime, false);
      throw new Error(`후처리 파이프라인 실패: ${error.message}`);
    }
  }

  _updateStats(processingTime, success) {
    this.processingStats.totalProcessed++;
    if (success) this.processingStats.successfulProcessing++;
    this.processingStats.averageProcessingTime =
      this.processingStats.averageProcessingTime === 0
        ? processingTime
        : (this.processingStats.averageProcessingTime + processingTime) / 2;
    this.processingStats.lastProcessingTime = new Date().toISOString();
  }

  getProcessingStats() {
    const t = this.processingStats;
    return {
      ...t,
      successRate: t.totalProcessed > 0
        ? ((t.successfulProcessing / t.totalProcessed) * 100).toFixed(1)
        : '0.0',
    };
  }

  /**
   * 메인 앱용 래퍼 — processOCRResult 결과를 레거시 호출자가 기대하는 형태로 변환
   * 호출처: postProcessRoutes.js, devCaseManagerRoutes.js, caseReportService.js 등
   * @param {string} ocrText
   * @param {Object} options
   */
  async processForMainApp(ocrText, options = {}) {
    const result = await this.processOCRResult(ocrText, options);
    const unifiedReport = result.pipeline?.unifiedReport || null;

    // 레거시 호출자가 기대하는 finalReport.results.text / json 구조
    const finalReport = {
      results: {
        text: unifiedReport
          ? { content: unifiedReport.text, downloadUrl: null }
          : null,
        json: unifiedReport
          ? { content: unifiedReport.json, downloadUrl: null }
          : null,
      },
      filePath: null, // 파일 저장을 하지 않으므로 null (caseReportService 등에서 확인)
    };

    // 프리뷰용 organizedData: 날짜·병원·진단·치료 단순 목록
    const organizedData = (result.pipeline?.medicalEvents || []).map(e => ({
      date: e.date || '',
      hospital: e.hospital || '',
      diagnosis: e.diagnosis?.name ? [e.diagnosis.name] : [],
      diag: e.diagnosis?.code ? [e.diagnosis.code] : [],
      treatment: Array.isArray(e.procedures)
        ? e.procedures.map(p => p.name).filter(Boolean)
        : [],
    }));

    return {
      ...result,
      finalReport,
      organizedData,
    };
  }

  /**
   * 디버그 정보 반환 — processOCRResult 전체 결과를 그대로 반환
   * 호출처: postProcessRoutes.js /debug
   */
  async getDebugInfo(ocrText, options = {}) {
    return this.processOCRResult(ocrText, options);
  }

  /**
   * 통계 초기화
   * 호출처: postProcessRoutes.js /reset-stats
   */
  resetStats() {
    this.processingStats = {
      totalProcessed: 0,
      successfulProcessing: 0,
      averageProcessingTime: 0,
      lastProcessingTime: null,
    };
  }
}

export default new PostProcessingManager();
