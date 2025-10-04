import express from 'express';
import multer from 'multer';
import path from 'path';
import * as ocrController from '../controllers/ocrController.js';
import { logService } from '../utils/logger.js';
import { PubSub } from '@google-cloud/pubsub';
import cors from 'cors';

const router = express.Router();
const pubsub = new PubSub();
const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC || 'ocr-result';

// CORS 미들웨어 추가 - 모든 OCR 라우트에 적용
router.use(cors({
  origin: function(origin, callback) {
    // 허용할 출처 목록
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173', 
      'http://localhost:5174', 
      'http://localhost:5175', 
      'http://localhost:3030',
      'http://localhost:8080'
    ];
    
    // origin이 없거나 (서버 내부 요청) 허용된 출처인 경우
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(null, allowedOrigins[0]); // 기본값으로 첫 번째 허용 출처 사용
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// 메모리 스토리지 설정 (파일을 메모리에 저장)
const storage = multer.memoryStorage();

// 파일 필터링 함수 - PDF, 이미지 및 텍스트 파일 허용
const fileFilter = (req, file, cb) => {
  // 허용되는 MIME 타입 정의
  const allowedMimeTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'text/plain'
  ];
  
  // MIME 타입 검증
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('PDF, PNG, JPG, JPEG, TXT 파일만 업로드 가능합니다.'), false);
  }
  
  // 파일 확장자 검증
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.txt'];
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('PDF, PNG, JPG, JPEG, TXT 파일만 업로드 가능합니다.'), false);
  }
  
  // 허용
  cb(null, true);
};

// Multer 설정
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 100, // 100MB 제한
    files: 8 // 최대 8개 파일
  }
});

// 에러 핸들링 미들웨어
const uploadErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer 관련 에러 처리
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: '파일 크기가 너무 큽니다. 최대 100MB까지 허용됩니다.',
        status: 'error',
        code: 'FILE_TOO_LARGE'
      });
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: '너무 많은 파일이 업로드되었습니다. 최대 8개까지 허용됩니다.',
        status: 'error',
        code: 'TOO_MANY_FILES'
      });
    } else {
      return res.status(400).json({
        error: `파일 업로드 오류: ${err.message}`,
        status: 'error',
        code: 'UPLOAD_ERROR'
      });
    }
  } else if (err) {
    // 기타 에러
    return res.status(500).json({
      error: `파일 업로드 중 서버 오류: ${err.message}`,
      status: 'error',
      code: 'SERVER_ERROR'
    });
  }
  
  // 오류가 없으면 다음 미들웨어로
  next();
};

// OCR 결과를 파싱 큐로 전달하는 미들웨어
const publishToParsingQueue = async (req, res, next) => {
  try {
    // 원래 핸들러 호출
    await ocrController.uploadPdfs(req, res);
    
    // 응답에서 필요한 정보 추출
    const result = res.locals.ocrResult;
    
    if (result && result.id) {
      // PubSub 메시지 발행
      await pubsub.topic(PUBSUB_TOPIC).publishMessage({
        json: { fileId: result.id, ocrJson: result.jsonPath }
      });
      
      logService('ocrRoutes', `OCR 결과 파싱 큐로 전달됨: ${result.id}`, 'info');
    }
  } catch (error) {
    logService('ocrRoutes', `파싱 큐 전달 중 오류: ${error.message}`, 'error');
    // 오류가 발생해도 원래 응답은 보냄
    next();
  }
};

// 경로 정의
router.post('/upload', upload.array('files', 8), uploadErrorHandler, publishToParsingQueue);
router.get('/status/:jobId', ocrController.getStatus);
router.get('/result/:jobId', ocrController.getResult);
router.get('/service-status', ocrController.getOcrStatus);

export default router;