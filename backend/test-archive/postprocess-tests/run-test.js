import MedicalNormalizerTester from './test-medical-normalizer.js';

console.log('🧪 의료 문서 정규화 테스트 시작...');

const tester = new MedicalNormalizerTester();

tester.runAllTests()
  .then(results => {
    console.log('\n🎉 테스트 완료!');
    console.log(`성공률: ${results.summary.successRate.toFixed(1)}%`);
    console.log(`전체 점수: ${results.summary.overallScore.toFixed(1)}/100`);
  })
  .catch(error => {
    console.error('테스트 실행 실패:', error);
    process.exit(1);
  });