/**
 * Google Cloud Vision API 연결 테스트 스크립트
 */
import { ImageAnnotatorClient } from '@google-cloud/vision';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// 환경 변수 로드
dotenv.config();

// 환경 변수 확인
console.log('GOOGLE_APPLICATION_CREDENTIALS 환경 변수:', process.env.GOOGLE_APPLICATION_CREDENTIALS || '설정되지 않음');
console.log('GOOGLE_CLOUD_VISION_API_KEY 환경 변수:', process.env.GOOGLE_CLOUD_VISION_API_KEY ? '설정됨' : '설정되지 않음');
console.log('GCP_PROJECT_ID 환경 변수:', process.env.GCP_PROJECT_ID || '설정되지 않음');

// 인증 옵션 설정
const options = {};
let authMethod = 'DEFAULT_APPLICATION_CREDENTIALS';

// 1. 키 파일 설정 (우선 순위 1)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fs.existsSync(keyPath)) {
    console.log(`서비스 계정 키 파일 존재: ${keyPath}`);
    options.keyFilename = keyPath;
    authMethod = 'SERVICE_ACCOUNT_KEY_FILE';
  } else {
    console.error(`서비스 계정 키 파일이 존재하지 않습니다: ${keyPath}`);
  }
}

// 2. API 키 설정 (우선 순위 2)
if (!options.keyFilename && process.env.GOOGLE_CLOUD_VISION_API_KEY) {
  console.log('API 키 사용');
  options.key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  authMethod = 'API_KEY';
}

// 3. 프로젝트 ID 설정 (선택사항)
if (process.env.GCP_PROJECT_ID) {
  console.log(`프로젝트 ID 설정: ${process.env.GCP_PROJECT_ID}`);
  options.projectId = process.env.GCP_PROJECT_ID;
}

try {
  // Vision 클라이언트 생성
  console.log(`Vision 클라이언트 초기화 중... (인증 방법: ${authMethod})`);
  console.log('사용 옵션:', JSON.stringify(options, null, 2));
  const client = new ImageAnnotatorClient(options);
  console.log('Vision 클라이언트 초기화 성공!');
  
  // 프로젝트 ID 확인
  if (options.projectId) {
    console.log('설정된 프로젝트 ID:', options.projectId);
  } else {
    console.log('프로젝트 ID 확인 중...');
    client.getProjectId().then(projectId => {
      console.log('연결된 GCP 프로젝트 ID:', projectId);
    }).catch(err => {
      console.error('프로젝트 ID 확인 중 오류:', err.message);
    });
  }
  
} catch (error) {
  console.error('Vision 클라이언트 초기화 실패:', error.message);
} 