/**
 * Report Maker 모듈
 * 
 * 타임라인 데이터를 보고서로 변환하는 모듈
 */

import reportMaker from '../lib/reportMaker.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * 타임라인 데이터를 기반으로 보고서 생성
 * @param {Object} timeline 타임라인 데이터
 * @param {Object} options 보고서 옵션
 * @returns {Promise<string>} 보고서 URL
 */
export async function buildReport(timeline, options = {}) {
  try {
    console.log('보고서 생성 시작', options);
    
    // 모드에 따른 옵션 설정
    const reportOptions = {
      includeAllEvents: options.mode === 'all' || options.mode === 'full',
      includeFilteredEvents: options.mode === 'all' || options.mode === 'filtered',
      includeStats: options.mode === 'all' || options.mode === 'stats',
      outputDir: './public/reports'
    };
    
    // 보고서 생성
    const result = await reportMaker.createReport(
      timeline,
      timeline.filterResult, // 필터링 결과가 타임라인에 포함되어 있는 경우
      reportOptions
    );
    
    if (!result.success) {
      throw new Error(result.error || '보고서 생성 실패');
    }
    
    // 보고서 URL 생성
    const reportPath = result.reportPath;
    const fileName = path.basename(reportPath);
    const reportUrl = `/reports/${fileName}`;
    
    console.log(`보고서 생성 완료: ${reportUrl}`);
    return {
      downloadUrl: `/reports/${fileName}`,
      preview: timeline   // ← 시계열 배열 그대로 포함
    };
  } catch (error) {
    console.error('보고서 생성 중 오류 발생:', error);
    throw error;
  }
}

export default {
  buildReport
}; 