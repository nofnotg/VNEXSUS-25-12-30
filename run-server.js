// run-server.js - Node.js 서버 실행 도우미 스크립트
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('PDF OCR 서버를 시작합니다...');
console.log('백엔드 디렉토리: ', path.join(__dirname, 'backend'));

// PDF-parse 테스트 비활성화를 위한 환경 변수 설정
process.env.NODE_ENV = 'production'; // 프로덕션 모드에서는 테스트가 실행되지 않음
process.env.SKIP_PDF_TESTS = 'true'; // 커스텀 환경 변수 추가

// 에러 로그 파일 설정 (ANOMALY 경고를 파일로 리다이렉트)
const errorLogPath = path.join(__dirname, 'error.log');
const errorStream = fs.createWriteStream(errorLogPath, { flags: 'a' });

// 백엔드 앱 실행
const nodeProcess = spawn('node', ['app.js'], {
  cwd: path.join(__dirname, 'backend'),
  // ANOMALY 경고는 표준 에러(stderr)로 출력되므로, stdio 설정 커스터마이징
  stdio: ['inherit', 'inherit', 'pipe'], // stdin과 stdout은 그대로, stderr만 별도 처리
  env: {
    ...process.env,
    NODE_ENV: 'production',
    SKIP_PDF_TESTS: 'true',
    // 디버그 경고 레벨 조정 (심각한 에러만 표시)
    NODE_DEBUG_LEVEL: 'error',
    // 올바른 Google Cloud 서비스 계정 키 경로 설정
    GOOGLE_APPLICATION_CREDENTIALS: 'C:\\VisionKeys\\medreport-assistant-e4e428ceaad0.json',
    // Feature Flags
    ENABLE_INVESTIGATOR_VIEW: 'true',
    USE_CORE_ENGINE: 'true',
    ENABLE_PROGRESSIVE_RAG: 'true'
  }
});

// 표준 에러 스트림 처리
nodeProcess.stderr.on('data', (data) => {
  const errorText = data.toString();
  // 'ANOMALY' 경고만 필터링하여 로그 파일로 리다이렉트
  if (errorText.includes('ANOMALY')) {
    errorStream.write(`[${new Date().toISOString()}] ${errorText}`);
  } else {
    // 실제 에러는 콘솔에 출력
    process.stderr.write(errorText);
  }
});

nodeProcess.on('error', (err) => {
  console.error('서버 실행 오류:', err);
});

nodeProcess.on('close', (code) => {
  console.log(`서버 프로세스가 코드 ${code}로 종료되었습니다.`);
  errorStream.end();
});

// 프로세스 종료 처리
process.on('SIGINT', () => {
  console.log('서버를 종료합니다...');
  nodeProcess.kill('SIGINT');
  errorStream.end();
  process.exit(0);
});