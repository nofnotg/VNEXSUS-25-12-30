const fs = require('fs');
const path = require('path');

// 의료기록 패턴 정의 (medicalDocumentNormalizer.js에서 가져옴)
const sectionPatterns = {
  medicalRecord: {
    visitDate: /(?:내원일|진료일|방문일)\s*[:：]?\s*(\d{4}[-\/.] \d{1,2}[-\/.] \d{1,2})/gi,
    hospital: /(?:병원|의원|클리닉|센터)\s*[:：]?\s*([^\n]+)/gi,
    diagnosis: /(?:진단명|진단)\s*[:：]?\s*([^\n]+)/gi,
    prescription: /(?:처방|투약|약물)\s*[:：]?\s*([^\n]+)/gi,
    symptoms: /(?:증상|주소|호소)\s*[:：]?\s*([^\n]+)/gi,
    treatment: /(?:치료|처치|시술)\s*[:：]?\s*([^\n]+)/gi
  }
};

const datePatterns = {
  standard: /\d{4}[-\/.] \d{1,2}[-\/.] \d{1,2}/g,
  korean: /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
  short: /\d{2}[-\/.] \d{1,2}[-\/.] \d{1,2}/g,
  compact: /\d{8}/g,
  withTime: /\d{4}[-\/.] \d{1,2}[-\/.] \d{1,2}\s+\d{1,2}[:.]\d{1,2}(?:[:.] \d{1,2})?/g,
  medical: /\[?\d{4}[-\/.] \d{1,2}[-\/.] \d{1,2}\]?/g
};

function testMedicalPatterns() {
  try {
    // Case1.txt 읽기
    const case1Path = path.join('C:', 'MVP_v7_2AI', 'src', 'rag', 'case_sample', 'Case1.txt');
    const content = fs.readFileSync(case1Path, 'utf-8');
    
    console.log('=== Case1.txt 의료 패턴 매칭 테스트 ===');
    console.log(`파일 크기: ${content.length} 문자`);
    console.log('');
    
    const results = {
      patternMatches: {},
      dateMatches: {},
      sampleLines: [],
      totalMatches: 0
    };
    
    // 의료기록 패턴 테스트
    console.log('🏥 의료기록 패턴 매칭 결과:');
    for (const [patternName, pattern] of Object.entries(sectionPatterns.medicalRecord)) {
      const matches = content.match(pattern) || [];
      results.patternMatches[patternName] = matches.length;
      results.totalMatches += matches.length;
      
      console.log(`  ${patternName}: ${matches.length}개 매칭`);
      if (matches.length > 0) {
        console.log(`    예시: ${matches[0].substring(0, 100)}...`);
      }
    }
    
    console.log('');
    
    // 날짜 패턴 테스트
    console.log('📅 날짜 패턴 매칭 결과:');
    for (const [patternName, pattern] of Object.entries(datePatterns)) {
      const matches = content.match(pattern) || [];
      results.dateMatches[patternName] = matches.length;
      
      console.log(`  ${patternName}: ${matches.length}개 매칭`);
      if (matches.length > 0 && matches.length <= 5) {
        console.log(`    예시: ${matches.slice(0, 3).join(', ')}`);
      } else if (matches.length > 5) {
        console.log(`    예시: ${matches.slice(0, 3).join(', ')} ... (총 ${matches.length}개)`);
      }
    }
    
    console.log('');
    
    // 의료 관련 키워드가 포함된 라인 찾기
    const lines = content.split('\n');
    const medicalKeywords = ['병원', '의원', '클리닉', '진료', '진단', '처방', '증상', '치료', '입원', '퇴원', '수술', '시술'];
    
    console.log('🔍 의료 키워드가 포함된 라인 샘플:');
    let sampleCount = 0;
    for (let i = 0; i < lines.length && sampleCount < 10; i++) {
      const line = lines[i].trim();
      if (line.length > 10 && medicalKeywords.some(keyword => line.includes(keyword))) {
        console.log(`  라인 ${i + 1}: ${line.substring(0, 80)}...`);
        results.sampleLines.push({ lineNumber: i + 1, content: line });
        sampleCount++;
      }
    }
    
    console.log('');
    console.log('📊 요약:');
    console.log(`  총 의료 패턴 매칭: ${results.totalMatches}개`);
    console.log(`  총 날짜 매칭: ${Object.values(results.dateMatches).reduce((a, b) => a + b, 0)}개`);
    console.log(`  의료 키워드 라인: ${results.sampleLines.length}개 (샘플)`);
    
    // 결과를 JSON 파일로 저장
    fs.writeFileSync(
      path.join(__dirname, 'medical_pattern_test_results.json'),
      JSON.stringify(results, null, 2),
      'utf-8'
    );
    
    console.log('\n✅ 결과가 medical_pattern_test_results.json에 저장되었습니다.');
    
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error.message);
  }
}

// 테스트 실행
testMedicalPatterns();