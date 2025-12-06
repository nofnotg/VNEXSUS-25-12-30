/**
 * VNEXSUS 간소화 테스트 서버
 * 핵심 기능만 포함: OCR, Postprocess
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 핵심 라우트만 import
import ocrRoutes from './routes/ocrRoutes.js';
import postProcessRoutes from './routes/postProcessRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3030;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 제공 (프론트엔드)
app.use(express.static(path.join(__dirname, '../frontend')));

// API 라우트
app.use('/api/ocr', ocrRoutes);
app.use('/api/postprocess', postProcessRoutes);

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0-test',
    services: {
      ocr: 'active',
      postprocess: 'active'
    }
  });
});

// 루트 경로
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: '요청한 리소스를 찾을 수 없습니다.'
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 VNEXSUS 테스트 서버 시작');
  console.log('='.repeat(60));
  console.log(`📡 서버 주소: http://localhost:${PORT}`);
  console.log(`🏥 OCR API: http://localhost:${PORT}/api/ocr`);
  console.log(`⚙️  Postprocess API: http://localhost:${PORT}/api/postprocess`);
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60));
  console.log('✅ 서버가 정상적으로 시작되었습니다.');
  console.log('');
});

export default app;