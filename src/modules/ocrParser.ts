/**
 * OCR Parser Module
 * 
 * 역할: OCR 결과를 파싱하여 의료 이벤트로 변환하고 파이프라인 처리
 */

// MedReport_module_v2의 기존 모듈 import
import { reportMaker } from '../lib/reportMaker.js';
import { periodFilter } from '../lib/periodFilter.js';
import { eventGrouper } from '../lib/eventGrouper.js';
import { eventTagger } from '../lib/eventTagger.js';
import { ocrParser } from '../lib/ocrParser.js';
import path from 'path';

/**
 * OCR 결과 처리 핸들러
 * Pub/Sub으로부터 수신한 OCR 결과를 전체 파이프라인으로 처리
 */
export async function handleOcrResult(payload: any) {
  try {
    console.log(`🔍 OCR 결과 처리 시작 (jobId: ${payload.jobId || 'unknown'})`);
    
    // 1. OCR 텍스트 파싱 (ocrParser 사용)
    console.log('1. OCR 텍스트 파싱 중...');
    const parsedEvents = await (ocrParser as any).parseText(payload.ocrText || payload.text || '');
    console.log(`✅ 파싱 완료: ${parsedEvents.length}개 이벤트 추출됨`);
    
    // 2. 이벤트 태깅 (eventTagger 사용)
    const taggedEvents = await eventTagger.tagEvents(parsedEvents);
    console.log(`✅ 태깅 완료: ${taggedEvents.length}개 이벤트에 태그 적용됨`);
    
    // 3. 기간 필터링 (periodFilter 사용)
    const filterOptions = {
      startDate: payload.options?.startDate,
      endDate: payload.options?.endDate,
      minConfidence: payload.options?.minConfidence || 0.7,
      includeTags: payload.options?.includeTags || [],
      excludeTags: payload.options?.excludeTags || [],
      includeBeforeEnrollment: payload.options?.includeBeforeEnrollment !== false
    };
    
    const filteredResult = await (periodFilter as any).filter(
      taggedEvents,
      payload.patientInfo?.enrollmentDate,
      filterOptions
    );
    
    console.log(`✅ 필터링 완료: ${filteredResult.filtered.length}/${taggedEvents.length} 이벤트 선택됨`);
    
    // 4. 타임라인 생성 (eventGrouper 사용)
    const timeline = await (eventGrouper as any).createTimeline(
      filteredResult.filtered,
      {
        groupByDate: payload.options?.groupByDate !== false,
        groupByHospital: payload.options?.groupByHospital !== false
      }
    );
    
    console.log(`✅ 타임라인 생성 완료: ${timeline.events.length} 이벤트 그룹화됨`);
    
    // 5. 보고서 생성 (reportMaker 사용)
    const reportOptions = {
      outputPath: path.resolve(process.cwd(), 'outputs'),
      patientInfo: payload.patientInfo || {},
      highlightBeforeEnrollment: true,
      format: payload.options?.format || 'excel'
    };
    
    const reportResult = await reportMaker.createReport(
      timeline,
      filteredResult,
      reportOptions as any
    );
    
    console.log(`📊 보고서 생성 완료: ${reportResult.reportPath}`);
    
    return {
      success: true,
      reportPath: reportResult.reportPath,
      stats: {
        parsed: parsedEvents.length,
        tagged: taggedEvents.length,
        filtered: filteredResult.filtered.length,
        timeline: timeline.events.length
      }
    };
  } catch (error: any) {
    console.error('❌ OCR 결과 처리 중 오류 발생:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 