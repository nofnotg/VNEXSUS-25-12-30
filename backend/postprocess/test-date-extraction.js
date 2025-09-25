/**
 * 날짜 추출 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function testDateExtraction() {
  console.log('🔍 날짜 추출 테스트 시작...');
  
  // 날짜 패턴들
  const datePatterns = {
    standard: /\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
    korean: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
    short: /\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
    dotFormat: /\d{4}\.\d{1,2}\.\d{1,2}/g,
    hyphenFormat: /\d{4}-\d{1,2}-\d{1,2}/g,
    slashFormat: /\d{4}\/\d{1,2}\/\d{1,2}/g
  };
  
  const casePath = path.join(__dirname, '../../src/rag/case_sample/Case1.txt');
  const caseContent = fs.readFileSync(casePath, 'utf-8');
  
  console.log(`📄 Case1.txt 로드 완료 (${caseContent.length}자)`);
  
  // 각 패턴별로 날짜 추출
  Object.entries(datePatterns).forEach(([patternName, pattern]) => {
    const matches = caseContent.match(pattern) || [];
    console.log(`\n${patternName} 패턴:`);
    console.log(`  발견된 날짜 수: ${matches.length}`);
    
    if (matches.length > 0) {
      // 중복 제거 후 처음 10개만 표시
      const uniqueDates = [...new Set(matches)].slice(0, 10);
      uniqueDates.forEach(date => {
        console.log(`    ${date}`);
      });
      if (matches.length > 10) {
        console.log(`    ... 및 ${matches.length - 10}개 더`);
      }
    }
  });
  
  // 전체 날짜 통합
  const allDates = new Set();
  Object.values(datePatterns).forEach(pattern => {
    const matches = caseContent.match(pattern) || [];
    matches.forEach(date => allDates.add(date));
  });
  
  console.log(`\n📊 총 발견된 고유 날짜: ${allDates.size}개`);
  
  // 의료 관련 키워드와 함께 나타나는 날짜들 찾기
  const medicalKeywords = [
    '진료', '내원', '방문', '입원', '퇴원', '수술', '시술', 
    '검사', '촬영', '진단', '처방', '치료', '병원', '의원'
  ];
  
  console.log('\n🏥 의료 관련 날짜들:');
  const lines = caseContent.split('\n');
  let medicalDateCount = 0;
  
  lines.forEach((line, index) => {
    const hasDate = Object.values(datePatterns).some(pattern => pattern.test(line));
    const hasMedicalKeyword = medicalKeywords.some(keyword => line.includes(keyword));
    
    if (hasDate && hasMedicalKeyword) {
      medicalDateCount++;
      if (medicalDateCount <= 5) { // 처음 5개만 표시
        console.log(`  라인 ${index + 1}: ${line.trim().substring(0, 100)}...`);
      }
    }
  });
  
  console.log(`\n📈 의료 관련 날짜가 포함된 라인: ${medicalDateCount}개`);
  
  // 날짜 섹션 분할 시뮬레이션
  console.log('\n📋 날짜 섹션 분할 시뮬레이션:');
  const dateMatches = [];
  
  Object.values(datePatterns).forEach(pattern => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(caseContent)) !== null) {
      dateMatches.push({
        date: match[0],
        index: match.index
      });
    }
  });
  
  // 날짜 위치순 정렬
  dateMatches.sort((a, b) => a.index - b.index);
  
  console.log(`  발견된 날짜 매치: ${dateMatches.length}개`);
  
  // 섹션 분할
  const sections = [];
  for (let i = 0; i < dateMatches.length; i++) {
    const start = dateMatches[i].index;
    const end = i < dateMatches.length - 1 ? dateMatches[i + 1].index : caseContent.length;
    const sectionText = caseContent.substring(start, end);
    
    if (sectionText.trim().length > 10) {
      sections.push({
        date: dateMatches[i].date,
        length: sectionText.trim().length,
        preview: sectionText.trim().substring(0, 100).replace(/\n/g, ' ')
      });
    }
  }
  
  console.log(`  생성된 섹션: ${sections.length}개`);
  sections.slice(0, 5).forEach((section, index) => {
    console.log(`    섹션 ${index + 1}: ${section.date} (${section.length}자) - ${section.preview}...`);
  });
  
  // 결과 저장
  const result = {
    totalDates: allDates.size,
    medicalDateLines: medicalDateCount,
    sectionsCreated: sections.length,
    dateMatches: dateMatches.length,
    sampleDates: Array.from(allDates).slice(0, 20),
    sampleSections: sections.slice(0, 5)
  };
  
  const outputPath = path.join(__dirname, 'test_outputs/date_extraction_analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  console.log(`\n💾 분석 결과 저장: ${outputPath}`);
}

testDateExtraction();