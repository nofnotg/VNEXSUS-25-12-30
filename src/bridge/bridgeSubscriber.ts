import {PubSub} from '@google-cloud/pubsub';
import {handleOcrResult} from '../modules/ocrParser';

// 시작 로그
console.log('📨  PubSub Bridge Subscriber 초기화 중...');
console.log('📨  Google Cloud 설정:');
console.log('- GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID || 'medreport-vision-ocr');
console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

// PubSub 설정
const subId = process.env.PUBSUB_SUB_ID ?? 'ocr-result-sub';
const projectId = process.env.GCP_PROJECT_ID || 'medreport-vision-ocr';

try {
  console.log('📨  PubSub 클라이언트 초기화 중...');
  const pubsub = new PubSub({projectId});
  console.log('📨  PubSub 클라이언트 초기화 완료');
  
  console.log(`📨  서브스크립션 '${subId}' 연결 중...`);
  const sub = pubsub.subscription(subId);
  
  console.log(`📨  Sub connected: ${subId}`);
  console.log('메시지 수신 대기 중... Ctrl+C로 종료');
  
  sub.on('message', async m => {
    console.log('📨  OCR JSON → Parser', m.id);
    try {
      await handleOcrResult(JSON.parse(m.data.toString()));
      console.log('📨  메시지 처리 완료:', m.id);
    } catch (err) {
      console.error('📨  메시지 처리 오류:', err);
    } finally {
      m.ack();
    }
  });
  
  sub.on('error', (err) => {
    console.error('📨  PubSub 에러:', err);
  });
} catch (err) {
  console.error('📨  PubSub 초기화 오류:', err);
  console.error('📨  상세 오류 정보:', JSON.stringify(err, null, 2));
}