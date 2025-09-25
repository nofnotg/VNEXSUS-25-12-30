/**
 * Post-processing API Routes
 * 
 * 후처리 관련 API 엔드포인트
 */

import express from 'express';
import reportController from '../controllers/reportController.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * 보고서 생성 엔드포인트
 * POST /api/postprocess/report
 * 
 * Request Body:
 * {
 *   jobId: string,              // 작업 ID
 *   parsedEvents: Array,        // 파싱된 이벤트 배열
 *   patientInfo: Object,        // 환자 정보 (옵션)
 *   insuranceInfo: Object,      // 보험 정보 (옵션)
 *   filterResult: Object        // 필터링 결과 (옵션)
 * }
 * 
 * Response:
 * {
 *   success: boolean,           // 성공 여부
 *   reportPath: string,         // 보고서 파일 경로 (성공 시)
 *   error: string,              // 오류 메시지 (실패 시)
 *   stats: {                    // 통계 정보
 *     total: number,            // 총 이벤트 수
 *     filtered: number,         // 필터링된 이벤트 수
 *     ...
 *   }
 * }
 */
router.post('/report', async (req, res) => {
  try {
    const { jobId, parsedEvents, patientInfo, insuranceInfo, filterResult } = req.body;
    
    // 필수 필드 검증
    if (!jobId || !parsedEvents || !Array.isArray(parsedEvents)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 요청 데이터: jobId와 parsedEvents가 필요합니다.'
      });
    }
    
    // 보고서 컨트롤러 호출
    const result = await reportController.generateReport({
      jobId,
      parsedEvents,
      patientInfo,
      insuranceInfo,
      filterResult
    });
    
    // 결과 반환
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('보고서 생성 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '보고서 생성 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 보고서 다운로드 엔드포인트
 * GET /api/postprocess/report/:jobId/:filename
 * 
 * 생성된 보고서 파일 다운로드
 */
router.get('/report/:jobId/:filename', (req, res) => {
  try {
    const { jobId, filename } = req.params;
    
    // 파일 경로 생성
    const filepath = path.resolve(process.cwd(), 'outputs', jobId, filename);
    
    // 파일 존재 여부 확인
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: '요청한 보고서 파일을 찾을 수 없습니다.'
      });
    }
    
    // 파일 다운로드 응답
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('파일 다운로드 오류:', err);
        res.status(500).json({
          success: false,
          error: '파일 다운로드 중 오류가 발생했습니다.'
        });
      }
    });
  } catch (error) {
    console.error('보고서 다운로드 API 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message || '보고서 다운로드 중 오류가 발생했습니다.'
    });
  }
});

export default router; 