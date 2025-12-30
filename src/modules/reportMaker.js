/**
 * Report Maker 모듈
 * 
 * 타임라인 데이터를 보고서로 변환하는 모듈
 */

import { reportMaker } from '../lib/reportMaker.js';
import path from 'path';
import { logger } from '../shared/logging/logger.js';

/**
 * 타임라인 데이터를 기반으로 보고서 생성
 * @param {Object} timeline 타임라인 데이터
 * @param {Object} options 보고서 옵션
 * @returns {Promise<string>} 보고서 URL
 */
export async function buildReport(timeline, options = {}) {
  try {
    logger.info({ event: 'report_build_start', options });
    
    // 모드에 따른 옵션 설정
    const reportOptions = {
      includeAllEvents: options.mode === 'all' || options.mode === 'full',
      includeFilteredEvents: options.mode === 'all' || options.mode === 'filtered',
      includeStats: options.mode === 'all' || options.mode === 'stats',
      outputDir: './public/reports'
    };
    
    // 보고서 생성
    const created = await reportMaker.createReport(
      timeline,
      timeline.filterResult, // 필터링 결과가 타임라인에 포함되어 있는 경우
      reportOptions
    );
    const reportPath = typeof created === 'string' ? created : created?.reportPath;
    
    // 보고서 URL 생성
    const fileName = path.basename(reportPath);
    
    logger.info({ event: 'report_build_complete', reportPath, fileName });
    return {
      downloadUrl: `/reports/${fileName}`,
      preview: timeline   // ← 시계열 배열 그대로 포함
    };
  } catch (error) {
    logger.error({
      event: 'report_build_error',
      error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack }
    });
    throw error;
  }
}

export default {
  buildReport
}; 
