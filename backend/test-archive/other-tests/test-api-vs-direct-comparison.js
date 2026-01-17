/**
 * API 호출 vs 직접 호출 비교 테스트
 * 동일한 텍스트로 API와 직접 호출의 결과를 비교하여 차이점을 분석
 */

import HybridDateProcessor from './postprocess/hybridDateProcessor.js';

// 테스트용 한국어 텍스트
const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";

async function compareApiVsDirect() {
  console.log('=== API vs 직접 호출 비교 테스트 ===\n');
  
  try {
    // 1. 직접 HybridDateProcessor 호출
    console.log('1. 직접 HybridDateProcessor 호출:');
    const dateProcessor = new HybridDateProcessor();
    
    const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
    const directResults = {};
    
    for (const mode of modes) {
      try {
        console.log(`\n--- ${mode} 모드 직접 테스트 ---`);
        console.log(`입력 텍스트: "${testText}"`);
        console.log(`텍스트 길이: ${testText.length}`);
        console.log(`텍스트 타입: ${typeof testText}`);
        
        const result = await dateProcessor.processMassiveDateBlocks(testText, { processingMode: mode });
        directResults[mode] = result;
        
        console.log(`결과 - dateBlocks: ${result.dateBlocks?.length || 0}`);
        console.log(`결과 - confidence: ${result.confidence || 0}`);
        console.log(`결과 - success: ${result.success}`);
        
        if (result.dateBlocks?.length > 0) {
          console.log(`첫 번째 dateBlock:`, JSON.stringify(result.dateBlocks[0], null, 2));
        }
        
        // 내부 처리 과정 디버깅
        console.log(`처리 방법: ${result.processingMethod || 'unknown'}`);
        console.log(`원본 크기: ${result.originalSize || 'unknown'}`);
        console.log(`처리된 크기: ${result.processedSize || 'unknown'}`);
        
      } catch (error) {
        console.error(`${mode} 모드 직접 테스트 오류:`, error.message);
        directResults[mode] = { error: error.message };
      }
    }
    
    // 2. API 호출 시뮬레이션
    console.log('\n\n2. API 호출 시뮬레이션:');
    
    // API 요청 본문 생성 (실제 API와 동일한 형식)
    const apiRequestBody = {
      document: {
        text: testText
      }
    };
    
    console.log('API 요청 본문:', JSON.stringify(apiRequestBody, null, 2));
    
    // JSON 직렬화/역직렬화 과정 시뮬레이션
    const serialized = JSON.stringify(apiRequestBody);
    const deserialized = JSON.parse(serialized);
    const apiText = deserialized.document.text;
    
    console.log(`\nAPI 텍스트 처리 과정:`);
    console.log(`원본: "${testText}"`);
    console.log(`직렬화: ${serialized}`);
    console.log(`역직렬화 후: "${apiText}"`);
    console.log(`텍스트 동일성: ${testText === apiText ? '동일' : '다름'}`);
    
    if (testText !== apiText) {
      console.log('\n텍스트 차이점 분석:');
      console.log(`원본 길이: ${testText.length}, API 길이: ${apiText.length}`);
      for (let i = 0; i < Math.max(testText.length, apiText.length); i++) {
        const char1 = testText[i];
        const char2 = apiText[i];
        if (char1 !== char2) {
          console.log(`위치 ${i}: 원본="${char1}" (${char1?.charCodeAt(0)}), API="${char2}" (${char2?.charCodeAt(0)})`);
        }
      }
    }
    
    // 3. API 텍스트로 직접 처리 테스트
    console.log('\n\n3. API 텍스트로 직접 처리 테스트:');
    const apiResults = {};
    
    for (const mode of modes) {
      try {
        console.log(`\n--- ${mode} 모드 API 텍스트 테스트 ---`);
        const result = await dateProcessor.processMassiveDateBlocks(apiText, { processingMode: mode });
        apiResults[mode] = result;
        
        console.log(`결과 - dateBlocks: ${result.dateBlocks?.length || 0}`);
        console.log(`결과 - confidence: ${result.confidence || 0}`);
        
        if (result.dateBlocks?.length > 0) {
          console.log(`첫 번째 dateBlock:`, JSON.stringify(result.dateBlocks[0], null, 2));
        }
        
      } catch (error) {
        console.error(`${mode} 모드 API 텍스트 테스트 오류:`, error.message);
        apiResults[mode] = { error: error.message };
      }
    }
    
    // 4. 결과 비교 분석
    console.log('\n\n4. 결과 비교 분석:');
    for (const mode of modes) {
      console.log(`\n--- ${mode} 모드 비교 ---`);
      const direct = directResults[mode];
      const api = apiResults[mode];
      
      if (direct.error || api.error) {
        console.log(`오류 발생 - 직접: ${direct.error || 'none'}, API: ${api.error || 'none'}`);
        continue;
      }
      
      const directBlocks = direct.dateBlocks?.length || 0;
      const apiBlocks = api.dateBlocks?.length || 0;
      
      console.log(`dateBlocks 개수 - 직접: ${directBlocks}, API: ${apiBlocks}`);
      console.log(`confidence - 직접: ${direct.confidence || 0}, API: ${api.confidence || 0}`);
      console.log(`결과 동일성: ${directBlocks === apiBlocks ? '동일' : '다름'}`);
      
      if (directBlocks !== apiBlocks) {
        console.log('⚠️ 결과 차이 발견!');
        console.log('직접 호출 결과:', JSON.stringify(direct, null, 2));
        console.log('API 호출 결과:', JSON.stringify(api, null, 2));
      }
    }
    
  } catch (error) {
    console.error('비교 테스트 실행 중 오류:', error);
  }
}

// 테스트 실행
compareApiVsDirect().then(() => {
  console.log('\n=== 비교 테스트 완료 ===');
}).catch(error => {
  console.error('테스트 실행 실패:', error);
});