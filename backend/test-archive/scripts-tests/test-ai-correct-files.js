/**
 * 🧪 올바른 케이스 파일로 AI Stage3 테스트
 * 
 * src/rag/case_sample/ 디렉토리의 정확한 파일들 사용
 */

const fs = require('fs');

async function testAIWithCorrectFiles() {
  console.log('🧪 올바른 케이스 파일로 AI Stage3 테스트 시작...\n');
  
  try {
    // ES6 모듈 동적 import
    const { default: aiEntityExtractor } = await import('../backend/postprocess/aiEntityExtractor.js');
    
    // Case2 정확한 파일 로드
    const casePath = 'C:\\Users\\Chung\\OneDrive\\바탕 화면\\MediAI_MVP_v6\\src\\rag\\case_sample\\Case2.txt';
    const reportPath = 'C:\\Users\\Chung\\OneDrive\\바탕 화면\\MediAI_MVP_v6\\src\\rag\\case_sample\\Case2_report.txt';
    
    console.log('📄 파일 로딩...');
    const caseContent = fs.readFileSync(casePath, 'utf-8');
    const realReport = fs.readFileSync(reportPath, 'utf-8');
    
    console.log(`📊 Case2 원본 텍스트: ${caseContent.length}자`);
    console.log(`📋 실제 보고서: ${realReport.length}자`);
    console.log(`📄 처음 300자: ${caseContent.substring(0, 300)}...\n`);

    // AI 엔티티 추출 실행
    console.log('🤖 AI 엔티티 추출 시작...');
    const startTime = Date.now();
    
    const aiResult = await aiEntityExtractor.extractAllEntities(caseContent);
    
    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`⏱️ 처리 시간: ${processingTime}초\n`);

    // 결과 분석
    console.log('📊 AI 추출 결과:');
    console.log('=====================================');
    console.log(`🏥 병원: ${aiResult.statistics.uniqueHospitals}개`);
    console.log(`🔬 진단: ${aiResult.statistics.uniqueDiagnoses}개`);
    console.log(`👨‍⚕️ 의료진: ${aiResult.statistics.totalDoctors}개`);
    console.log(`💊 치료: ${aiResult.statistics.totalTreatments}개`);
    console.log(`📅 방문: ${aiResult.statistics.totalVisits}회`);
    console.log('=====================================\n');

    // 실제 보고서와 비교 분석
    console.log('🔍 실제 보고서 vs AI 추출 비교:');
    console.log('=====================================');
    
    // 실제 보고서에서 키워드 분석
    const reportKeywords = {
      hospitals: (realReport.match(/병원|의원|센터|클리닉/g) || []).length,
      diagnoses: (realReport.match(/진단|질병|병명/g) || []).length,
      treatments: (realReport.match(/치료|수술|처방|시술/g) || []).length,
      dates: (realReport.match(/\d{4}[-\.]\d{2}[-\.]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g) || []).length
    };
    
    console.log('실제 보고서 키워드 분석:');
    console.log(`  🏥 병원 관련: ${reportKeywords.hospitals}회 언급`);
    console.log(`  🔬 진단 관련: ${reportKeywords.diagnoses}회 언급`);
    console.log(`  💊 치료 관련: ${reportKeywords.treatments}회 언급`);
    console.log(`  📅 날짜 패턴: ${reportKeywords.dates}개 발견`);
    
    console.log('\nAI 추출 성과:');
    console.log(`  🏥 구체적 병원: ${aiResult.hospitals.length}개`);
    console.log(`  🔬 구체적 진단: ${aiResult.diagnoses.length}개`);
    console.log(`  💊 구체적 치료: ${aiResult.treatments.length}개`);
    console.log(`  📅 구체적 방문: ${aiResult.visits.length}회`);
    
    // 상세 추출 결과
    if (aiResult.hospitals.length > 0) {
      console.log('\n🏥 추출된 병원:');
      aiResult.hospitals.forEach((h, i) => {
        console.log(`   ${i+1}. ${h.name} (${h.type})`);
      });
    }

    if (aiResult.diagnoses.length > 0) {
      console.log('\n🔬 추출된 진단:');
      aiResult.diagnoses.forEach((d, i) => {
        console.log(`   ${i+1}. ${d.name} ${d.code ? `(${d.code})` : ''}`);
      });
    }

    if (aiResult.visits.length > 0) {
      console.log('\n📅 추출된 방문:');
      aiResult.visits.forEach((v, i) => {
        console.log(`   ${i+1}. ${v.date} - ${v.hospital}`);
      });
    }

    // 성공 여부 판단
    const isSuccess = aiResult.statistics.uniqueHospitals > 0 && 
                     aiResult.statistics.uniqueDiagnoses > 0;

    console.log('\n=====================================');
    if (isSuccess) {
      console.log('🎉 AI Stage3 성공! 올바른 파일로 검증 완료');
      
      // 품질 평가
      const qualityScore = Math.min(
        (aiResult.hospitals.length / Math.max(reportKeywords.hospitals, 1)) * 100,
        100
      );
      console.log(`📊 추출 품질 점수: ${qualityScore.toFixed(1)}%`);
      
    } else {
      console.log('❌ AI Stage3 실패: 올바른 파일에서도 추출 안됨');
    }

    // 결과 저장
    const outputDir = 'temp/ai-correct-files-test';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const testResult = {
      aiResult,
      realReport: { length: realReport.length, keywords: reportKeywords },
      comparison: { success: isSuccess, processingTime },
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      `${outputDir}/case2_correct_files_result.json`, 
      JSON.stringify(testResult, null, 2), 
      'utf8'
    );
    
    console.log(`💾 결과 저장: ${outputDir}/case2_correct_files_result.json`);

  } catch (error) {
    console.error('💥 테스트 실패:', error.message);
    
    if (error.message.includes('ENOENT')) {
      console.log('\n💡 파일 경로 확인:');
      console.log('   - Case2.txt 파일이 src/rag/case_sample/ 에 있는지 확인');
      console.log('   - Case2_report.txt 파일이 src/rag/case_sample/ 에 있는지 확인');
    }
  }
}

// 실행
if (require.main === module) {
  testAIWithCorrectFiles().catch(console.error);
}

module.exports = { testAIWithCorrectFiles }; 