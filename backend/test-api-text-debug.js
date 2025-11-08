/**
 * API 파이프라인 텍스트 디버깅 테스트
 * API 호출 시 날짜 처리기로 전달되는 텍스트와 직접 테스트 텍스트를 비교
 */

import HybridDateProcessor from './postprocess/hybridDateProcessor.js';

// 테스트용 한국어 텍스트
const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";

async function debugApiTextProcessing() {
  console.log('=== API 텍스트 처리 디버깅 ===\n');
  
  try {
    // HybridDateProcessor 인스턴스 생성
    const dateProcessor = new HybridDateProcessor();
    
    console.log('1. 원본 테스트 텍스트:');
    console.log(`"${testText}"`);
    console.log(`텍스트 길이: ${testText.length}`);
    console.log(`텍스트 인코딩 체크: ${Buffer.from(testText, 'utf8').toString('utf8') === testText ? 'UTF-8 정상' : 'UTF-8 문제'}`);
    console.log();
    
    // 2. 직접 HybridDateProcessor 테스트
    console.log('2. 직접 HybridDateProcessor 테스트:');
    const directResult = await dateProcessor.processMassiveDateBlocks(testText, { processingMode: 'legacy' });
    console.log(`직접 테스트 결과 - dateBlocks: ${directResult.dateBlocks?.length || 0}`);
    if (directResult.dateBlocks?.length > 0) {
      console.log(`첫 번째 dateBlock: ${JSON.stringify(directResult.dateBlocks[0])}`);
    }
    console.log();
    
    // 3. API 요청 시뮬레이션 - JSON 파싱 과정 포함
    console.log('3. API 요청 시뮬레이션 (JSON 파싱 포함):');
    const apiRequestBody = JSON.stringify({ text: testText });
    console.log(`API 요청 JSON: ${apiRequestBody}`);
    
    const parsedBody = JSON.parse(apiRequestBody);
    const apiText = parsedBody.text;
    console.log(`파싱된 텍스트: "${apiText}"`);
    console.log(`파싱 후 텍스트 길이: ${apiText.length}`);
    console.log(`원본과 동일한지: ${testText === apiText ? '동일' : '다름'}`);
    console.log();
    
    // 4. 파싱된 텍스트로 HybridDateProcessor 테스트
    console.log('4. 파싱된 텍스트로 HybridDateProcessor 테스트:');
    const apiResult = await dateProcessor.processMassiveDateBlocks(apiText, { processingMode: 'legacy' });
    console.log(`API 시뮬레이션 결과 - dateBlocks: ${apiResult.dateBlocks?.length || 0}`);
    if (apiResult.dateBlocks?.length > 0) {
      console.log(`첫 번째 dateBlock: ${JSON.stringify(apiResult.dateBlocks[0])}`);
    }
    console.log();
    
    // 5. 문자별 비교 (차이점 찾기)
    console.log('5. 문자별 상세 비교:');
    if (testText !== apiText) {
      console.log('텍스트 차이점 발견!');
      for (let i = 0; i < Math.max(testText.length, apiText.length); i++) {
        const char1 = testText[i] || 'undefined';
        const char2 = apiText[i] || 'undefined';
        if (char1 !== char2) {
          console.log(`위치 ${i}: 원본="${char1}" (${char1.charCodeAt ? char1.charCodeAt(0) : 'N/A'}), 파싱="${char2}" (${char2.charCodeAt ? char2.charCodeAt(0) : 'N/A'})`);
        }
      }
    } else {
      console.log('텍스트 완전 동일');
    }
    
    // 6. 모든 처리 모드 테스트
    console.log('\n6. 모든 처리 모드 테스트:');
    const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
    
    for (const mode of modes) {
      try {
        const result = await dateProcessor.processMassiveDateBlocks(apiText, { processingMode: mode });
        console.log(`${mode} 모드: dateBlocks=${result.dateBlocks?.length || 0}, confidence=${result.confidence || 0}`);
        if (result.dateBlocks?.length > 0) {
          console.log(`  첫 번째 블록: ${JSON.stringify(result.dateBlocks[0])}`);
        }
      } catch (error) {
        console.log(`${mode} 모드 오류: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('디버깅 테스트 실행 중 오류:', error);
  }
}

// 테스트 실행
debugApiTextProcessing().then(() => {
  console.log('\n=== 디버깅 테스트 완료 ===');
}).catch(error => {
  console.error('테스트 실행 실패:', error);
});