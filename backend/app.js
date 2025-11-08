import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import ocrRoutes from './routes/ocrRoutes.js';
import enhancedOcrRoutes from './routes/enhancedOcrRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import postProcessRoutes from './routes/postProcessRoutes.js';
import router from './routes/apiRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import dnaReportRoutes from './routes/dnaReportRoutes.js';
import enhancedDnaValidationRoutes from './routes/enhancedDnaValidationRoutes.js';
import coreEngineRoutes from './routes/coreEngineRoutes.js';
import enhancedCoreRoutes from './routes/enhancedCoreRoutes.js';
import devStudioRoutes from './routes/devStudioRoutes.js';
import devStudioIntegratedRoutes from './routes/devStudioIntegratedRoutes.js';
import alpProcessingRoutes from './routes/alp-processing.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';
// Advanced Date API (legacy v1 routes with /analyze, /performance, etc.)
import advancedDateRoutes from '../src/routes/advancedDateRoutes.js';
import monitoringRoutes from './routes/monitoring.js';
import caseAnalysisRouter from './routes/case-analysis.js';
import hybridRoutes from './routes/hybridRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import ragRoutes from './routes/ragRoutes.js';
import enhancedReportRoutes from './routes/enhancedReportRoute.js';
import * as visionService from './services/visionService.js';

// PDF 테스트 비활성화 (pdf-parse 모듈의 테스트 코드가 특정 PDF 파일을 찾지 못하는 문제 해결)
process.env.SKIP_PDF_TESTS = 'true';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv 로드
console.log('환경 변수를 로드합니다...');
dotenv.config({ path: path.join(__dirname, '../.env') });

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
  'GCP_PROJECT_ID': process.env.GCP_PROJECT_ID,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '설정됨' : '설정되지 않음'
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

// CORS 설정
app.use(cors({
  origin: [
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:8080', 'http://127.0.0.1:8080',
    'http://localhost:8081', 'http://127.0.0.1:8081',
    'http://localhost:3030'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

console.log(`CORS 설정: 개발 환경 - 특정 출처 허용 (localhost:5173, localhost:5174, localhost:3030, localhost:8080, localhost:8081)`);

// body-parser 미들웨어 설정
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 정적 파일 제공 (프론트엔드)
app.use(express.static(path.join(__dirname, '../frontend')));

// 설정 파일 접근 경로 설정 
app.use('/config', express.static(path.join(__dirname, 'public/config')));
app.use('/config', express.static(path.join(__dirname, '../src/config')));

// 임시 보고서 파일 접근 경로 설정
app.use('/reports', express.static(path.join(__dirname, '../temp/reports')));
app.use('/reports', express.static(path.join(__dirname, './temp/reports')));

// API 라우트 설정 (전체 활성화)
console.log('=== API 라우트 등록 시작 ===');
app.use('/api/ocr', (req, res, next) => {
  console.log(`OCR 라우트 요청: ${req.method} ${req.path}`);
  next();
}, ocrRoutes);
app.use('/api/enhanced-ocr', enhancedOcrRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/postprocess', postProcessRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/dna-report', dnaReportRoutes);
app.use('/api/enhanced-dna-validation', enhancedDnaValidationRoutes);
app.use('/api/core-engine', coreEngineRoutes);
app.use('/api/enhanced-core', enhancedCoreRoutes);
app.use('/api/dev/studio', devStudioRoutes);
app.use('/api/dev/studio', devStudioIntegratedRoutes);
app.use('/api/alp-processing', alpProcessingRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/advanced-date', advancedDateRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/case-analysis', caseAnalysisRouter);
app.use('/api/hybrid', hybridRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/enhanced-report', enhancedReportRoutes);
app.use('/api', router);

// API 상태 확인 라우트 추가
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    message: 'VNEXSUS OCR 서비스가 정상적으로 작동 중입니다.',
    timestamp: new Date().toISOString(),
    services: {
      ocr: 'active',
      vision: process.env.ENABLE_VISION_OCR === 'true' ? 'active' : 'inactive'
    }
  });
});

// 기본 라우트 (프론트엔드 인덱스 페이지)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 처리
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({ error: '존재하지 않는 API 경로입니다.' });
  }
});

// Vision OCR 서비스 초기화
function initializeVisionOcr() {
  if (process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION === 'true') {
    try {
      console.log('Vision OCR 서비스 초기화 중...');
      const visionStatus = visionService.initializeVision();
      
      if (visionStatus.success) {
        console.log('✅ Vision OCR 서비스 초기화 완료!');
        return true;
      } else {
        console.warn(`⚠️ Vision OCR 서비스 초기화 실패: ${visionStatus.error}`);
        console.warn('⚠️ OCR 기능이 제한될 수 있습니다.');
        return false;
      }
    } catch (error) {
      console.error(`❌ Vision OCR 서비스 초기화 중 오류 발생: ${error.message}`);
      console.warn('⚠️ OCR 기능이 제한될 수 있습니다.');
      return false;
    }
  } else {
    console.log('Vision OCR이 비활성화되어 있습니다. 필요시 .env 파일에서 설정하세요.');
    return false;
  }
}

// 서버 시작
app.listen(PORT, () => {
  console.log(`======================================`);
  console.log(`OCR 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}`);
  
  // Vision OCR 서비스 초기화
  const visionOcrInitialized = initializeVisionOcr();
  
  // 환경 변수 로드 확인
  console.log(`\n[환경 변수 설정 상태]`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`- OCR 설정:`);
  console.log(`  - ENABLE_VISION_OCR: ${process.env.ENABLE_VISION_OCR}`);
  console.log(`  - USE_VISION: ${process.env.USE_VISION}`);
  console.log(`  - USE_TEXTRACT: ${process.env.USE_TEXTRACT}`);
  console.log(`  - VISION OCR 초기화: ${visionOcrInitialized ? '✅ 성공' : '❌ 실패'}`);
  console.log(`- API 키/인증 설정:`);
  console.log(`  - GOOGLE_APPLICATION_CREDENTIALS 설정됨: ${!!process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
  console.log(`  - GOOGLE_CLOUD_VISION_API_KEY 설정됨: ${!!process.env.GOOGLE_CLOUD_VISION_API_KEY}`);
  console.log(`  - OPENAI_API_KEY 설정됨: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`  - GCS_BUCKET: ${process.env.GCS_BUCKET}`);
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
