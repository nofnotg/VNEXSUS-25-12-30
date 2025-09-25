/**
 * 보고서 생성 라우트
 */

import express from 'express';
import { reportHandler } from '../../src/controllers/reportController.js';

const router = express.Router();

/**
 * 타임라인 데이터를 기반으로 보고서 생성
 * GET /api/report?file=path/to/timeline.json&mode=all
 * 
 * Query Parameters:
 * - file: 타임라인 JSON 파일 경로 (필수)
 * - mode: 보고서 모드 (옵션, 기본값: 'all')
 *   - 'all': 모든 이벤트 및 통계 포함
 *   - 'full': 모든 이벤트만 포함
 *   - 'filtered': 필터링된 이벤트만 포함
 *   - 'stats': 통계만 포함
 * 
 * Response:
 * {
 *   url: 생성된 보고서 URL
 * }
 */
router.get('/report', reportHandler);

export default router; 