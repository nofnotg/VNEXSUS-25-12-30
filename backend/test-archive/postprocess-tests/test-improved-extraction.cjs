const fs = require('fs');
const path = require('path');

// MedicalDocumentNormalizer 클래스 로드
const MedicalDocumentNormalizer = require('./medicalDocumentNormalizer.cjs');

async function testImprovedExtraction() {
  try {
    console.log('개선된 의료기록 추출 테스트 시작...');
    
    // Case1.txt 파일 읽기
    const case1Path = path.join(__dirname, '..', '..', 'src', 'rag', 'case_sample', 'Case1.txt');
    const case1Content = fs.readFileSync(case1Path, 'utf-8');
    
    console.log(`Case1.txt 파일 크기: ${case1Content.length} 문자`);
    
    // MedicalDocumentNormalizer 인스턴스 생성
    const normalizer = new MedicalDocumentNormalizer();
    
    // 전체 정규화 프로세스 실행
    console.log('\n=== 전체 정규화 프로세스 실행 ===');
    const result = normalizer.normalizeDocument(case1Content);
    
    console.log('\n=== 결과 요약 ===');
    console.log(`환자 정보: ${result.patientInfo ? '추출됨' : '추출 실패'}`);
    console.log(`보험 정보: ${result.insuranceInfo ? '추출됨' : '추출 실패'}`);
    console.log(`의료 기록 수: ${result.medicalRecords ? result.medicalRecords.length : 0}`);
    console.log(`입원 기록 수: ${result.hospitalizationRecords ? result.hospitalizationRecords.length : 0}`);
    console.log(`검사 결과 수: ${result.testResults ? result.testResults.length : 0}`);
    
    // 의료 기록 상세 정보
    if (result.medicalRecords && result.medicalRecords.length > 0) {
      console.log('\n=== 의료 기록 상세 ===');
      result.medicalRecords.slice(0, 5).forEach((record, index) => {
        console.log(`\n[${index + 1}] 의료 기록:`);
        console.log(`  날짜: ${record.date || '없음'}`);
        console.log(`  병원: ${record.hospital || '없음'}`);
        console.log(`  진단: ${record.diagnosis || '없음'}`);
        console.log(`  처방: ${record.prescription || '없음'}`);
        console.log(`  증상: ${record.symptoms || '없음'}`);
      });
      
      if (result.medicalRecords.length > 5) {
        console.log(`\n... 총 ${result.medicalRecords.length}개 중 5개만 표시`);
      }
    }
    
    // 환자 정보 상세
    if (result.patientInfo) {
      console.log('\n=== 환자 정보 ===');
      console.log(`이름: ${result.patientInfo.name || '없음'}`);
      console.log(`생년월일: ${result.patientInfo.birthDate || '없음'}`);
      console.log(`성별: ${result.patientInfo.gender || '없음'}`);
      console.log(`주소: ${result.patientInfo.address || '없음'}`);
    }
    
    // 결과를 파일로 저장
    const outputPath = path.join(__dirname, 'improved_extraction_results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      summary: {
        patientInfoExtracted: !!result.patientInfo,
        insuranceInfoExtracted: !!result.insuranceInfo,
        medicalRecordsCount: result.medicalRecords ? result.medicalRecords.length : 0,
        hospitalizationRecordsCount: result.hospitalizationRecords ? result.hospitalizationRecords.length : 0,
        testResultsCount: result.testResults ? result.testResults.length : 0
      },
      fullResult: result
    }, null, 2));
    
    console.log(`\n결과가 ${outputPath}에 저장되었습니다.`);
    
  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
}

testImprovedExtraction();