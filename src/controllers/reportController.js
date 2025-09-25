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

class ReportController {
  /**
   * 파싱된 이벤트로부터 보고서 생성
   */
  async generateReport(data) {
    try {
      const { parsedEvents, patientInfo, options = {} } = data;
      
      console.log(`🔄 보고서 생성 시작 (${parsedEvents.length}개 이벤트)`);
      
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
      
      console.log(`✅ 필터링 완료: ${filteredResult.filtered.length}/${parsedEvents.length} 이벤트`);
      
      // 2. 의료 타임라인 생성
      const timeline = await eventGrouper.createTimeline(
        filteredResult.filtered,
        {
          groupByDate: options.groupByDate || true,
          groupByHospital: options.groupByHospital || true
        }
      );
      
      console.log(`✅ 타임라인 생성 완료: ${timeline.events.length} 이벤트`);
      
      // 3. 보고서 생성
      const reportPath = await reportMaker.createReport(
        timeline,
        filteredResult,
        {
          outputDir: path.resolve(process.cwd(), 'outputs'),
          patientInfo,
          highlightBeforeEnrollment: true,
          format: options.format || 'excel'
        }
      );
      
      console.log('📊 report path:', reportPath);
      
      return {
        success: true,
        reportPath,
        stats: {
          total: parsedEvents.length,
          filtered: filteredResult.filtered.length,
          beforeEnrollment: filteredResult.beforeEnrollment.length,
          timeline: timeline.events.length
        }
      };
    } catch (error) {
      console.error('❌ 보고서 생성 중 오류 발생:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// 싱글톤 인스턴스 생성
const reportController = new ReportController();

export default reportController; 