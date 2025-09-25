const fs = require('fs');
const path = require('path');

function compareDateProcessing() {
  console.log('=== Case1 날짜 데이터 비교 분석 ===\n');
  
  // 1. 원본 파일에서 실제 날짜 추출
  const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
  const content = fs.readFileSync(casePath, 'utf-8');
  
  // 실제 유효한 날짜 패턴만 추출
  const validDatePatterns = [
    /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g, // YYYY-MM-DD
    /\b(20\d{2})\.(0[1-9]|1[0-2])\.(0[1-9]|[12]\d|3[01])\b/g, // YYYY.MM.DD
    /\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g, // YYYYMMDD
    /\b(20\d{2})년\s*(0[1-9]|1[0-2])월\s*(0[1-9]|[12]\d|3[01])일/g // YYYY년 MM월 DD일
  ];
  
  const originalDates = new Set();
  
  validDatePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const dateStr = match[0];
      // 날짜 형식 정규화
      let normalizedDate;
      if (dateStr.includes('년')) {
        // YYYY년 MM월 DD일 형식
        const parts = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        if (parts) {
          normalizedDate = `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`;
        }
      } else if (dateStr.includes('.')) {
        // YYYY.MM.DD 형식
        normalizedDate = dateStr.replace(/\./g, '-');
      } else if (dateStr.includes('-')) {
        // YYYY-MM-DD 형식
        normalizedDate = dateStr;
      } else if (/^\d{8}$/.test(dateStr)) {
        // YYYYMMDD 형식
        normalizedDate = `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
      }
      
      if (normalizedDate && isValidDate(normalizedDate)) {
        originalDates.add(normalizedDate);
      }
    }
  });
  
  console.log('=== 원본 파일에서 발견된 유효한 날짜 ===');
  const sortedOriginalDates = Array.from(originalDates).sort();
  sortedOriginalDates.forEach((date, idx) => {
    console.log(`${idx + 1}. ${date}`);
  });
  console.log(`총 ${sortedOriginalDates.length}개의 유효한 날짜 발견\n`);
  
  // 2. 개발자 스튜디오 처리 결과 읽기
  const resultPath = path.join(__dirname, 'temp/dev-studio-case1-result.json');
  
  if (!fs.existsSync(resultPath)) {
    console.log('❌ 개발자 스튜디오 결과 파일을 찾을 수 없습니다.');
    return;
  }
  
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
  const processedDates = new Set();
  
  // extractedDates에서 날짜 추출
  if (result.results?.extractedDates) {
    result.results.extractedDates.forEach(date => {
      processedDates.add(date);
    });
  }
  
  // processedSections에서 날짜 추출
  if (result.results?.processedSections) {
    result.results.processedSections.forEach(section => {
      if (section.date && isValidDate(section.date)) {
        processedDates.add(section.date);
      }
    });
  }
  
  console.log('=== 개발자 스튜디오에서 처리된 날짜 ===');
  const sortedProcessedDates = Array.from(processedDates).sort();
  sortedProcessedDates.forEach((date, idx) => {
    console.log(`${idx + 1}. ${date}`);
  });
  console.log(`총 ${sortedProcessedDates.length}개의 날짜 처리됨\n`);
  
  // 3. 비교 분석
  console.log('=== 비교 분석 결과 ===');
  
  // 원본에는 있지만 처리되지 않은 날짜
  const missedDates = sortedOriginalDates.filter(date => !processedDates.has(date));
  console.log('\n📋 원본에는 있지만 처리되지 않은 날짜:');
  if (missedDates.length === 0) {
    console.log('   없음 ✅');
  } else {
    missedDates.forEach((date, idx) => {
      console.log(`   ${idx + 1}. ${date} ❌`);
    });
  }
  
  // 처리되었지만 원본에 없는 날짜 (오탐지)
  const falseDates = sortedProcessedDates.filter(date => !originalDates.has(date));
  console.log('\n🔍 처리되었지만 원본에 없는 날짜 (오탐지):');
  if (falseDates.length === 0) {
    console.log('   없음 ✅');
  } else {
    falseDates.forEach((date, idx) => {
      console.log(`   ${idx + 1}. ${date} ⚠️`);
    });
  }
  
  // 정확히 매칭된 날짜
  const matchedDates = sortedOriginalDates.filter(date => processedDates.has(date));
  console.log('\n✅ 정확히 매칭된 날짜:');
  if (matchedDates.length === 0) {
    console.log('   없음 ❌');
  } else {
    matchedDates.forEach((date, idx) => {
      console.log(`   ${idx + 1}. ${date} ✅`);
    });
  }
  
  // 정확도 계산
  const precision = matchedDates.length / (matchedDates.length + falseDates.length) || 0;
  const recall = matchedDates.length / sortedOriginalDates.length || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
  
  console.log('\n=== 성능 지표 ===');
  console.log(`정밀도 (Precision): ${(precision * 100).toFixed(1)}%`);
  console.log(`재현율 (Recall): ${(recall * 100).toFixed(1)}%`);
  console.log(`F1 점수: ${(f1Score * 100).toFixed(1)}%`);
  
  // 문제점 요약
  console.log('\n=== 문제점 요약 ===');
  if (missedDates.length > 0) {
    console.log(`❌ ${missedDates.length}개의 날짜가 누락됨`);
  }
  if (falseDates.length > 0) {
    console.log(`⚠️ ${falseDates.length}개의 오탐지 발생`);
  }
  if (matchedDates.length === sortedOriginalDates.length && falseDates.length === 0) {
    console.log('✅ 모든 날짜가 정확히 처리됨');
  }
}

function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
}

// 분석 실행
compareDateProcessing();