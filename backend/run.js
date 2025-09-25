import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 경로 설정 및 로드
const envPath = path.resolve(__dirname, '.env');
console.log(`환경 변수 파일 경로: ${envPath}`);
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('환경 변수 파일 로드 중 오류 발생:', result.error);
  process.exit(1);
}

console.log('환경 변수 로드 완료');
console.log('GCS_BUCKET_NAME:', process.env.GCS_BUCKET_NAME);
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log('PORT:', process.env.PORT);

// 서버 실행
import('./app.js'); 