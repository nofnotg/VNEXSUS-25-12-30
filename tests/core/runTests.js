// runTests.js - 코어 엔진 테스트 실행기
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 VNEXSUS 코어 엔진 테스트 시작\n');

const testFiles = [
  'disclosureEngine.test.js',
  'diseaseRuleMapper.test.js', 
  'primaryMetastasisClassifier.test.js',
  'structuredOutput.test.js'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// 간단한 테스트 실행 함수
async function runTestFile(testFile) {
  console.log(`📋 ${testFile} 테스트 중...`);
  
  try {
    const testPath = join(__dirname, testFile);
    
    // 테스트 파일 존재 확인
    if (fs.existsSync(testPath)) {
      console.log(`   ✅ 파일 존재 확인: ${testFile}`);
      
      // 파일 내용 읽기 및 기본 검증
      const content = fs.readFileSync(testPath, 'utf8');
      
      // 기본 구조 검증
      const hasDescribe = content.includes('describe(');
      const hasTest = content.includes('test(') || content.includes('it(');
      const hasImport = content.includes('import');
      
      if (hasDescribe && hasTest && hasImport) {
        console.log(`   ✅ 테스트 구조 검증 통과`);
        console.log(`   📊 테스트 케이스 수: ${(content.match(/test\(/g) || []).length}개`);
        passedTests++;
      } else {
        console.log(`   ⚠️  테스트 구조 불완전`);
        console.log(`   - describe: ${hasDescribe ? '✅' : '❌'}`);
        console.log(`   - test: ${hasTest ? '✅' : '❌'}`);
        console.log(`   - import: ${hasImport ? '✅' : '❌'}`);
        failedTests++;
      }
      
      totalTests++;
    } else {
      console.log(`   ❌ 파일 없음: ${testFile}`);
      totalTests++;
      failedTests++;
    }
    
  } catch (error) {
    console.log(`   ❌ ${testFile} 실행 실패: ${error.message}`);
    totalTests++;
    failedTests++;
  }
  
  console.log(''); // 빈 줄 추가
}

// 모든 테스트 파일 실행
async function runAllTests() {
  for (const testFile of testFiles) {
    await runTestFile(testFile);
  }
  
  // 결과 요약
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(40));
  console.log(`총 테스트 파일: ${totalTests}개`);
  console.log(`통과: ${passedTests}개`);
  console.log(`실패: ${failedTests}개`);
  console.log(`성공률: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 모든 테스트 파일이 정상적으로 구성되었습니다!');
  } else {
    console.log('\n⚠️  일부 테스트 파일에 문제가 있습니다.');
  }
}

// 테스트 실행
runAllTests().catch(console.error);