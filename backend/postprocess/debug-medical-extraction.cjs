const fs = require('fs');
const path = require('path');

// 의료기록 패턴 정의
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

function _normalizeDate(dateStr) {
  // 날짜 정규화 함수
  if (!dateStr) return null;
  
  // YYYYMMDD 형식 처리
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  
  // 한국어 날짜 형식 처리
  if (dateStr.includes('년')) {
    return dateStr.replace(/년\s*/g, '-').replace(/월\s*/g, '-').replace(/일/g, '');
  }
  
  return dateStr;
}

function _splitByDateSections(text) {
  const sections = [];
  const dateMatches = [];
  
  // 모든 날짜 패턴 찾기
  Object.entries(datePatterns).forEach(([patternName, pattern]) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      dateMatches.push({
        date: match[0],
        index: match.index,
        pattern: patternName
      });
    }
  });
  
  console.log(`📅 발견된 날짜 매치: ${dateMatches.length}개`);
  
  // 날짜 위치순 정렬
  dateMatches.sort((a, b) => a.index - b.index);
  
  // 날짜 기준으로 섹션 분할
  for (let i = 0; i < dateMatches.length; i++) {
    const start = dateMatches[i].index;
    const end = i < dateMatches.length - 1 ? dateMatches[i + 1].index : text.length;
    const sectionText = text.substring(start, end);
    
    if (sectionText.trim().length > 10) {
      sections.push({
        text: sectionText.trim(),
        startDate: dateMatches[i].date,
        pattern: dateMatches[i].pattern
      });
    }
  }
  
  console.log(`📋 생성된 섹션: ${sections.length}개`);
  return sections;
}

function _parseRecordSection(sectionObj) {
  const section = sectionObj.text;
  const record = {
    type: 'medical_record',
    rawText: section.substring(0, 200) + '...', // 처음 200자만 저장
    sectionPattern: sectionObj.pattern,
    sectionStartDate: sectionObj.startDate
  };
  
  // 날짜 추출 (표준 패턴 우선)
  const dateMatch = section.match(datePatterns.standard);
  if (dateMatch) {
    record.date = _normalizeDate(dateMatch[0]);
  } else {
    // 다른 패턴들도 시도
    for (const [patternName, pattern] of Object.entries(datePatterns)) {
      const match = section.match(pattern);
      if (match) {
        record.date = _normalizeDate(match[0]);
        record.datePattern = patternName;
        break;
      }
    }
  }
  
  // 병원명 추출
  const hospitalMatch = section.match(sectionPatterns.medicalRecord.hospital);
  if (hospitalMatch) {
    record.hospital = hospitalMatch[0].replace(/(?:병원|의원|클리닉|센터)\s*[:：]?\s*/, '').trim();
  }
  
  // 진단명 추출
  const diagnosisMatch = section.match(sectionPatterns.medicalRecord.diagnosis);
  if (diagnosisMatch) {
    record.diagnosis = diagnosisMatch[0].replace(/(?:진단명|진단)\s*[:：]?\s*/, '').trim();
  }
  
  // 처방 추출
  const prescriptionMatch = section.match(sectionPatterns.medicalRecord.prescription);
  if (prescriptionMatch) {
    record.prescription = prescriptionMatch[0].replace(/(?:처방|투약|약물)\s*[:：]?\s*/, '').trim();
  }
  
  // 증상 추출
  const symptomsMatch = section.match(sectionPatterns.medicalRecord.symptoms);
  if (symptomsMatch) {
    record.symptoms = symptomsMatch[0].replace(/(?:증상|주소|호소)\s*[:：]?\s*/, '').trim();
  }
  
  return record;
}

function debugMedicalExtraction() {
  try {
    // Case1.txt 읽기
    const case1Path = path.join('C:', 'MVP_v7_2AI', 'src', 'rag', 'case_sample', 'Case1.txt');
    const content = fs.readFileSync(case1Path, 'utf-8');
    
    console.log('=== 의료기록 추출 디버깅 ===');
    console.log(`파일 크기: ${content.length} 문자`);
    console.log('');
    
    // 1단계: 날짜 섹션 분할
    const dateSections = _splitByDateSections(content);
    
    console.log('\n🔍 섹션별 분석:');
    const records = [];
    let validRecords = 0;
    
    dateSections.slice(0, 10).forEach((sectionObj, index) => {
      console.log(`\n--- 섹션 ${index + 1} ---`);
      console.log(`시작 날짜: ${sectionObj.startDate} (패턴: ${sectionObj.pattern})`);
      console.log(`텍스트 길이: ${sectionObj.text.length}`);
      console.log(`텍스트 미리보기: ${sectionObj.text.substring(0, 100)}...`);
      
      const record = _parseRecordSection(sectionObj);
      console.log(`추출된 날짜: ${record.date || '없음'}`);
      console.log(`병원명: ${record.hospital || '없음'}`);
      console.log(`진단명: ${record.diagnosis || '없음'}`);
      
      if (record.date) {
        validRecords++;
        records.push(record);
      }
    });
    
    console.log(`\n📊 요약:`);
    console.log(`  총 섹션: ${dateSections.length}개`);
    console.log(`  유효한 기록 (날짜 있음): ${validRecords}개`);
    console.log(`  전체 처리 시 예상 기록: ${Math.round(validRecords * dateSections.length / Math.min(10, dateSections.length))}개`);
    
    // 결과 저장
    const debugResult = {
      totalSections: dateSections.length,
      sampledSections: Math.min(10, dateSections.length),
      validRecords: validRecords,
      estimatedTotalRecords: Math.round(validRecords * dateSections.length / Math.min(10, dateSections.length)),
      sampleRecords: records,
      sampleSections: dateSections.slice(0, 5).map(s => ({
        startDate: s.startDate,
        pattern: s.pattern,
        textPreview: s.text.substring(0, 200)
      }))
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'debug_medical_extraction.json'),
      JSON.stringify(debugResult, null, 2),
      'utf-8'
    );
    
    console.log('\n✅ 디버깅 결과가 debug_medical_extraction.json에 저장되었습니다.');
    
  } catch (error) {
    console.error('❌ 디버깅 중 오류:', error.message);
  }
}

// 디버깅 실행
debugMedicalExtraction();