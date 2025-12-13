/**
 * 의료 문서 시계열 처리 시스템 메인 진입점
 */

import bridgeSubscriber from './bridge/bridgeSubscriber';
import reportController from './controllers/reportController';
import { logger, logBusinessEvent, logProcessingStart, logProcessingComplete, logProcessingError } from './shared/logging/logger.js';
import { ERRORS } from './shared/constants/errors.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 환경 변수 설정
dotenv.config();

// 출력 디렉토리 확인 및 생성
const outputDir = path.resolve(process.cwd(), 'outputs');
if (!fs.existsSync(outputDir)) {
  logger.info({ event: 'init_output_dir_created', outputDir });
  fs.mkdirSync(outputDir, { recursive: true });
}

// 이벤트 핸들러 등록
bridgeSubscriber.on('parsed-done', async (data) => {
  logProcessingStart('report_generation', { jobId: data?.jobId, eventCount: data?.parsedEvents?.length });
  const t0 = Date.now();

  try {
    const result = await reportController.generateReport(data);
    if (result?.success) {
      const duration = Date.now() - t0;
      logProcessingComplete('report_generation', duration, { jobId: data?.jobId, reportPath: result?.reportPath });
      logger.info({
        event: 'report_generated',
        jobId: data?.jobId,
        reportPath: result?.reportPath,
        stats: result?.stats ?? null,
      });
    } else {
      logProcessingError('report_generation', new Error(String(result?.error ?? 'unknown')), { jobId: data?.jobId });
      logger.error({
        event: 'report_generation_failed',
        code: ERRORS.INTERNAL_ERROR.code,
        message: ERRORS.INTERNAL_ERROR.message,
        details: { error: String(result?.error ?? 'unknown') },
        jobId: data?.jobId,
      });
    }
  } catch (err) {
    logProcessingError('report_generation', err instanceof Error ? err : new Error(String(err)), { jobId: data?.jobId });
    logger.error({
      event: 'report_generation_exception',
      code: ERRORS.INTERNAL_ERROR.code,
      message: ERRORS.INTERNAL_ERROR.message,
      details: { error: String(err && err.message ? err.message : err) },
      jobId: data?.jobId,
    });
  }
});

// Pub/Sub 연결 시작
async function start() {
  try {
    logger.info({ event: 'system_start', message: '의료 문서 시계열 처리 시스템 시작' });
    
    // PubSub 브릿지 연결
    const connected = await bridgeSubscriber.connect();
    
    if (connected) {
      logger.info({ event: 'bridge_connected', message: '메시지 수신 대기 중' });
      logBusinessEvent('subscriber_ready', { events: ['parsed-done'] });
    } else {
      logger.error({ event: 'bridge_connect_failed', code: ERRORS.INTERNAL_ERROR.code, message: ERRORS.INTERNAL_ERROR.message });
    }
  } catch (error) {
    logger.error({
      event: 'startup_failed',
      code: ERRORS.INTERNAL_ERROR.code,
      message: ERRORS.INTERNAL_ERROR.message,
      details: { error: String(error && error.message ? error.message : error) },
    });
  }
}

// 프로세스 종료 처리
process.on('SIGINT', async () => {
  logger.info({ event: 'shutdown', message: '시스템 종료 중' });
  bridgeSubscriber.disconnect();
  process.exit(0);
});

// 시스템 시작
start(); 
