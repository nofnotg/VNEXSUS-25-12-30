/**
 * Report Controller
 * 
 * 역할: 파싱된 이벤트에서 보고서 생성 로직 처리
 * - 이벤트 필터링, 그룹화, 통계 처리
 * - 보고서 생성 요청 처리
 */

import { reportMaker } from '../lib/reportMaker.js';
import { periodFilter } from '../lib/periodFilter.js';
import { eventGrouper } from '../lib/eventGrouper.js';
import path from 'path';
import fs from 'fs';
import { buildVectorMeta, quantizeWeights } from '../shared/utils/vectorMeta.js';
import { classifyDataset } from '../shared/utils/datasetClassifier.js';
import { validateTimeline } from '../modules/reports/types/structuredOutput.js';
import { logger, logProcessingStart, logProcessingComplete, logProcessingError, logBusinessEvent } from '../shared/logging/logger.js';
import { REPORT_EVENTS } from '../shared/constants/logging.js';
import { ERRORS } from '../shared/constants/errors.js';

class ReportController {
  /**
   * 파싱된 이벤트로부터 보고서 생성
   */
  async generateReport(data) {
    try {
      const { parsedEvents, patientInfo, options = {} } = data;
      const t0 = Date.now();
      logProcessingStart('report_generate', {
        totalEvents: Array.isArray(parsedEvents) ? parsedEvents.length : 0,
        traceId: options.traceId,
        patientInfo,
      });
      
      // 1. 기간 필터링
      const filterOptions = {
        startDate: options.startDate,
        endDate: options.endDate,
        minConfidence: options.minConfidence || 0.6,
        includeTags: options.includeTags || [],
        excludeTags: options.excludeTags || [],
        includeBeforeEnrollment: options.includeBeforeEnrollment || true
      };
      
      const filteredResult = await periodFilter.filter(
        parsedEvents,
        patientInfo.enrollmentDate,
        filterOptions
      );
      
      logBusinessEvent(REPORT_EVENTS.REPORT_FILTER_COMPLETE, {
        filteredCount: filteredResult.filtered.length,
        totalEvents: parsedEvents.length,
        beforeEnrollment: Array.isArray(filteredResult.beforeEnrollment) ? filteredResult.beforeEnrollment.length : 0,
        options: filterOptions,
        traceId: options.traceId,
      });
      
      // 2. 의료 타임라인 생성
      const timeline = await eventGrouper.createTimeline(
        filteredResult.filtered,
        {
          groupByDate: options.groupByDate || true,
          groupByHospital: options.groupByHospital || true
        }
      );

      logBusinessEvent(REPORT_EVENTS.TIMELINE_BUILT, {
        eventCount: Array.isArray(timeline?.events) ? timeline.events.length : 0,
        traceId: options.traceId,
      });

      // 2.1 구조 검증(Zod) – 스키마 불일치 시 생성 중단 및 로깅
      const timelineCheck = validateTimeline(timeline);
      if (!timelineCheck.success) {
        const issues = timelineCheck.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
          code: i.code,
        }));
        logger.logProcessingError('report_generate', new Error('timeline_schema_invalid'), {
          event: 'schema_mismatch',
          traceId: options.traceId,
          issues,
          sample: (timeline && Array.isArray(timeline.events))
            ? timeline.events.slice(0, 3)
            : { invalid: true },
        });
        return {
          success: false,
          errorCode: ERRORS.INVALID_RESPONSE_SCHEMA.code,
          error: ERRORS.INVALID_RESPONSE_SCHEMA.message,
        };
      }
      
      // 3. 보고서 생성
      const created = await reportMaker.createReport(
        timeline,
        filteredResult,
        {
          outputDir: path.resolve(process.cwd(), 'outputs'),
          patientInfo,
          highlightBeforeEnrollment: true,
          format: options.format || 'excel'
        }
      );
      const reportPath = typeof created === 'string' ? created : created?.reportPath;

      logBusinessEvent(REPORT_EVENTS.REPORT_PATH_READY, { reportPath, traceId: options.traceId });

      // Build VectorMeta for current case (weights quantized to one decimal)
      const weights = quantizeWeights(options.vectorWeights || { semantic: 0.3, time: 0.3, confidence: 0.4 });
      const avgConfidence = Array.isArray(filteredResult?.filtered) && filteredResult.filtered.length
        ? (filteredResult.filtered.reduce((acc, e) => acc + (typeof e.confidence === 'number' ? e.confidence : 0.6), 0) / filteredResult.filtered.length)
        : 0.6;
      const vectorMeta = buildVectorMeta({
        organizedData: { groupedData: timeline?.events ?? [] },
        massiveDateResult: {
          structuredGroups: timeline?.events ?? [],
          statistics: { averageConfidence: avgConfidence },
        },
        finalReport: { timeline },
        weights,
      });

      // Save preview JSON for visualization
      try {
        const previewOut = path.resolve(process.cwd(), 'temp', 'reports', 'vector_meta_preview.json');
        fs.writeFileSync(previewOut, JSON.stringify({ vectorMeta, createdAt: new Date().toISOString() }, null, 2), 'utf8');
      } catch (error) {
        // Non-fatal: ignore preview write errors
        void error;
      }

      // Dataset classification & vector storage for current case
      const classification = classifyDataset(filteredResult.filtered, patientInfo);
      try {
        const storeDir = path.resolve(process.cwd(), 'src', 'data', 'vectors');
        fs.mkdirSync(storeDir, { recursive: true });
        const jobId = (data?.jobId) || `case_${Date.now()}`;
        const iso = (() => {
          // lazy inline to avoid extra import: same math as preview
          const deg = Math.PI / 6; const [x,y,z] = vectorMeta.projection3D.map(v => v*120);
          const isoX = (x - z) * Math.cos(deg); const isoY = y + (x + z) * Math.sin(deg);
          return [Math.round(isoX*100)/100, Math.round(isoY*100)/100];
        })();
        const out = {
          jobId,
          classification,
          vectorMeta,
          weights,
          iso2D: { x: iso[0], y: iso[1] },
          savedAt: new Date().toISOString(),
        };
        const storePath = path.resolve(storeDir, `${jobId}.json`);
        fs.writeFileSync(storePath, JSON.stringify(out, null, 2), 'utf8');
      } catch (error) {
        // Non-fatal: ignore dataset storage errors
        void error;
      }
      
      const result = {
        success: true,
        reportPath,
        stats: {
          total: parsedEvents.length,
          filtered: filteredResult.filtered.length,
          beforeEnrollment: filteredResult.beforeEnrollment.length,
          timeline: timeline.events.length
        },
        vectorMeta,
        weights,
        classification,
      };
      logProcessingComplete('report_generate', Date.now() - t0, result);
      return result;
    } catch (error) {
      logProcessingError('report_generate', error, { stage: 'controller_catch' });
      return {
        success: false,
        errorCode: ERRORS.INTERNAL_ERROR.code,
        error: error.message
      };
    }
  }
}

// 싱글톤 인스턴스 생성
const reportController = new ReportController();

export default reportController; 
