import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB 제한
  }
});

// Enhanced OCR 처리 엔드포인트
router.post('/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '파일이 업로드되지 않았습니다.' 
      });
    }

    // 기본 OCR 처리 로직 (향후 확장 가능)
    const result = {
      success: true,
      message: 'Enhanced OCR 처리가 완료되었습니다.',
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    };

    res.json(result);
  } catch (error) {
    console.error('Enhanced OCR 처리 오류:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Enhanced OCR 처리 중 오류가 발생했습니다.' 
    });
  }
});

// 상태 확인 엔드포인트
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Enhanced OCR 서비스가 정상적으로 작동 중입니다.',
    timestamp: new Date().toISOString()
  });
});

export default router;