import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as visionService from './services/visionService.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3030;

// 환경 변수 설정
process.env.ENABLE_VISION_OCR = 'true';
process.env.USE_VISION = 'true';

// CORS 설정
app.use(cors({
  origin: true,
  credentials: true
}));

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/config', express.static(path.join(__dirname, 'public/config')));
app.use('/reports', express.static(path.join(__dirname, '../temp/reports')));

// favicon 요청 처리
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 메모리 기반 파일 업로드
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10
  }
});

// 작업 저장소 (메모리 기반 - 프로덕션에서는 Redis 등 사용)
const jobs = new Map();
let jobIdCounter = 1;

// 기본 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    visionOcr: process.env.ENABLE_VISION_OCR === 'true',
    credentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    activeJobs: jobs.size
  });
});

// OCR 업로드 엔드포인트
app.post('/api/ocr/upload', upload.array('files', 10), async (req, res) => {
  try {
    console.log('📁 OCR 업로드 요청:', req.files?.length, '개 파일');

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '업로드된 파일이 없습니다.'
      });
    }

    // 작업 ID 생성
    const jobId = `job_${jobIdCounter++}_${Date.now()}`;

    // 작업 정보 저장
    const job = {
      id: jobId,
      status: 'processing',
      files: req.files.map(f => f.originalname),
      createdAt: new Date().toISOString(),
      progress: 0,
      results: []
    };

    jobs.set(jobId, job);

    // 비동기 처리 시작
    processFiles(jobId, req.files).catch(error => {
      console.error(`❌ Job ${jobId} 처리 실패:`, error);
      const failedJob = jobs.get(jobId);
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.error = error.message;
      }
    });

    // 즉시 응답
    res.json({
      success: true,
      jobId: jobId,
      message: `${req.files.length}개 파일 처리 시작`,
      filesCount: req.files.length
    });

  } catch (error) {
    console.error('❌ 업로드 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 파일 처리 함수
async function processFiles(jobId, files) {
  const job = jobs.get(jobId);
  if (!job) return;

  console.log(`🔄 Job ${jobId} 처리 시작: ${files.length}개 파일`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      console.log(`📄 처리 중 [${i+1}/${files.length}]: ${file.originalname}`);

      let extractedText = '';
      let blocks = [];

      if (file.mimetype === 'application/pdf') {
        // PDF 처리 - 임시 파일로 저장 후 처리
        const tmpPath = `/tmp/pdf_${Date.now()}_${file.originalname}`;
        await fs.writeFile(tmpPath, file.buffer);

        try {
          const result = await visionService.processPdfFile(tmpPath);

          if (result && result.success) {
            extractedText = result.fullText || '';
            blocks = result.blocks || [];
          } else {
            throw new Error(result?.error || 'PDF 처리 실패');
          }
        } finally {
          // 임시 파일 삭제
          await fs.unlink(tmpPath).catch(() => {});
        }
      } else if (file.mimetype.startsWith('image/')) {
        // 이미지 처리
        const result = await visionService.extractTextFromImage(file.buffer);

        if (result && result.success) {
          extractedText = result.fullText || result.text || '';
          blocks = result.blocks || [];
        } else {
          throw new Error(result?.error || '이미지 처리 실패');
        }
      } else {
        throw new Error('지원하지 않는 파일 형식');
      }

      job.results.push({
        filename: file.originalname,
        success: true,
        extractedText: extractedText,
        blocks: blocks,
        textLength: extractedText.length,
        blockCount: blocks.length
      });

      console.log(`✅ ${file.originalname} 처리 완료 (${extractedText.length}자, ${blocks.length}블록)`);

    } catch (error) {
      console.error(`❌ ${file.originalname} 처리 실패:`, error.message);
      job.results.push({
        filename: file.originalname,
        success: false,
        error: error.message
      });
    }

    // 진행률 업데이트
    job.progress = Math.round(((i + 1) / files.length) * 100);
  }

  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  console.log(`✅ Job ${jobId} 완료`);
}

// 작업 상태 확인
app.get('/api/ocr/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: '작업을 찾을 수 없습니다.'
    });
  }

  res.json({
    success: true,
    status: job.status,
    progress: job.progress,
    filesCount: job.files.length,
    completedCount: job.results.length
  });
});

// 작업 결과 조회
app.get('/api/ocr/result/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: '작업을 찾을 수 없습니다.'
    });
  }

  // 전체 텍스트 결합
  const combinedText = job.results
    .filter(r => r.success)
    .map(r => r.extractedText)
    .join('\n\n');

  // 전체 블록 결합
  const allBlocks = job.results
    .filter(r => r.success && r.blocks)
    .flatMap(r => r.blocks);

  res.json({
    success: true,
    status: job.status,
    jobId: jobId,
    extractedText: combinedText,
    fullText: combinedText,
    blocks: allBlocks,
    files: job.results,
    metadata: {
      filesCount: job.files.length,
      successCount: job.results.filter(r => r.success).length,
      failedCount: job.results.filter(r => !r.success).length,
      totalChars: combinedText.length,
      totalBlocks: allBlocks.length,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    }
  });
});

// 모니터링 메트릭
app.get('/api/monitoring/metrics', (req, res) => {
  const metrics = {
    totalJobs: jobs.size,
    activeJobs: Array.from(jobs.values()).filter(j => j.status === 'processing').length,
    completedJobs: Array.from(jobs.values()).filter(j => j.status === 'completed').length,
    failedJobs: Array.from(jobs.values()).filter(j => j.status === 'failed').length,
    timestamp: new Date().toISOString()
  };

  res.json(metrics);
});

// 보고서 생성 (기본 구현)
app.post('/api/generate-report', express.json(), (req, res) => {
  console.log('📊 보고서 생성 요청');

  res.json({
    success: true,
    report: {
      title: '의료 문서 분석 보고서',
      generated: new Date().toISOString(),
      summary: '보고서 생성 기능은 현재 개발 중입니다.',
      data: req.body
    }
  });
});

// 후처리 API (기본 구현)
app.post('/api/postprocess', express.json(), (req, res) => {
  console.log('🔄 후처리 요청');

  res.json({
    success: true,
    processed: true,
    data: req.body
  });
});

// 404 처리
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.url}`);

  if (req.url.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js)$/i)) {
    return res.status(204).end();
  }

  res.status(404).json({
    success: false,
    error: `존재하지 않는 경로입니다: ${req.url}`
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`
======================================
🏥 VNEXSUS 의료 문서 분석 시스템
======================================
포트: ${PORT}
주소: http://localhost:${PORT}
Vision OCR: ${process.env.ENABLE_VISION_OCR}
======================================
사용 가능한 엔드포인트:
  POST /api/ocr/upload - 파일 업로드
  GET  /api/ocr/status/:jobId - 작업 상태
  GET  /api/ocr/result/:jobId - 결과 조회
  GET  /api/monitoring/metrics - 모니터링
  POST /api/generate-report - 보고서 생성
  POST /api/postprocess - 후처리
======================================
  `);
});

export default app;
