/**
 * M5 Report Module
 * 
 * 의료 시계열 데이터를 엑셀 보고서로 변환하는 모듈
 */

import { reportMaker } from '../../lib/reportMaker.js';
import type { FilterResult } from '../../lib/periodFilter';
import type { MedicalTimeline } from '../../lib/eventGrouper';

// 모듈 인터페이스
export interface M5ReportModule {
  /**
   * 엑셀 보고서 생성
   * @param timelineData 의료 시계열 데이터
   * @param filterResult 필터링 결과 (옵션)
   * @param outputPath 출력 경로 (옵션)
   */
  generateReport(
    timelineData: MedicalTimeline,
    filterResult?: FilterResult,
    outputPath?: string
  ): Promise<M5ReportResult>;
}

// 보고서 생성 결과
export interface M5ReportResult {
  success: boolean;        // 성공 여부
  reportPath?: string;     // 보고서 파일 경로 (성공 시)
  error?: string;          // 오류 메시지 (실패 시)
  stats?: {                // 통계 정보
    total: number;         // 총 이벤트 수
    filtered: number;      // 필터링된 이벤트 수
    categories: Record<string, number>; // 카테고리별 이벤트 수
    tags: Record<string, number>;      // 태그별 이벤트 수
  };
}

/**
 * M5 리포트 모듈 구현
 */
class M5Report implements M5ReportModule {
  /**
   * 엑셀 보고서 생성
   */
  public async generateReport(
    timelineData: MedicalTimeline,
    filterResult?: FilterResult,
    outputPath?: string
  ): Promise<M5ReportResult> {
    try {
      console.log('[M5Report] 보고서 생성 시작');
      
      // 출력 디렉토리 설정
      const outputOptions = outputPath ? { outputPath: outputPath } : undefined;
      
      // ReportMaker를 사용하여 보고서 생성
      const result = await reportMaker.createReport(
        timelineData,
        filterResult,
        outputOptions as any
      );
      
      console.log('[M5Report] 보고서 생성 완료:', result.reportPath);
      
      return {
        success: result.success,
        reportPath: result.reportPath,
        error: result.error,
        stats: {
          total: result.stats?.totalEvents || 0,
          filtered: result.stats?.filteredEvents || 0,
          categories: {},
          tags: {}
        }
      };
    } catch (error) {
      console.error('[M5Report] 보고서 생성 중 오류 발생:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// 모듈 인스턴스 생성
const m5ReportModule = new M5Report();

export default m5ReportModule; 