/**
 * Stage3 직접 테스트 스크립트
 * Stage2 결과를 시뮬레이션하고 enhancedEntityExtractor를 직접 호출
 */

const fs = require('fs');
const path = require('path');

// enhancedEntityExtractor 직접 임포트 (ES 모듈)
async function testStage3Direct() {
  console.log('🧪 Stage3 직접 테스트 시작...');
  
  try {
    // Stage2 결과 시뮬레이션 (실제 API 응답 기반)
    const mockStage2Result = {
      output: [
        {
          date: "2023-08-07",
          hospitals: ["삼성서울병원", "에스엠영상의학과의원"],
          items: [
            {
              date: "2023-08-07",
              hospital: "삼성서울병원",
              rawText: "2023/08/07 CT와 비교해서 right liver의 hemangioma는 8.7cm로 이전보다 더 커졌음. 진단명: Hemangioma of liver. 삼성서울병원에서 치료받음.",
              keywordMatches: ["CT", "진단"]
            },
            {
              date: "2023-08-07", 
              hospital: "에스엠영상의학과의원",
              rawText: "에스엠영상의학과의원에서 복부 CT 촬영. Giant hepatic hemangioma about 8 x 6cm sized at right lobe 진단.",
              keywordMatches: ["CT"]
            }
          ]
        },
        {
          date: "2024-04-09",
          hospitals: ["삼성서울병원"],
          items: [
            {
              date: "2024-04-09",
              hospital: "삼성서울병원", 
              rawText: "소화기내과 진료. 간종괴 2017년 간혈관종 4.5cm 진단됨. 진단명: Hemangioma of liver. 간혈관종, 크기 증가.",
              keywordMatches: ["진단"]
            }
          ]
        }
      ]
    };

    console.log('📊 Mock Stage2 결과:');
    console.log(`- 날짜 그룹: ${mockStage2Result.output.length}개`);
    console.log(`- 첫 번째 그룹 병원: ${mockStage2Result.output[0].hospitals.join(', ')}`);
    console.log(`- 첫 번째 아이템 텍스트: ${mockStage2Result.output[0].items[0].rawText.substring(0, 100)}...`);

    // extractTextFromStage2 로직 복제
    const allTextParts = [];
    let totalHospitals = new Set();
    let totalItems = 0;
    
    mockStage2Result.output.forEach((dateGroup) => {
      console.log(`📅 처리 중: ${dateGroup.date} (${dateGroup.hospitals?.length || 0}개 병원)`);
      
      if (dateGroup.hospitals) {
        dateGroup.hospitals.forEach(h => totalHospitals.add(h));
      }
      
      if (dateGroup.items && Array.isArray(dateGroup.items)) {
        dateGroup.items.forEach(item => {
          if (item.rawText) {
            const contextualText = `
[날짜: ${item.date || dateGroup.date}]
[병원: ${item.hospital || '미상'}]
${item.rawText}
---`;
            allTextParts.push(contextualText);
            totalItems++;
          }
        });
      }
    });
    
    const combinedText = allTextParts.join('\n');
    
    console.log('\n✅ 텍스트 추출 완료:');
    console.log(`- 총 텍스트 길이: ${combinedText.length}자`);
    console.log(`- 고유 병원 수: ${totalHospitals.size}개`);
    console.log(`- 총 아이템 수: ${totalItems}개`);
    console.log(`- 병원 목록: ${Array.from(totalHospitals).join(', ')}`);
    
    // 텍스트 저장
    fs.writeFileSync('temp/debug-direct-stage3-input.txt', combinedText, 'utf8');
    console.log('\n📁 텍스트 저장: temp/debug-direct-stage3-input.txt');
    
    // 수동 엔티티 추출 테스트
    console.log('\n🔍 수동 엔티티 추출 테스트:');
    
    // 병원명 패턴 테스트
    const hospitalPattern = /([가-힣\s]{2,20})(병원|의원|대학병원|종합병원|전문병원|요양병원|한방병원|치과병원|의료원|보건소|보건지소|클리닉|센터)/g;
    const hospitals = [];
    let match;
    while ((match = hospitalPattern.exec(combinedText)) !== null) {
      hospitals.push(match[1] + match[2]);
    }
    
    // 진단명 패턴 테스트
    const diagnosisPattern = /(진단명?[:：]\s*)([가-힣\s,()A-Za-z]{5,100})/g;
    const diagnoses = [];
    while ((match = diagnosisPattern.exec(combinedText)) !== null) {
      diagnoses.push(match[2].trim());
    }
    
    console.log(`🏥 병원명 추출: ${hospitals.length}개`);
    hospitals.forEach((h, i) => console.log(`   ${i+1}. ${h}`));
    
    console.log(`🩺 진단명 추출: ${diagnoses.length}개`);
    diagnoses.forEach((d, i) => console.log(`   ${i+1}. ${d}`));
    
    // 키워드 검색
    console.log('\n🔍 키워드 검색:');
    console.log(`- "삼성서울병원": ${combinedText.includes('삼성서울병원') ? '✅' : '❌'}`);
    console.log(`- "에스엠영상의학과의원": ${combinedText.includes('에스엠영상의학과의원') ? '✅' : '❌'}`);
    console.log(`- "Hemangioma": ${combinedText.includes('Hemangioma') ? '✅' : '❌'}`);
    console.log(`- "진단명": ${combinedText.includes('진단명') ? '✅' : '❌'}`);
    
    console.log('\n🎯 결론:');
    if (hospitals.length > 0 || diagnoses.length > 0) {
      console.log('✅ 수동 추출 성공! enhancedEntityExtractor 로직에 문제가 있을 수 있습니다.');
    } else {
      console.log('❌ 수동 추출도 실패. 텍스트 자체에 문제가 있을 수 있습니다.');
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

testStage3Direct(); 