import { runAnalysis } from './scripts/comprehensive-pipeline-analyzer.js';

console.log('🚀 MediAI 12케이스 포괄적 분석 시작...');
console.log('⚠️  Rate Limit 안전모드 활성화');

runAnalysis()
  .then(results => {
    console.log('\n🎉 분석 완료!');
    console.log(`📊 성공: ${results.successfulCases}/${results.totalCases}케이스`);
    console.log(`📈 평균 품질: ${Math.round(results.overallPatterns.averageQualityScore)}/100점`);
    console.log(`🏆 최고 성능: ${results.overallPatterns.bestPerformingCases?.join(', ')}`);
    console.log(`📁 결과 저장: temp/comprehensive-analysis/`);
  })
  .catch(error => {
    console.error('❌ 분석 실패:', error.message);
    console.error('상세 오류:', error);
    process.exit(1);
  }); 