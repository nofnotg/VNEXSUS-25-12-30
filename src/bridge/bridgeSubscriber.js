/**
 * Bridge Subscriber (Mock)
 * 
 * 역할: (테스트용) 가짜 Pub/Sub 메시지를 생성하고 처리하는 모듈
 */

import path from 'path';
import fs from 'fs';

// GCP 프로젝트 ID 설정
const projectId = process.env.GCP_PROJECT_ID || 'medreport-vision-ocr';
console.log(`🔧 GCP 프로젝트 ID: ${projectId}`);

// 시작 로그
console.log('📨 PubSub Bridge Subscriber (테스트 모드) 초기화 중...');

// outputs 디렉토리 확인 및 생성
const outputDir = path.resolve(process.cwd(), 'outputs');
if (!fs.existsSync(outputDir)) {
  console.log(`📂 outputs 디렉토리 생성: ${outputDir}`);
  fs.mkdirSync(outputDir, { recursive: true });
}

// 가짜 테스트 메시지
const testMessage = {
  id: 'test-' + Date.now(),
  data: Buffer.from(JSON.stringify({
    jobId: 'test-job-' + Date.now(),
    ocrText: `
      서울대학교병원
      진료일: 2022-05-15
      환자명: 홍길동
      진단명: 고혈압, 당뇨병
      
      처방:
      - 고혈압약 1일 1회
      - 당뇨약 1일 3회
      
      다음 진료 예약: 2022-06-15
    `,
    patientInfo: {
      name: '홍길동',
      enrollmentDate: '2022-01-01'
    }
  })),
  ack: () => console.log('메시지 처리 완료 (ack)')
};

// 샘플 엑셀 파일 생성 함수 (실제로는 생성하지 않음)
function createSampleReport() {
  const reportPath = path.join(outputDir, 'sample_report.xlsx');
  console.log(`📊 샘플 보고서 생성 완료: ${reportPath}`);
  return reportPath;
}

console.log('📨 테스트 모드로 실행 중...');
console.log('5초 후 가짜 메시지를 처리합니다...');

// 5초 후 가짜 메시지 처리
setTimeout(async () => {
  try {
    console.log(`📨 OCR JSON → Parser: ${testMessage.id}`);
    const payload = JSON.parse(testMessage.data.toString());
    
    // 처리 단계 로깅
    console.log('1. 메시지 수신됨: ', payload.jobId);
    console.log('2. OCR 텍스트 길이: ', payload.ocrText.length);
    console.log('3. 환자 정보: ', payload.patientInfo);
    
    // 샘플 보고서 생성 (가짜)
    const reportPath = createSampleReport();
    
    // 처리 완료
    testMessage.ack();
    
    // 이제 실제 Pub/Sub 구독을 시작할 수 있다는 안내
    console.log('\n📢 테스트 모드 실행 완료');
    console.log('실제 Google Cloud Pub/Sub 연결을 위해서는:');
    console.log(`1. GCP 프로젝트 ID 설정: process.env.GOOGLE_CLOUD_PROJECT="${projectId}"`);
    console.log('2. 인증 정보 설정: process.env.GOOGLE_APPLICATION_CREDENTIALS="path/to/keyfile.json"');
    console.log('3. Pub/Sub 토픽 및 구독 생성:');
    console.log(`   gcloud pubsub topics create ocr-result --project=${projectId}`);
    console.log(`   gcloud pubsub subscriptions create ocr-result-sub --topic=ocr-result --project=${projectId}`);
    
  } catch (error) {
    console.error('❌ 메시지 처리 중 오류:', error);
  }
}, 5000);

// 종료 처리
process.on('SIGINT', () => {
  console.log('👋 브릿지 구독자 종료 중...');
  process.exit(0);
}); 