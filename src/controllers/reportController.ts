/**
 * Report Controller
 * 
 * 의료 시계열 보고서 생성 컨트롤러
 */

import m5ReportModule from '../modules/m5-report/index.js';
import path from 'path';
import { reportMaker } from '../lib/reportMaker.js';
import fs from 'fs/promises';

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
      console.log(`보고서 컨트롤러: 보고서 생성 시작 (jobId=${data.jobId})`);
      
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
        console.log(`보고서 컨트롤러: 보고서 생성 성공 (${result.reportPath})`);
      } else {
        console.error(`보고서 컨트롤러: 보고서 생성 실패 (${result.error})`);
      }
      
      return result;
    } catch (error: any) {
      console.error('보고서 컨트롤러: 오류 발생', error);
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
      console.error(`타임라인 JSON 파일 로드 실패: ${error.message}`);
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
      console.error('보고서 생성 실패:', error);
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