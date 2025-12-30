/**
 * Bridge Publisher - 테스트용
 * 
 * 역할: 테스트를 위해 OCR 결과를 Pub/Sub에 발행
 */

import { PubSub } from '@google-cloud/pubsub';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { logger } from '../shared/logging/logger.js';

// 환경 변수 설정
dotenv.config();

// ES 모듈에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PubSub 클라이언트 초기화
const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID || 'medreport-vision-ocr'
});

// 토픽 이름
const topicName = 'ocr-result';

/**
 * 메시지 전송
 */
async function publishMessage(data) {
  try {
    // JSON 문자열 변환 및 버퍼 생성
    const dataBuffer = Buffer.from(JSON.stringify(data));
    
    // 메시지 발행
    const messageId = await pubsub.topic(topicName).publish(dataBuffer);
    logger.info({ event: 'bridge_publish_success', metadata: { messageId } });
    
    return messageId;
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    logger.error({ event: 'bridge_publish_error', error: { name: e.name, message: e.message, stack: e.stack } });
    throw error;
  }
}

/**
 * 테스트 파일에서 OCR 텍스트 로드
 */
function loadTestOcrText() {
  const testFilePath = path.join(__dirname, '../../temp/ocr_sample.txt');
  
  // 파일 존재 확인
  if (!fs.existsSync(testFilePath)) {
    logger.warn({ event: 'bridge_test_file_missing', metadata: { testFilePath } });
    
    // 샘플 OCR 텍스트 반환
    return `
      서울대학교병원
      진료일: 2022-05-15
      환자명: 홍길동
      진단명: 고혈압, 당뇨병
      
      처방:
      - 고혈압약 1일 1회
      - 당뇨약 1일 3회
      
      다음 진료 예약: 2022-06-15
    `;
  }
  
  return fs.readFileSync(testFilePath, 'utf8');
}

/**
 * 테스트 메시지 발행
 */
async function publishTestMessage() {
  const ocrText = loadTestOcrText();
  
  const message = {
    jobId: `test-${Date.now()}`,
    ocrText,
    patientInfo: {
      name: '홍길동',
      enrollmentDate: '2022-01-01'
    },
    options: {
      includeBeforeEnrollment: true,
      format: 'excel'
    }
  };
  
  logger.info({ event: 'bridge_test_publish_start' });
  await publishMessage(message);
}

// 테스트 메시지 발행 실행
if (process.argv[2] === '--publish') {
  logger.info({ event: 'bridge_test_mode_start' });
  publishTestMessage().catch((error) => {
    const e = error instanceof Error ? error : new Error(String(error));
    logger.error({ event: 'bridge_test_mode_error', error: { name: e.name, message: e.message, stack: e.stack } });
  });
} else {
  logger.info({ event: 'bridge_publisher_usage', message: 'Usage: node bridgePublisher.js --publish' });
}

export { publishMessage };
