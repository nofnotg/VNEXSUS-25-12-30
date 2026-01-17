/**
 * NaN 값 수정 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MedicalDocumentNormalizer from './medicalDocumentNormalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testNaNFix() {
  console.log('🧪 NaN 값 수정 테스트 시작...');
  
  const normalizer = new MedicalDocumentNormalizer();
  const casePath = path.join(__dirname, '../../src/rag/case_sample/Case1.txt');
  
  try {
    const caseContent = fs.readFileSync(casePath, 'utf-8');
    console.log(`📄 Case1.txt 로드 완료 (${caseContent.length}자)`);
    
    const result = await normalizer.normalizeDocument(caseContent, {
      reportOptions: {
        format: 'text',
        includeStatistics: true,
        includeSummary: true
      }
    });
    
    console.log('\n📊 정규화 결과:');
    console.log('성공:', result.success);
    console.log('통계:', result.statistics);
    
    // Progress Report에서 NaN 값 확인
    const progressReport = result.progressReport;
    const hasNaN = progressReport.includes('NaN.NaN.NaN');
    
    console.log('\n🔍 NaN 값 검사:');
    console.log('NaN.NaN.NaN 발견:', hasNaN ? '❌ 있음' : '✅ 없음');
    
    if (hasNaN) {
      console.log('\n⚠️ 여전히 NaN 값이 발견됩니다.');
      // NaN이 포함된 부분 출력
      const lines = progressReport.split('\n');
      const nanLines = lines.filter(line => line.includes('NaN'));
      console.log('NaN 포함 라인들:');
      nanLines.forEach(line => console.log('  ', line));
    } else {
      console.log('\n✅ NaN 값 문제가 해결되었습니다!');
    }
    
    // 결과 저장
    const outputPath = path.join(__dirname, 'test_outputs/nan_fix_test_result.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      success: result.success,
      hasNaN,
      statistics: result.statistics,
      progressReport: progressReport.substring(0, 1000) // 처음 1000자만
    }, null, 2));
    
    console.log(`\n💾 결과 저장: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

testNaNFix();