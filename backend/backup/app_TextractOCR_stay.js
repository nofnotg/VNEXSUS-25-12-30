import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import ocrRoutes from './routes/ocrRoutes.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

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

// 미들웨어 설정
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

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
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}`);
});

// 예외 처리
process.on('uncaughtException', (err) => {
  console.error('예상치 못한 예외 발생:', err);
  // 프로세스 종료 방지
});

export default app; 