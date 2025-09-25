/**
 * 간단한 API 테스트
 */

const testData = {
  ocrText: `진료기록부

환자명: 홍길동
생년월일: 1980-05-15

=== 진료 기록 ===

2024-01-15
주소: 복통, 소화불량
진단: 급성 위염
처방: 위장약 3일분
의사: 김의사

2024-01-20
주소: 복통 지속
진단: 만성 위염 의심
검사: 위내시경 예약
의사: 김의사

2024-01-25
검사일: 2024-01-25
검사명: 위내시경
결과: 만성 표재성 위염 확인
소견: 헬리코박터 파일로리 양성
치료: 제균치료 시작`,
  options: {
    enableMassiveDateBlocks: true,
    sortOrder: 'asc',
    groupByDate: true
  }
};

async function testMassiveDateBlocks() {
  try {
    console.log('🧪 거대 날짜 블록 처리 API 테스트 시작...');
    
    const response = await fetch('http://localhost:3030/api/postprocess/massive-date-blocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('✅ API 응답 성공:');
    console.log('- 성공 여부:', result.success);
    console.log('- 처리된 블록 수:', result.data?.processedBlocks?.length || 0);
    console.log('- 처리 시간:', result.data?.processingTime || 'N/A');
    console.log('- 신뢰도:', result.data?.confidence || 'N/A');
    
    console.log('\n📊 전체 응답 데이터:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.data?.processedBlocks) {
      console.log('\n📋 처리된 블록들:');
      result.data.processedBlocks.forEach((block, index) => {
        console.log(`${index + 1}. ${block.date || 'No Date'}: ${block.content?.substring(0, 50) || 'No Content'}...`);
      });
    }
    
  } catch (error) {
    console.log('❌ 거대 날짜 블록 처리 테스트 실패:', error.message);
  }
}

async function testFullPostProcessing() {
  try {
    console.log('\n🔄 전체 후처리 파이프라인 테스트 시작...');
    
    const response = await fetch('http://localhost:3030/api/postprocess/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ocrText: testData.ocrText,
        options: {
          enableMassiveDateBlocks: true,
          sortByDate: true,
          groupByDate: true,
          enableEntityExtraction: true,
          enableReportGeneration: true
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('✅ 전체 후처리 파이프라인 성공:');
    console.log('- 성공 여부:', result.success);
    console.log('- 처리 시간:', result.data?.processingTime || 'N/A');
    console.log('- 엔티티 수:', result.data?.entities?.length || 0);
    console.log('- 날짜 블록 수:', result.data?.dateBlocks?.length || 0);
    
    if (result.data?.entities) {
      console.log('\n🏷️ 추출된 엔티티들:');
      result.data.entities.slice(0, 5).forEach((entity, index) => {
        console.log(`${index + 1}. ${entity.type}: ${entity.text} (신뢰도: ${entity.confidence})`);
      });
    }
    
    if (result.data?.dateBlocks) {
      console.log('\n📅 날짜 블록들:');
      result.data.dateBlocks.slice(0, 3).forEach((block, index) => {
        console.log(`${index + 1}. ${block.date}: ${block.content?.substring(0, 50)}...`);
      });
    }
    
  } catch (error) {
    console.log('❌ 전체 후처리 파이프라인 테스트 실패:', error.message);
  }
}

// Node.js 환경에서 fetch 사용을 위한 polyfill
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// 테스트 실행
async function runAllTests() {
  await testMassiveDateBlocks();
  await testFullPostProcessing();
}

runAllTests();