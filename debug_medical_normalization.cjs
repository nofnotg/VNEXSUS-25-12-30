// 의료 기록 정규화 디버깅 스크립트
const fs = require('fs');
const path = require('path');

// 실제 case5_test.json 파일 읽기
const testFilePath = path.join(__dirname, 'results', 'case5_test.json');
const testData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));

console.log('=== 원본 텍스트 분석 ===');
const mergedText = testData.results.file1.mergedText;
console.log('mergedText 길이:', mergedText.length);
console.log('mergedText 일부:');
console.log(mergedText.substring(0, 500));

// MedicalDocumentNormalizer 클래스 로드
const MedicalDocumentNormalizer = require('./backend/postprocess/medicalDocumentNormalizer.cjs');

console.log('\n=== 의료 기록 정규화 테스트 ===');
const normalizer = new MedicalDocumentNormalizer();

try {
  const result = normalizer.normalizeDocument(mergedText);
  
  console.log('\n=== 정규화 결과 ===');
  console.log('medicalRecords 개수:', result.medicalRecords ? result.medicalRecords.length : 0);
  
  if (result.medicalRecords && result.medicalRecords.length > 0) {
    console.log('\n첫 번째 의료 기록:');
    console.log(JSON.stringify(result.medicalRecords[0], null, 2));
    
    console.log('\n모든 의료 기록의 날짜:');
    result.medicalRecords.forEach((record, index) => {
      console.log(`${index + 1}. 날짜: ${record.date || 'null'}, 타입: ${record.type}, 병원: ${record.hospital || 'null'}`);
    });
  } else {
    console.log('의료 기록이 추출되지 않았습니다.');
  }
  
  console.log('\n=== 환자 정보 ===');
  console.log('환자명:', result.patientInfo?.name || 'null');
  console.log('생년월일:', result.patientInfo?.birthDate || 'null');
  
  console.log('\n=== 보험 정보 ===');
  if (result.insuranceInfo && result.insuranceInfo.length > 0) {
    result.insuranceInfo.forEach((insurance, index) => {
      console.log(`${index + 1}. 회사: ${insurance.company}, 가입일: ${insurance.joinDate || 'null'}`);
    });
  }
  
} catch (error) {
  console.error('정규화 중 오류 발생:', error);
  console.error('스택 트레이스:', error.stack);
}