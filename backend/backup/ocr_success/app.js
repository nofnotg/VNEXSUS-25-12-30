import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import ocrRoutes from './routes/ocrRoutes.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv 로드
console.log('환경 변수를 로드합니다...');
dotenv.config();

// 필수 환경변수 검증
const requiredEnvVars = [
  { name: 'GCS_BUCKET_NAME', value: process.env.GCS_BUCKET_NAME, errorMsg: '환경변수 GCS_BUCKET_NAME이 설정되지 않았습니다. .env 파일에 GCS_BUCKET_NAME=medreport-vision-ocr-bucket을 추가하세요.' },
  { name: 'GCS_UPLOAD_PREFIX', value: process.env.GCS_UPLOAD_PREFIX, defaultValue: 'temp-uploads/', isOptional: true }
];

const visionRequired = process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION === 'true';
if (visionRequired) {
  requiredEnvVars.push({ 
    name: 'GOOGLE_CLOUD_VISION_API_KEY', 
    value: process.env.GOOGLE_CLOUD_VISION_API_KEY, 
    errorMsg: '환경변수 GOOGLE_CLOUD_VISION_API_KEY가 없습니다. Vision OCR을 사용할 수 없습니다.',
    isOptional: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
  
  requiredEnvVars.push({
    name: 'GOOGLE_APPLICATION_CREDENTIALS',
    value: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    errorMsg: '환경변수 GOOGLE_APPLICATION_CREDENTIALS가 없습니다. Vision OCR을 사용할 수 없습니다.',
    isOptional: !!process.env.GOOGLE_CLOUD_VISION_API_KEY
  });
  
  console.log(`Google Vision OCR이 활성화되었습니다. 관련 환경변수 확인 중...`);
  console.log(`- ENABLE_VISION_OCR: ${process.env.ENABLE_VISION_OCR}`);
  console.log(`- USE_VISION: ${process.env.USE_VISION}`);
  console.log(`- GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`- GOOGLE_CLOUD_VISION_API_KEY: ${process.env.GOOGLE_CLOUD_VISION_API_KEY ? '✅ 설정됨' : '❌ 미설정'}`);
}

// 필수 환경변수 검증
let missingVars = [];
for (const envVar of requiredEnvVars) {
  if (!envVar.value && !envVar.isOptional) {
    missingVars.push(envVar.name);
    console.error(`❌ ${envVar.errorMsg || `환경변수 ${envVar.name}이(가) 설정되지 않았습니다.`}`);
  } else if (!envVar.value && envVar.defaultValue) {
    // 기본값 설정
    process.env[envVar.name] = envVar.defaultValue;
    console.warn(`⚠️ 환경변수 ${envVar.name}이(가) 설정되지 않아 기본값 '${envVar.defaultValue}'로 설정합니다.`);
  }
}

// 필수 환경변수가 누락된 경우 서버 시작 중단
if (missingVars.length > 0) {
  const error = new Error(`필수 환경변수가 누락되었습니다: ${missingVars.join(', ')}`);
  console.error(`❌ 서버를 시작할 수 없습니다. 환경변수를 확인하세요.`);
  console.error(`❌ .env 파일이 존재하는지, 필요한 환경변수가 모두 설정되어 있는지 확인하세요.`);
  process.exit(1);
}

// 환경 변수 로드 상태 출력
console.log('✅ 환경 변수 검증 완료. 필수 환경변수가 모두 설정되었습니다.');
console.log('환경 변수 로드 상태:');
const envVars = {
  'PORT': process.env.PORT,
  'NODE_ENV': process.env.NODE_ENV,
  'ENABLE_VISION_OCR': process.env.ENABLE_VISION_OCR,
  'USE_VISION': process.env.USE_VISION,
  'GCS_BUCKET_NAME': process.env.GCS_BUCKET_NAME,
  'GCS_UPLOAD_PREFIX': process.env.GCS_UPLOAD_PREFIX,
  'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  'GOOGLE_CLOUD_VISION_API_KEY': process.env.GOOGLE_CLOUD_VISION_API_KEY ? '설정됨' : '설정되지 않음',
  'GCP_PROJECT_ID': process.env.GCP_PROJECT_ID
};

Object.entries(envVars).forEach(([key, value]) => {
  console.log(`- ${key}: ${value}`);
});

// Vision API 관련 설정 검증
if (process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION === 'true') {
  const hasCredentialsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const hasApiKey = !!process.env.GOOGLE_CLOUD_VISION_API_KEY;
  
  if (!hasCredentialsFile && !hasApiKey) {
    console.error('⚠️ 경고: Vision API 인증 정보가 없습니다.');
    console.error('다음 중 하나를 .env 파일에 설정해주세요:');
    console.error('1. GOOGLE_APPLICATION_CREDENTIALS=서비스계정키파일경로');
    console.error('2. GOOGLE_CLOUD_VISION_API_KEY=API키');
  } else {
    if (hasCredentialsFile) {
      console.log(`✅ Vision API 서비스 계정 키 파일 확인됨: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
      console.log(`   파일 크기: ${(fs.statSync(process.env.GOOGLE_APPLICATION_CREDENTIALS).size / 1024).toFixed(2)} KB`);
    }
    if (hasApiKey) {
      console.log('✅ Vision API 키가 설정되어 있습니다.');
    }
  }
}

// 콘솔 로그에 타임스탬프 추가
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

function getTimestamp() {
  return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

console.log = function() {
  const args = Array.from(arguments);
  originalLog.apply(console, [`[${getTimestamp()}]`, ...args]);
};

console.error = function() {
  const args = Array.from(arguments);
  originalError.apply(console, [`[${getTimestamp()}][ERROR]`, ...args]);
};

console.warn = function() {
  const args = Array.from(arguments);
  originalWarn.apply(console, [`[${getTimestamp()}][WARN]`, ...args]);
};

console.info = function() {
  const args = Array.from(arguments);
  originalInfo.apply(console, [`[${getTimestamp()}][INFO]`, ...args]);
};

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정 (개발 환경에서는 모든 출처 허용)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.CORS_ORIGIN || 'http://localhost:5173']
    : '*', // 개발 환경에서는 모든 출처 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

console.log(`CORS 설정: ${process.env.NODE_ENV === 'production' ? '허용 출처 - ' + (process.env.CORS_ORIGIN || 'http://localhost:5173') : '모든 출처 허용'}`);

// body-parser 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (프론트엔드)
app.use(express.static(path.join(__dirname, '../frontend')));

// API 라우트 설정
app.use('/api/ocr', ocrRoutes);

// 기본 라우트 (프론트엔드 인덱스 페이지)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 그 외 경로는 API 문서로 리다이렉트
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.redirect('/');
  } else {
    res.status(404).json({ error: '존재하지 않는 API 경로입니다.' });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`======================================`);
  console.log(`OCR 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}`);
  
  // 환경 변수 로드 확인
  console.log(`\n[환경 변수 설정 상태]`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`- OCR 설정:`);
  console.log(`  - ENABLE_VISION_OCR: ${process.env.ENABLE_VISION_OCR}`);
  console.log(`  - USE_VISION: ${process.env.USE_VISION}`);
  console.log(`  - USE_TEXTRACT: ${process.env.USE_TEXTRACT}`);
  console.log(`- API 키/인증 설정:`);
  console.log(`  - GOOGLE_APPLICATION_CREDENTIALS 설정됨: ${!!process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  console.log(`  - GOOGLE_CLOUD_VISION_API_KEY 설정됨: ${!!process.env.GOOGLE_CLOUD_VISION_API_KEY}`);
  console.log(`  - GCS_BUCKET: ${process.env.GCS_BUCKET}`);
  console.log(`  - GCP_PROJECT_ID: ${process.env.GCP_PROJECT_ID}`);
  console.log(`- API 경로:`);
  console.log(`  - 파일 업로드: POST http://localhost:${PORT}/api/ocr/upload`);
  console.log(`  - 상태 확인: GET http://localhost:${PORT}/api/ocr/status/:jobId`);
  console.log(`  - 결과 조회: GET http://localhost:${PORT}/api/ocr/result/:jobId`);
  console.log(`======================================`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[오류] 포트 ${PORT}가 이미 사용 중입니다!`);
    console.error('다른 프로세스가 이 포트를 사용하고 있을 수 있습니다.');
    console.error('해결 방법:');
    console.error(`1. 다른 포트 사용: .env 파일에서 PORT 값을 변경하세요 (현재 ${PORT})`);
    console.error(`2. 포트 강제 종료: 'npx kill-port ${PORT}' 명령어 실행 후 다시 시도`);
    console.error(`3. 프로세스 수동 종료: 작업 관리자에서 해당 포트를 사용하는 Node.js 프로세스 종료\n`);
  } else {
    console.error(`\n[오류] 서버 시작 실패: ${err.message}\n`);
  }
  
  // 서버 시작 실패 시 종료
  process.exit(1);
});

// 예외 처리
process.on('uncaughtException', (err) => {
  console.error('예상치 못한 예외 발생:', err);
  // 프로세스 종료 방지
});

export default app; 