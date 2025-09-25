/**
 * enhancedEntityExtractor 직접 테스트
 */

const fs = require('fs');

// CommonJS 방식으로 ES 모듈 임포트
async function testEntityExtractor() {
  console.log('🧬 enhancedEntityExtractor 직접 테스트...');
  
  try {
    // ES 모듈 동적 임포트
    const { default: enhancedEntityExtractor } = await import('../backend/postprocess/enhancedEntityExtractor.js');
    
    // 테스트 텍스트 (실제 Stage3 입력과 동일)
    const testText = `
[날짜: 2023-08-07]
[병원: 삼성서울병원]
2023/08/07 CT와 비교해서 right liver의 hemangioma는 8.7cm로 이전보다 더 커졌음. 진단명: Hemangioma of liver. 삼성서울병원에서 치료받음.
---

[날짜: 2023-08-07]
[병원: 에스엠영상의학과의원]
에스엠영상의학과의원에서 복부 CT 촬영. Giant hepatic hemangioma about 8 x 6cm sized at right lobe 진단.
---

[날짜: 2024-04-09]
[병원: 삼성서울병원]
소화기내과 진료. 간종괴 2017년 간혈관종 4.5cm 진단됨. 진단명: Hemangioma of liver. 간혈관종, 크기 증가.
---`;

    console.log('📊 테스트 텍스트:');
    console.log(`- 길이: ${testText.length}자`);
    console.log(`- "삼성서울병원" 포함: ${testText.includes('삼성서울병원')}`);
    console.log(`- "진단명" 포함: ${testText.includes('진단명')}`);
    
    // enhancedEntityExtractor 호출
    console.log('\n🚀 enhancedEntityExtractor.extractAllEntities 호출...');
    const result = await enhancedEntityExtractor.extractAllEntities(testText);
    
    console.log('\n📋 추출 결과:');
    console.log(`🏥 병원명: ${result.entities.hospitals.length}개`);
    result.entities.hospitals.forEach((h, i) => console.log(`   ${i+1}. ${h}`));
    
    console.log(`🩺 진단명: ${result.entities.diagnoses.length}개`);
    result.entities.diagnoses.forEach((d, i) => console.log(`   ${i+1}. ${d}`));
    
    console.log(`👨‍⚕️ 의료진: ${result.entities.doctors.length}개`);
    result.entities.doctors.forEach((d, i) => console.log(`   ${i+1}. ${d}`));
    
    console.log(`📅 날짜: ${result.entities.dates.length}개`);
    result.entities.dates.slice(0, 5).forEach((d, i) => console.log(`   ${i+1}. ${d}`));
    
    console.log('\n📊 통계:');
    console.log(`- 고유 병원 수: ${result.statistics.uniqueHospitals}`);
    console.log(`- 고유 진단명 수: ${result.statistics.uniqueDiagnoses}`);
    console.log(`- 총 방문 횟수: ${result.statistics.totalVisits}`);
    console.log(`- 의료 복잡도: ${result.statistics.medicalComplexity}`);
    
    // 결과 저장
    fs.writeFileSync('temp/debug-entity-extraction-result.json', JSON.stringify(result, null, 2), 'utf8');
    console.log('\n📁 결과 저장: temp/debug-entity-extraction-result.json');
    
    console.log('\n🎯 결론:');
    if (result.statistics.uniqueHospitals > 0 || result.statistics.uniqueDiagnoses > 0) {
      console.log('✅ enhancedEntityExtractor 정상 작동!');
      console.log('❓ Stage3에서 이 결과가 제대로 반환되지 않는 다른 문제가 있을 수 있습니다.');
    } else {
      console.log('❌ enhancedEntityExtractor 로직에 문제가 있습니다.');
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

testEntityExtractor(); 