/**
 * 날짜 패턴 매칭 디버그 스크립트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 날짜 패턴 정의 (EnhancedDateAnchor에서 가져온 것)
const datePatterns = {
  absolute: {
    patterns: [
      /(?<year>\d{4})[년\-\.\s]*(?<month>\d{1,2})[월\-\.\s]*(?<day>\d{1,2})[일]?/g,
      /(?<month>\d{1,2})[월\/\-\.](?<day>\d{1,2})[일\/\-\.](?<year>\d{4})/g,
      /(?<year>\d{4})[년]?\s*(?<month>\d{1,2})[월]?\s*(?<day>\d{1,2})[일]?/g
    ],
    confidence: 0.95,
    priority: 100
  },
  
  relative: {
    patterns: [
      /(?<reference>금일|오늘|당일|현재)/g,
      /(?<reference>어제|yesterday)/g,
      /(?<number>\d+)\s*(?<unit>일|주|개월|년)\s*(?<direction>전|후|뒤)/g,
      /(?<reference>최근|근래)\s*(?<number>\d+)?\s*(?<unit>일|주|개월|년)?/g
    ],
    confidence: 0.8,
    priority: 70
  },
  
  medical: {
    patterns: [
      /(?<context>진료|검사|수술|처방|투약|복용)\s*(?<date_ref>당시|시점|일자|날짜)/g,
      /(?<date_ref>발병|진단|치료\s*시작)\s*(?<year>\d{4})[년]?\s*(?<month>\d{1,2})?[월]?/g,
      /(?<context>입원|퇴원|내원)\s*(?<year>\d{4})[년\-\.]*(?<month>\d{1,2})[월\-\.]*(?<day>\d{1,2})[일]?/g
    ],
    confidence: 0.85,
    priority: 90
  }
};

// 간단한 날짜 패턴 (추가 테스트용)
const simplePatterns = [
  /\d{4}-\d{1,2}-\d{1,2}/g,
  /\d{4}\.\d{1,2}\.\d{1,2}/g,
  /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
  /\d{8}/g  // YYYYMMDD
];

function testDatePatterns() {
  console.log('🔍 날짜 패턴 매칭 테스트 시작...');
  
  // Case1 데이터 로드
  const case1Path = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
  const case1Content = fs.readFileSync(case1Path, 'utf-8');
  
  console.log(`📄 Case1 데이터 로드 완료 (${case1Content.length}자)`);
  
  // 테스트 샘플 (첫 2000자)
  const sampleText = case1Content.substring(0, 2000);
  console.log('\n📝 테스트 샘플:');
  console.log(sampleText.substring(0, 500) + '...');
  
  console.log('\n🔍 간단한 패턴 테스트:');
  
  // 간단한 패턴들로 먼저 테스트
  simplePatterns.forEach((pattern, index) => {
    const matches = [...sampleText.matchAll(pattern)];
    console.log(`패턴 ${index + 1} (${pattern}): ${matches.length}개 매칭`);
    matches.forEach((match, i) => {
      if (i < 5) { // 처음 5개만 출력
        console.log(`  - ${match[0]} (위치: ${match.index})`);
      }
    });
  });
  
  console.log('\n🧬 Enhanced 패턴 테스트:');
  
  // Enhanced 패턴들 테스트
  for (const [category, config] of Object.entries(datePatterns)) {
    console.log(`\n📊 ${category} 패턴:`);
    
    config.patterns.forEach((pattern, index) => {
      const matches = [...sampleText.matchAll(pattern)];
      console.log(`  패턴 ${index + 1}: ${matches.length}개 매칭`);
      
      matches.forEach((match, i) => {
        if (i < 3) { // 처음 3개만 출력
          console.log(`    - "${match[0]}" (위치: ${match.index})`);
          if (match.groups) {
            console.log(`      그룹: ${JSON.stringify(match.groups)}`);
          }
        }
      });
    });
  }
  
  console.log('\n✅ 날짜 패턴 테스트 완료!');
}

// 실행
testDatePatterns();