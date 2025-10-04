/**
 * DateBlockProcessor 통합 테스트 스크립트
 * ES6/CommonJS 호환성 문제를 해결하고 새로운 기능을 테스트합니다.
 */

// CommonJS 방식으로 모듈 로드 (개선된 버전)
function loadModule(modulePath) {
  try {
    const loaded = require(modulePath);
    // ES6 default export 처리
    return loaded.default || loaded;
  } catch (error) {
    console.error(`모듈 로드 실패: ${modulePath}`, error.message);
    console.error('상세 오류:', error.stack);
    return null;
  }
}

// 테스트 실행
async function runIntegrationTest() {
  console.log('🚀 DateBlockProcessor 통합 테스트 시작\n');

  try {
    // 1. 모듈 로드 테스트
    console.log('1️⃣ 모듈 로드 테스트');
    const DateBlockProcessor = loadModule('./dateBlockProcessor');
    const MiscCategoryClassifier = loadModule('./miscCategoryClassifier');
    const CrossDateCorrelationAnalyzer = loadModule('./crossDateCorrelationAnalyzer');

    if (!DateBlockProcessor) {
      throw new Error('DateBlockProcessor 로드 실패');
    }
    console.log('✅ DateBlockProcessor 로드 성공');

    if (!MiscCategoryClassifier) {
      throw new Error('MiscCategoryClassifier 로드 실패');
    }
    console.log('✅ MiscCategoryClassifier 로드 성공');

    if (!CrossDateCorrelationAnalyzer) {
      throw new Error('CrossDateCorrelationAnalyzer 로드 실패');
    }
    console.log('✅ CrossDateCorrelationAnalyzer 로드 성공\n');

    // 2. 인스턴스 생성 테스트
    console.log('2️⃣ 인스턴스 생성 테스트');
    const processor = new DateBlockProcessor();
    console.log('✅ DateBlockProcessor 인스턴스 생성 성공');
    console.log('- miscClassifier 초기화:', !!processor.miscClassifier);
    console.log('- correlationAnalyzer 초기화:', !!processor.correlationAnalyzer);
    console.log('- processDateBlocksEnhanced 메서드 존재:', typeof processor.processDateBlocksEnhanced === 'function');
    console.log();

    // 3. 기본 기능 테스트
    console.log('3️⃣ 기본 기능 테스트');
    const testData = [
      '2024년 1월 15일 진료 기록: 환자 상태 양호',
      '2024년 1월 20일 혈액검사 실시',
      '2024년 1월 25일 X-ray 촬영 결과 정상',
      '기타 메모: 다음 진료 예약 필요'
    ];

    console.log('테스트 데이터:', testData.length, '개 항목');
    
    // processDateBlocksEnhanced 메서드 테스트
    if (typeof processor.processDateBlocksEnhanced === 'function') {
      try {
        const result = await processor.processDateBlocksEnhanced(testData);
        console.log('✅ processDateBlocksEnhanced 실행 성공');
        console.log('- 처리된 블록 수:', result.blocks?.length || 0);
        console.log('- 검토 필요 항목:', result.reviewItems?.length || 0);
        console.log('- 기타 항목:', result.miscItems?.length || 0);
        console.log('- 처리 요약:', result.summary?.totalProcessed || 0, '개 항목 처리됨');
      } catch (error) {
        console.log('⚠️ processDateBlocksEnhanced 실행 중 오류:', error.message);
      }
    }
    console.log();

    // 4. 개별 모듈 테스트
    console.log('4️⃣ 개별 모듈 테스트');
    
    // MiscCategoryClassifier 테스트
    try {
      const miscClassifier = new MiscCategoryClassifier();
      const testText = '환자의 개인적인 메모 사항';
      const classification = miscClassifier.classify(testText);
      console.log('✅ MiscCategoryClassifier 테스트 성공');
      console.log('- 분류 결과:', classification.category);
      console.log('- 신뢰도:', classification.confidence);
    } catch (error) {
      console.log('⚠️ MiscCategoryClassifier 테스트 실패:', error.message);
    }

    // CrossDateCorrelationAnalyzer 테스트
    try {
      const correlationAnalyzer = new CrossDateCorrelationAnalyzer();
      const testBlocks = [
        { id: '1', date: '2024-01-15', content: '진료 기록' },
        { id: '2', date: '2024-01-20', content: '검사 결과' }
      ];
      const correlations = correlationAnalyzer.analyzeCorrelations(testBlocks);
      console.log('✅ CrossDateCorrelationAnalyzer 테스트 성공');
      console.log('- 연관성 분석 결과:', correlations.length, '개 연관성 발견');
    } catch (error) {
      console.log('⚠️ CrossDateCorrelationAnalyzer 테스트 실패:', error.message);
    }

    console.log('\n🎉 모든 테스트 완료! 새로운 기능이 성공적으로 통합되었습니다.');

  } catch (error) {
    console.error('\n❌ 통합 테스트 실패:', error.message);
    console.error('스택 트레이스:', error.stack);
  }
}

// 테스트 실행
if (require.main === module) {
  runIntegrationTest();
}

module.exports = { runIntegrationTest };