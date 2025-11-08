import { ResultMerger } from './backend/services/resultMerger.js';

console.log('=== ResultMerger 디버깅 테스트 ===');

// 테스트 데이터 생성
const mockDateResult = {
  success: true,
  dates: ['2024-12-15', '2024-12-16'],
  extractedDates: [
    { date: '2024-12-15', confidence: 0.9 },
    { date: '2024-12-16', confidence: 0.8 }
  ],
  hybrid: {
    confidence: 0.85,
    processingMode: 'hybrid',
    processingTime: 150
  },
  confidence: 0.85
};

const mockNormalizationResult = {
  success: true,
  dates: ['2024-12-15'],
  extractedDates: [
    { date: '2024-12-15', confidence: 0.7 }
  ],
  confidence: 0.7
};

async function testResultMerger() {
  try {
    console.log('\n1. ResultMerger 초기화...');
    const merger = new ResultMerger({
      mergeStrategy: 'confidence',
      enableValidation: false,
      enableABTesting: false
    });

    console.log('\n2. 입력 데이터 확인:');
    console.log('dateResult.dates:', mockDateResult.dates);
    console.log('dateResult.extractedDates:', mockDateResult.extractedDates);
    console.log('normalizationResult.dates:', mockNormalizationResult.dates);
    console.log('normalizationResult.extractedDates:', mockNormalizationResult.extractedDates);

    console.log('\n3. 신뢰도 추출 테스트:');
    const dateConfidence = merger.extractConfidence(mockDateResult);
    const normalizationConfidence = merger.extractConfidence(mockNormalizationResult);
    console.log('dateConfidence:', dateConfidence);
    console.log('normalizationConfidence:', normalizationConfidence);

    console.log('\n4. 결과 병합 수행...');
    const mergedResult = await merger.mergeResults(mockDateResult, mockNormalizationResult);

    console.log('\n5. 병합 결과 분석:');
    console.log('mergedResult.dates:', mergedResult.dates);
    console.log('mergedResult.dates 길이:', mergedResult.dates?.length || 0);
    console.log('mergedResult.primaryDateSource:', mergedResult.primaryDateSource);
    console.log('mergedResult.merge.confidenceScore:', mergedResult.merge?.confidenceScore);

    console.log('\n6. 전체 병합 결과:');
    console.log(JSON.stringify(mergedResult, null, 2));

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error('스택 트레이스:', error.stack);
  }
}

// 빈 결과 테스트
async function testEmptyResults() {
  console.log('\n=== 빈 결과 테스트 ===');
  
  const emptyDateResult = {
    success: true,
    dates: [],
    extractedDates: [],
    confidence: 0.5
  };

  const emptyNormalizationResult = {
    success: true,
    dates: [],
    extractedDates: [],
    confidence: 0.5
  };

  try {
    const merger = new ResultMerger();
    const result = await merger.mergeResults(emptyDateResult, emptyNormalizationResult);
    
    console.log('빈 결과 병합:');
    console.log('result.dates:', result.dates);
    console.log('result.dates 길이:', result.dates?.length || 0);
    
  } catch (error) {
    console.error('빈 결과 테스트 실패:', error.message);
  }
}

// 실행
testResultMerger().then(() => {
  return testEmptyResults();
}).then(() => {
  console.log('\n=== 디버깅 테스트 완료 ===');
});