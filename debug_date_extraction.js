// 날짜 추출 디버깅 스크립트
const sampleText = `
진료기간
환자상태및
진료소
2024-12-12
2024-12-12
진료구분
о입원
⊙외래

외래초진기록
2024-12-27
추정진단
계획
typical angina

입원일자
2024-12-31
입원과
심장내과

외래재진기록
2025-01-09
진료과
심장내과

검진일
2024.05.30
판정
정상A
`;

// 날짜 패턴들
const datePatterns = {
  standard: /\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
  korean: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
  short: /\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2}/g,
  compact: /\d{8}/g,
  withTime: /\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\s+\d{1,2}[:\.]\d{1,2}(?:[:\.]\d{1,2})?/g,
  medical: /\[?\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}\]?/g
};

console.log('=== 날짜 추출 테스트 ===');
console.log('원본 텍스트:');
console.log(sampleText);
console.log('\n=== 패턴별 매치 결과 ===');

Object.entries(datePatterns).forEach(([name, pattern]) => {
  console.log(`\n${name} 패턴:`);
  const matches = sampleText.match(pattern);
  if (matches) {
    console.log('  발견된 날짜들:', matches);
  } else {
    console.log('  매치 없음');
  }
});

// 날짜 정규화 함수 테스트
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  const cleanStr = dateStr.replace(/[\[\]]/g, '').trim();
  
  // YYYYMMDD 형식
  const compactMatch = cleanStr.match(/^(\d{8})$/);
  if (compactMatch) {
    const dateStr = compactMatch[1];
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6));
    const day = parseInt(dateStr.substring(6, 8));
    
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    return null;
  }
  
  // 표준 형식
  const standardMatch = cleanStr.match(/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/);
  if (standardMatch) {
    return standardMatch[0].replace(/[\/.]/g, '-');
  }
  
  return cleanStr;
}

console.log('\n=== 날짜 정규화 테스트 ===');
const testDates = ['2024-12-12', '2024.05.30', '2024/12/31', '20241227'];
testDates.forEach(date => {
  console.log(`${date} -> ${normalizeDate(date)}`);
});