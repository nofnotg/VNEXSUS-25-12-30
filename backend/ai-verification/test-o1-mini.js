/**
 * o1-mini 모델 단독 테스트 스크립트
 */

import AIVerificationSystem from './index.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: path.join(process.cwd(), '..', '..', '.env') });

async function testO1Mini() {
  console.log('🧠 o1-mini 모델 단독 테스트 시작...');
  
  // 환경 변수 확인
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  
  const verificationSystem = new AIVerificationSystem();
  
  // 테스트 케이스 1개만 로드
  const caseDataPath = path.join(process.cwd(), '..', '..', 'src', 'rag', 'case_sample');
  const caseFile = path.join(caseDataPath, 'case1.txt');
  
  try {
    const content = await fs.readFile(caseFile, 'utf8');
    const testCase = {
      id: 1,
      filename: 'case1.txt',
      content: content.trim(),
      size: content.length
    };
    
    console.log(`✅ Case 1 로드 완료 (${content.length} 문자)`);
    
    // o1-mini 단일 케이스 검증
    console.log('\n🔍 o1-mini 검증 시작...');
    const result = await verificationSystem.verifySingleCase('o1-mini', testCase, 1);
    
    console.log('\n✅ 검증 성공!');
    console.log('결과:', JSON.stringify(result, null, 2));
    
    // 결과 저장
    const resultsDir = path.join(process.cwd(), 'backend', 'ai-verification', 'results');
    await fs.mkdir(resultsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultFile = path.join(resultsDir, `o1-mini-test-${timestamp}.json`);
    
    await fs.writeFile(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      model: 'o1-mini',
      testCase: testCase,
      result: result,
      success: true
    }, null, 2));
    
    console.log(`\n💾 결과 저장: ${resultFile}`);
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error('스택 트레이스:', error.stack);
    
    // 실패 결과도 저장
    const resultsDir = path.join(process.cwd(), 'backend', 'ai-verification', 'results');
    await fs.mkdir(resultsDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultFile = path.join(resultsDir, `o1-mini-test-error-${timestamp}.json`);
    
    await fs.writeFile(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      model: 'o1-mini',
      error: error.message,
      stack: error.stack,
      success: false
    }, null, 2));
    
    console.log(`\n💾 오류 결과 저장: ${resultFile}`);
    throw error;
  }
}

// 스크립트 실행
testO1Mini().catch(error => {
  console.error('\n💥 전체 테스트 실패:', error.message);
  process.exit(1);
});