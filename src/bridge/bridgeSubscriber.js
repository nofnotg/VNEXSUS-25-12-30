/**
 * Bridge Subscriber (Mock)
 * 
 * 역할: (테스트용) 가짜 Pub/Sub 메시지를 생성하고 처리하는 모듈
 */

import path from 'path';
import fs from 'fs';
import { logger } from '../shared/logging/logger.js';
import { maskObject } from '../shared/security/mask.js';
import { BRIDGE_EVENTS } from '../shared/constants/logging.js';

// GCP 프로젝트 ID 설정
const projectId = process.env.GCP_PROJECT_ID || 'medreport-vision-ocr';
logger.info({ event: BRIDGE_EVENTS.BRIDGE_PROJECT_ID, projectId });

// 시작 로그
logger.info({ event: BRIDGE_EVENTS.BRIDGE_INIT, mode: 'test' });

// outputs 디렉토리 확인 및 생성
const outputDir = path.resolve(process.cwd(), 'outputs');
if (!fs.existsSync(outputDir)) {
  logger.info({ event: BRIDGE_EVENTS.INIT_OUTPUT_DIR_CREATED, outputDir });
  fs.mkdirSync(outputDir, { recursive: true });
}

// 가짜 테스트 메시지
const testMessage = {
  id: 'test-' + Date.now(),
  data: Buffer.from(JSON.stringify({
    jobId: 'test-job-' + Date.now(),
    ocrText: `
      서울대학교병원
      진료일: 2022-05-15
      환자명: 홍길동
      진단명: 고혈압, 당뇨병
      
      처방:
      - 고혈압약 1일 1회
      - 당뇨약 1일 3회
      
      다음 진료 예약: 2022-06-15
    `,
    patientInfo: {
      name: '홍길동',
      enrollmentDate: '2022-01-01'
    }
  })),
  ack: () => logger.info({ event: BRIDGE_EVENTS.MESSAGE_ACK, msg: '메시지 처리 완료' })
};

// 샘플 엑셀 파일 생성 함수 (실제로는 생성하지 않음)
function createSampleReport() {
  const reportPath = path.join(outputDir, 'sample_report.xlsx');
  logger.info({ event: BRIDGE_EVENTS.SAMPLE_REPORT_CREATED, reportPath });
  return reportPath;
}

logger.info({ event: BRIDGE_EVENTS.BRIDGE_TEST_MODE, message: '테스트 모드로 실행 중' });
logger.info({ event: BRIDGE_EVENTS.BRIDGE_TEST_MESSAGE_SCHEDULE, delayMs: 5000 });

// 5초 후 가짜 메시지 처리
setTimeout(async () => {
  try {
    logger.info({ event: BRIDGE_EVENTS.BRIDGE_TEST_MSG_RECEIVE, id: testMessage.id });
    const payload = JSON.parse(testMessage.data.toString());
    
    // 처리 단계 로깅
    logger.info({ event: BRIDGE_EVENTS.BRIDGE_MSG_RECEIVED, jobId: payload.jobId });
    logger.info({ event: BRIDGE_EVENTS.BRIDGE_OCR_TEXT_LENGTH, length: payload.ocrText.length });
    logger.info({ event: BRIDGE_EVENTS.BRIDGE_PATIENT_INFO, patientInfo: maskObject(payload.patientInfo) });
    
    // 샘플 보고서 생성 (가짜)
    createSampleReport();
    
    // 처리 완료
    testMessage.ack();
    
    // 이제 실제 Pub/Sub 구독을 시작할 수 있다는 안내
    logger.info({ event: BRIDGE_EVENTS.BRIDGE_TEST_MODE_COMPLETE });
    logger.info({ event: BRIDGE_EVENTS.BRIDGE_PUBSUB_SETUP_HINT, projectId, steps: ['set GOOGLE_CLOUD_PROJECT', 'set GOOGLE_APPLICATION_CREDENTIALS', 'create topic ocr-result', 'create subscription ocr-result-sub'] });
    
  } catch (error) {
    logger.error({ event: BRIDGE_EVENTS.BRIDGE_MESSAGE_PROCESS_ERROR, message: error?.message });
  }
}, 5000);

// 종료 처리
process.on('SIGINT', () => {
  logger.info({ event: BRIDGE_EVENTS.BRIDGE_SHUTDOWN, message: '브릿지 구독자 종료 중' });
  process.exit(0);
}); 
