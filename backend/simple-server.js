import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as visionService from './services/visionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3030;

// 환경 변수 설정
process.env.ENABLE_VISION_OCR = 'true';
process.env.USE_VISION = 'true';
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\VisionKeys\\medreport-assistant-e4e428ceaad0.json';
process.env.GCS_BUCKET_NAME = 'medreport-vision-ocr-bucket';
process.env.SKIP_PDF_TESTS = 'true';

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

// favicon 요청 처리 (404 방지)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 메모리 기반 파일 업로드
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 5
  }
});

// 기본 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 간단한 테스트 페이지
app.get('/simple-test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MediAI 간단 테스트</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="container mt-5">
            <h1 class="text-center mb-4">MediAI PDF 처리 테스트</h1>
            
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5>PDF 파일 업로드 및 처리</h5>
                        </div>
                        <div class="card-body">
                            <form id="uploadForm" enctype="multipart/form-data">
                                <div class="mb-3">
                                    <label for="fileInput" class="form-label">PDF 또는 이미지 파일 선택</label>
                                    <input type="file" class="form-control" id="fileInput" name="files" 
                                           accept=".pdf,.jpg,.jpeg,.png" multiple>
                                </div>
                                <button type="submit" class="btn btn-primary">처리 시작</button>
                            </form>
                            
                            <div id="loading" class="text-center mt-3" style="display: none;">
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">처리 중...</span>
                                </div>
                                <p class="mt-2">파일 처리 중입니다...</p>
                            </div>
                            
                            <div id="results" class="mt-4"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            document.getElementById('uploadForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const fileInput = document.getElementById('fileInput');
                const loading = document.getElementById('loading');
                const results = document.getElementById('results');
                
                if (fileInput.files.length === 0) {
                    alert('파일을 선택해주세요.');
                    return;
                }
                
                loading.style.display = 'block';
                results.innerHTML = '';
                
                const formData = new FormData();
                for (let file of fileInput.files) {
                    formData.append('files', file);
                }
                
                try {
                    const response = await fetch('/api/pdf-test', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    loading.style.display = 'none';
                    
                    if (result.success) {
                        let html = '<div class="alert alert-success">처리 완료!</div>';
                        
                        result.results.forEach((fileResult, index) => {
                            html += '<div class="card mt-3">';
                            html += '<div class="card-header"><strong>' + fileResult.filename + '</strong></div>';
                            html += '<div class="card-body">';
                            
                            if (fileResult.success) {
                                html += '<h6>추출된 텍스트:</h6>';
                                html += '<pre style="max-height: 300px; overflow-y: auto; background: #f8f9fa; padding: 1rem; border-radius: 5px;">';
                                html += fileResult.extractedText.substring(0, 1000);
                                if (fileResult.extractedText.length > 1000) {
                                    html += '...\\n\\n[텍스트가 길어서 일부만 표시됩니다]';
                                }
                                html += '</pre>';
                                html += '<p class="mt-2"><strong>텍스트 길이:</strong> ' + fileResult.extractedText.length + '자</p>';
                            } else {
                                html += '<div class="alert alert-danger">오류: ' + fileResult.error + '</div>';
                            }
                            
                            html += '</div></div>';
                        });
                        
                        results.innerHTML = html;
                    } else {
                        results.innerHTML = '<div class="alert alert-danger">처리 실패: ' + result.error + '</div>';
                    }
                    
                } catch (error) {
                    loading.style.display = 'none';
                    results.innerHTML = '<div class="alert alert-danger">요청 실패: ' + error.message + '</div>';
                }
            });
        </script>
    </body>
    </html>
  `);
});

// PDF 처리 API
app.post('/api/pdf-test', upload.array('files', 5), async (req, res) => {
  try {
    console.log('📁 PDF 처리 요청 받음:', req.files?.length, '개 파일');
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '업로드된 파일이 없습니다.'
      });
    }

    const results = [];
    
    for (const file of req.files) {
      console.log(`🔍 처리 중: ${file.originalname} (${file.mimetype})`);
      
      try {
        let extractedText = '';
        
        if (file.mimetype === 'application/pdf') {
          // PDF 처리
          console.log('📄 PDF 파일 Vision OCR 처리 중...');
          const result = await visionService.processDocumentBuffer(file.buffer, {
            fileName: file.originalname,
            mimeType: file.mimetype
          });
          
          if (result.success) {
            extractedText = result.extractedText || '';
          } else {
            throw new Error(result.error || 'PDF OCR 처리 실패');
          }
        } else if (file.mimetype.startsWith('image/')) {
          // 이미지 처리
          console.log('🖼️ 이미지 파일 Vision OCR 처리 중...');
          const result = await visionService.processImageBuffer(file.buffer);
          
          if (result.success) {
            extractedText = result.extractedText || '';
          } else {
            throw new Error(result.error || '이미지 OCR 처리 실패');
          }
        } else {
          throw new Error('지원하지 않는 파일 형식입니다.');
        }
        
        results.push({
          filename: file.originalname,
          success: true,
          extractedText: extractedText,
          textLength: extractedText.length
        });
        
        console.log(`✅ ${file.originalname} 처리 완료 (${extractedText.length}자)`);
        
      } catch (error) {
        console.error(`❌ ${file.originalname} 처리 실패:`, error.message);
        results.push({
          filename: file.originalname,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `${successCount}/${req.files.length} 파일 처리 완료`,
      results: results
    });
    
  } catch (error) {
    console.error('❌ 전체 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    visionOcr: process.env.ENABLE_VISION_OCR === 'true',
    credentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  });
});

// 404 처리 (로깅 포함)
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.url}`);
  
  // 이미지나 파비콘 요청은 204로 응답
  if (req.url.match(/\.(ico|png|jpg|jpeg|gif|svg)$/i)) {
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
MediAI 간단 테스트 서버 시작
======================================
포트: ${PORT}
주소: http://localhost:${PORT}
테스트 페이지: http://localhost:${PORT}/simple-test
Vision OCR: ${process.env.ENABLE_VISION_OCR}
인증 파일: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}
======================================
  `);
});

export default app; 