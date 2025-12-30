/**
 * Report Controller
 * 
 * 의료 시계열 보고서 생성 컨트롤러
 */

import m5ReportModule from '../modules/m5-report/index.js';
import path from 'path';
import { reportMaker } from '../lib/reportMaker.js';
import fs from 'fs/promises';
import { logger } from '../shared/logging/logger.js';

class ReportController {
  private static instance: ReportController;
  
  private constructor() {}
  
  /**
   * 싱글톤 인스턴스 가져오기
   */
  public static getInstance(): ReportController {
    if (!ReportController.instance) {
      ReportController.instance = new ReportController();
    }
    return ReportController.instance;
  }
  
  /**
   * 보고서 생성
   * @param data 파싱된 이벤트 데이터
   */
  public async generateReport(data: any): Promise<any> {
    try {
      logger.info({
        event: 'report_generate_start',
        message: 'Report generation started',
        metadata: { jobId: data.jobId }
      });
      
      // 의료 시계열 데이터 생성
      const timelineData = {
        events: data.parsedEvents || [],
        patientInfo: data.patientInfo || {},
        insuranceInfo: data.insuranceInfo || {}
      } as any;
      
      // 필터링 결과 (있는 경우)
      const filterResult = data.filterResult;
      
      // 출력 디렉토리 설정
      const outputDir = path.resolve(process.cwd(), 'outputs', data.jobId || '');
      
      // M5 보고서 모듈을 사용하여 보고서 생성
      const result = await m5ReportModule.generateReport(
        timelineData,
        filterResult,
        outputDir
      );
      
      if (result.success) {
        logger.info({
          event: 'report_generate_success',
          message: 'Report generation succeeded',
          metadata: { jobId: data.jobId, reportPath: result.reportPath }
        });
      } else {
        logger.error({
          event: 'report_generate_failed',
          message: 'Report generation failed',
          metadata: { jobId: data.jobId },
          error: { name: 'Error', message: result.error || 'unknown_error' }
        });
      }
      
      return result;
    } catch (error: any) {
      logger.error({
        event: 'report_generate_error',
        message: 'Report generation error',
        metadata: { jobId: data?.jobId },
        error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack }
      });
      return {
        success: false,
        error: error.message || '알 수 없는 오류'
      };
    }
  }

  /**
   * 타임라인 JSON 파일 로드
   * @param filePath 타임라인 JSON 파일 경로
   */
  private async getTimelineJSON(filePath: string): Promise<any> {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      const fileContent = await fs.readFile(absolutePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch (error: any) {
      logger.error({
        event: 'report_timeline_json_load_error',
        message: 'Failed to load timeline JSON',
        metadata: { filePath },
        error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack }
      });
      throw new Error(`타임라인 JSON 파일 로드 실패: ${error.message}`);
    }
  }

  /**
   * 리포트 핸들러 - API 경로 처리
   * @param req Express 요청 객체
   * @param res Express 응답 객체
   */
  public async reportHandler(req: any, res: any): Promise<void> {
    try {
      const timeline = await this.getTimelineJSON(req.query.file);
      const url = await reportMaker.createReport(timeline, undefined, {
        outputPath: path.resolve(process.cwd(), 'outputs')
      });
      res.json({url: url.reportPath});
    } catch (error: any) {
      logger.error({
        event: 'report_handler_error',
        message: 'Report handler error',
        error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack }
      });
      res.status(500).json({
        success: false,
        error: error.message || '보고서 생성 중 오류가 발생했습니다.'
      });
    }
  }
}

// 컨트롤러 인스턴스 생성 및 내보내기
const reportController = ReportController.getInstance();
export default reportController;

// reportHandler 함수 내보내기 (라우터에서 사용)
export const reportHandler = reportController.reportHandler.bind(reportController); 
