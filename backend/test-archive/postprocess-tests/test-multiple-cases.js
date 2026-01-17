/**
 * 여러 케이스 NaN 값 수정 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MedicalDocumentNormalizer from './medicalDocumentNormalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMultipleCases() {
  console.log('🧪 여러 케이스 NaN 값 수정 테스트 시작...');
  
  const normalizer = new MedicalDocumentNormalizer();
  const caseSamplePath = path.join(__dirname, '../../src/rag/case_sample');
  
  // 테스트할 케이스들
  const testCases = [1, 2, 3, 5, 6, 7, 8];
  const results = [];
  
  for (const caseNum of testCases) {
    try {
      console.log(`\n📄 Case${caseNum} 테스트 중...`);
      
      const casePath = path.join(caseSamplePath, `Case${caseNum}.txt`);
      const caseContent = fs.readFileSync(casePath, 'utf-8');
      
      const result = await normalizer.normalizeDocument(caseContent, {
        reportOptions: {
          format: 'text',
          includeStatistics: true,
          includeSummary: true
        }
      });
      
      // NaN 값 검사
      const progressReport = result.progressReport;
      const hasNaN = progressReport.includes('NaN.NaN.NaN');
      
      const testResult = {
        caseNumber: caseNum,
        success: result.success,
        hasNaN,
        recordsFound: result.statistics.recordsFound,
        insuranceCount: result.statistics.insuranceCount
      };
      
      results.push(testResult);
      
      console.log(`  ✅ 성공: ${result.success}`);
      console.log(`  🔍 NaN 발견: ${hasNaN ? '❌ 있음' : '✅ 없음'}`);
      console.log(`  📊 의료기록: ${result.statistics.recordsFound}개`);
      console.log(`  🏥 보험정보: ${result.statistics.insuranceCount}개`);
      
      // 결과 파일 저장
      const outputPath = path.join(__dirname, `test_outputs/Case${caseNum}_fixed_result.json`);
      fs.writeFileSync(outputPath, JSON.stringify({
        caseNumber: caseNum,
        success: result.success,
        hasNaN,
        statistics: result.statistics,
        progressReport: progressReport.substring(0, 2000) // 처음 2000자만
      }, null, 2));
      
    } catch (error) {
      console.error(`❌ Case${caseNum} 테스트 실패:`, error.message);
      results.push({
        caseNumber: caseNum,
        success: false,
        hasNaN: null,
        error: error.message
      });
    }
  }
  
  // 종합 결과
  console.log('\n📊 종합 결과:');
  console.log('='.repeat(50));
  
  const successCount = results.filter(r => r.success).length;
  const nanFreeCount = results.filter(r => !r.hasNaN).length;
  
  console.log(`✅ 성공한 케이스: ${successCount}/${results.length}`);
  console.log(`🔍 NaN 없는 케이스: ${nanFreeCount}/${results.length}`);
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const nanStatus = result.hasNaN ? '❌ NaN있음' : '✅ NaN없음';
    console.log(`  Case${result.caseNumber}: ${status} ${nanStatus}`);
  });
  
  // 전체 결과 저장
  const summaryPath = path.join(__dirname, 'test_outputs/multiple_cases_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    testDate: new Date().toISOString(),
    totalCases: results.length,
    successCount,
    nanFreeCount,
    results
  }, null, 2));
  
  console.log(`\n💾 종합 결과 저장: ${summaryPath}`);
  
  if (nanFreeCount === results.length) {
    console.log('\n🎉 모든 케이스에서 NaN 값 문제가 해결되었습니다!');
  } else {
    console.log('\n⚠️ 일부 케이스에서 여전히 NaN 값이 발견됩니다.');
  }
}

testMultipleCases().catch(console.error);