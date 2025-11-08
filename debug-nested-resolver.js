import { NestedDateResolver } from './src/dna-engine/core/nestedDateResolver.js';

console.log('=== NestedDateResolver 단독 테스트 ===');

const resolver = new NestedDateResolver();
const testText = '환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.';

console.log('입력 텍스트:', testText);

// 타임아웃 설정 (10초)
const timeout = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('NestedDateResolver 타임아웃 (10초)')), 10000);
});

const resolverTest = resolver.resolveNestedDates(testText, {});

Promise.race([resolverTest, timeout])
  .then(result => {
    console.log('\n=== NestedDateResolver 결과 ===');
    console.log('성공:', result.success);
    console.log('처리 시간:', result.processingTime + 'ms');
    
    if (result.success) {
      console.log('추출된 날짜 표현:', result.extracted?.rawExpressions?.length || 0);
      console.log('정규화된 날짜:', result.extracted?.normalizedDates?.length || 0);
      console.log('해결된 날짜:', result.resolved?.dates?.length || 0);
      
      if (result.resolved?.dates?.length > 0) {
        console.log('첫 번째 해결된 날짜:', JSON.stringify(result.resolved.dates[0], null, 2));
      }
    } else {
      console.log('오류:', result.error);
    }
  })
  .catch(error => {
    console.error('❌ NestedDateResolver 실패:', error.message);
    
    // 타임아웃 발생 시 대안 테스트
    if (error.message.includes('타임아웃')) {
      console.log('\n=== 대안: 직접 날짜 추출 테스트 ===');
      try {
        const expressions = resolver.extractDateExpressions(testText);
        console.log('직접 추출된 날짜 표현:', expressions.length);
        if (expressions.length > 0) {
          console.log('첫 번째 표현:', JSON.stringify(expressions[0], null, 2));
        }
      } catch (directError) {
        console.error('직접 추출도 실패:', directError.message);
      }
    }
  });