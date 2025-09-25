/**
 * 의료 문서 시계열 처리 시스템 메인 진입점
 */

import bridgeSubscriber from './bridge/bridgeSubscriber';
import reportController from './controllers/reportController';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 환경 변수 설정
dotenv.config();

// 출력 디렉토리 확인 및 생성
const outputDir = path.resolve(process.cwd(), 'outputs');
if (!fs.existsSync(outputDir)) {
  console.log(`📂 outputs 디렉토리 생성: ${outputDir}`);
  fs.mkdirSync(outputDir, { recursive: true });
}

// 이벤트 핸들러 등록
bridgeSubscriber.on('parsed-done', async (data) => {
  console.log(`📝 파싱 완료 이벤트 수신: jobId=${data.jobId}, 이벤트 ${data.parsedEvents.length}개`);
  
  // 보고서 생성 컨트롤러로 전달
  const result = await reportController.generateReport(data);
  
  if (result.success) {
    console.log(`✅ 보고서 생성 성공: ${result.reportPath}`);
    console.log(`📊 통계: 총 ${result.stats.total}개, 필터링됨 ${result.stats.filtered}개`);
  } else {
    console.error(`❌ 보고서 생성 실패: ${result.error}`);
  }
});

// Pub/Sub 연결 시작
async function start() {
  try {
    console.log('🚀 의료 문서 시계열 처리 시스템 시작');
    
    // PubSub 브릿지 연결
    const connected = await bridgeSubscriber.connect();
    
    if (connected) {
      console.log('✅ Pub/Sub 연결 완료: 메시지 수신 대기 중...');
    } else {
      console.error('❌ Pub/Sub 연결 실패');
    }
  } catch (error) {
    console.error('❌ 시스템 시작 중 오류 발생:', error);
  }
}

// 프로세스 종료 처리
process.on('SIGINT', async () => {
  console.log('👋 시스템 종료 중...');
  bridgeSubscriber.disconnect();
  process.exit(0);
});

// 시스템 시작
start(); 