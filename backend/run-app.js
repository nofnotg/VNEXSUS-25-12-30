// 환경 변수 설정
process.env.NODE_ENV = 'development';
process.env.PORT = '3031';
process.env.ENABLE_VISION_OCR = 'true';
process.env.USE_VISION = 'true';
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\VisionKeys\\medreport-assistant-e4e428ceaad0.json';
process.env.GCS_BUCKET_NAME = 'medreport-vision-ocr-bucket';
process.env.GCS_UPLOAD_PREFIX = 'temp-uploads/';
process.env.OPENAI_API_KEY = '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';
process.env.OPENAI_PROJECT_ID = 'proj_KSOcTWfSoKn4vbmvdDc3NxzL';
process.env.SKIP_PDF_TESTS = 'true';

console.log('🚀 환경 변수 설정 완료, app.js 시작 중...');

// app.js 임포트 및 실행
import('./app.js').then(() => {
  console.log('✅ app.js 로드 완료');
}).catch(error => {
  console.error('❌ app.js 로드 실패:', error);
  process.exit(1);
}); 