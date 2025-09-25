/**
 * 🧪 AI 엔티티 추출기 직접 테스트
 * 
 * API 서버 없이 aiEntityExtractor 모듈을 직접 테스트
 */

const fs = require('fs');

async function testAIExtractorDirect() {
  console.log('🧪 AI 엔티티 추출기 직접 테스트 시작...\n');
  
  try {
    // ES6 모듈 동적 import
    const { default: aiEntityExtractor } = await import('../backend/postprocess/aiEntityExtractor.js');
    
    // Case2 데이터 로드
    const caseContent = fs.readFileSync('C:\\Users\\Chung\\OneDrive\\바탕 화면\\MediAI_MVP_v6\\documents\\fixtures\\Cast2_fulltext.txt', 'utf-8');
    console.log(`📄 Case2 원본 텍스트 길이: ${caseContent.length}자`);
    console.log(`📄 처음 300자: ${caseContent.substring(0, 300)}...\n`);

    // AI 엔티티 추출 실행
    console.log('🤖 AI 엔티티 추출 시작...');
    const startTime = Date.now();
    
    const result = await aiEntityExtractor.extractAllEntities(caseContent);
    
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`⏱️ 처리 시간: ${processingTime}초\n`);

    // 결과 분석
    console.log('📊 추출 결과 분석:');
    console.log('=====================================');
    console.log(`🏥 병원: ${result.statistics.uniqueHospitals}개`);
    console.log(`🔬 진단: ${result.statistics.uniqueDiagnoses}개`);
    console.log(`👨‍⚕️ 의료진: ${result.statistics.totalDoctors}개`);
    console.log(`💊 치료: ${result.statistics.totalTreatments}개`);
    console.log(`📅 방문: ${result.statistics.totalVisits}회`);
    console.log(`🎯 추출 방법: ${result.extractionMethod}`);
    console.log('=====================================\n');

    // 상세 결과 출력
    if (result.hospitals.length > 0) {
      console.log('🏥 추출된 병원 (상위 5개):');
      result.hospitals.slice(0, 5).forEach((h, i) => {
        console.log(`   ${i+1}. ${h.name} (${h.type}) - 신뢰도: ${h.confidence}`);
      });
      console.log('');
    }

    if (result.diagnoses.length > 0) {
      console.log('🔬 추출된 진단 (상위 5개):');
      result.diagnoses.slice(0, 5).forEach((d, i) => {
        console.log(`   ${i+1}. ${d.name} ${d.code ? `(${d.code})` : ''} - 신뢰도: ${d.confidence}`);
      });
      console.log('');
    }

    if (result.visits.length > 0) {
      console.log('📅 추출된 방문 (상위 5개):');
      result.visits.slice(0, 5).forEach((v, i) => {
        console.log(`   ${i+1}. ${v.date} - ${v.hospital} (${v.purpose})`);
      });
      console.log('');
    }

    // 성공 여부 판단
    const isSuccess = result.statistics.uniqueHospitals > 0 && 
                     result.statistics.uniqueDiagnoses > 0;

    if (isSuccess) {
      console.log('🎉 AI 엔티티 추출 성공!');
      
      // 결과 저장
      const outputDir = 'temp/ai-direct-test';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(
        `${outputDir}/case2_ai_extraction_result.json`, 
        JSON.stringify(result, null, 2), 
        'utf8'
      );
      
      console.log(`💾 결과 저장: ${outputDir}/case2_ai_extraction_result.json`);
      
    } else {
      console.log('❌ AI 엔티티 추출 실패');
      console.log('🔍 OpenAI API 키 또는 네트워크 연결을 확인하세요.');
    }

  } catch (error) {
    console.error('💥 테스트 실패:', error.message);
    
    if (error.message.includes('OPENAI_API_KEY')) {
      console.log('\n💡 해결방법:');
      console.log('   1. backend/.env 파일에 OPENAI_API_KEY 설정 확인');
      console.log('   2. 유효한 OpenAI API 키인지 확인');
    }
    
    if (error.message.includes('rate limit')) {
      console.log('\n💡 Rate Limit 해결방법:');
      console.log('   1. 잠시 대기 후 재시도');
      console.log('   2. 다른 API 키 사용');
    }
  }
}

// 실행
if (require.main === module) {
  testAIExtractorDirect().catch(console.error);
}

module.exports = { testAIExtractorDirect }; 