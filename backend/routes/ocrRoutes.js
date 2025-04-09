const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ocrController = require('../controllers/ocrController');

// 메모리 스토리지 설정 (파일을 메모리에 저장)
const storage = multer.memoryStorage();

// 파일 필터링 함수 - PDF 파일만 허용
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('PDF 파일만 업로드 가능합니다.'), false);
  }
};

// Multer 설정
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE_MB * 1024 * 1024, // MB를 바이트로 변환
    files: parseInt(process.env.MAX_FILES) || 8 // 최대 파일 개수
  }
});

// 경로 정의
router.post('/upload', upload.array('pdfs', 8), ocrController.uploadPdfs);
router.get('/status/:jobId', ocrController.getStatus);
router.get('/result/:jobId', ocrController.getResult);

module.exports = router; 