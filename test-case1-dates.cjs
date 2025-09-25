const fs = require('fs');
const path = require('path');

// Case1.txt 파일 로드
const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
const content = fs.readFileSync(casePath, 'utf-8');
const lines = content.split('\n');

console.log('=== Case1.txt 날짜 패턴 분석 ===');
console.log(`총 라인 수: ${lines.length}`);
console.log(`파일 크기: ${content.length}자`);

// 날짜 패턴 정의 (ocrParser.ts와 동일)
const datePatterns = [
  /^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/, // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  /^(\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})/, // YY-MM-DD, YY.MM.DD, YY/MM/DD
  /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/, // YYYY년 MM월 DD일
  /(\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일/, // YY년 MM월 DD일
  /(\d{1,2})월\s*(\d{1,2})일,?\s*(\d{4})/, // MM월 DD일, YYYY
  /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
  /(\d{1,2})-(\d{1,2})-(\d{4})/, // MM-DD-YYYY
  /(\d{8})/, // YYYYMMDD
  /(\d{4})-?(\d{2})-?(\d{2})/ // 추가 패턴
];

let dateCount = 0;
const foundDates = [];

// 첫 200라인에서 날짜 패턴 검색
lines.slice(0, 200).forEach((line, idx) => {
  const trimmedLine = line.trim();
  if (!trimmedLine) return;
  
  for (let i = 0; i < datePatterns.length; i++) {
    const pattern = datePatterns[i];
    const match = trimmedLine.match(pattern);
    if (match) {
      console.log(`라인 ${idx + 1} (패턴 ${i + 1}): ${trimmedLine}`);
      foundDates.push({
        line: idx + 1,
        pattern: i + 1,
        text: trimmedLine,
        match: match[0]
      });
      dateCount++;
      break;
    }
  }
});

console.log(`\n=== 분석 결과 ===`);
console.log(`총 발견된 날짜: ${dateCount}개 (첫 200라인 기준)`);
console.log(`\n=== 발견된 날짜 목록 ===`);
foundDates.forEach(date => {
  console.log(`${date.match} (라인 ${date.line})`);
});

// 날짜 형식별 통계
const patternStats = {};
foundDates.forEach(date => {
  patternStats[date.pattern] = (patternStats[date.pattern] || 0) + 1;
});

console.log(`\n=== 패턴별 통계 ===`);
Object.entries(patternStats).forEach(([pattern, count]) => {
  console.log(`패턴 ${pattern}: ${count}개`);
});