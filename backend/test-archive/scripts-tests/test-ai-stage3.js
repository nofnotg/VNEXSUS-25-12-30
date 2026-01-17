/**
 * 🧪 AI Stage3 테스트 스크립트
 * 
 * GPT-3.5-turbo 기반 엔티티 추출 성능 검증
 */

const fs = require('fs');
const fetch = require('node-fetch');

async function testAIStage3() {
  console.log('🧪 AI Stage3 테스트 시작...\n');
  
  try {
    // Case2 데이터 로드
    const caseContent = fs.readFileSync('documents/fixtures/Cast2_fulltext.txt', 'utf-8');
    console.log(`📄 Case2 원본 텍스트 길이: ${caseContent.length}자`);
    console.log(`📄 처음 200자: ${caseContent.substring(0, 200)}...\n`);

    // API 호출
    console.log('🔄 Enhanced DNA Validation API 호출 중...');
    const response = await fetch('http://localhost:3031/api/enhanced-dna-validation/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extractedText: caseContent
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ API 호출 성공!\n');
      
      // Stage별 결과 분석
      const stages = result.pipelineResults;
      
      console.log('📊 Stage별 성과 분석:');
      console.log('=====================================');
      
      // Stage1 분석
      if (stages.stage1) {
        console.log(`🔸 Stage1 (전처리): ${stages.stage1.summary?.segmentCount || 0}개 세그먼트`);
      }
      
      // Stage2 분석
      if (stages.stage2) {
        console.log(`🔸 Stage2 (날짜 조직화): ${stages.stage2.output?.length || 0}개 날짜 그룹`);
      }
      
      // Stage3 분석 (핵심)
      if (stages.stage3) {
        const stage3 = stages.stage3;
        console.log(`🤖 Stage3 (AI 엔티티 추출):`);
        console.log(`   - 병원: ${stage3.summary?.uniqueHospitals || 0}개`);
        console.log(`   - 진단: ${stage3.summary?.uniqueDiagnoses || 0}개`);
        console.log(`   - 방문: ${stage3.summary?.totalVisits || 0}회`);
        console.log(`   - 추출 방법: ${stage3.summary?.extractionMethod || 'Unknown'}`);
        console.log(`   - 처리 시간: ${stage3.processingTime || 0}초`);
        
        // 상세 엔티티 정보
        if (stage3.data) {
          console.log('\n🏥 추출된 병원:');
          (stage3.data.hospitals || []).slice(0, 5).forEach((h, i) => {
            console.log(`   ${i+1}. ${h.name} (${h.type})`);
          });
          
          console.log('\n🔬 추출된 진단:');
          (stage3.data.diagnoses || []).slice(0, 5).forEach((d, i) => {
            console.log(`   ${i+1}. ${d.name} ${d.code ? `(${d.code})` : ''}`);
          });
          
          console.log('\n👨‍⚕️ 추출된 의료진:');
          (stage3.data.doctors || []).slice(0, 3).forEach((doc, i) => {
            console.log(`   ${i+1}. ${doc.name} (${doc.specialty})`);
          });
        }
      }
      
      // Stage4 분석
      if (stages.stage4) {
        console.log(`🔸 Stage4 (AI 보고서): ${stages.stage4.data?.reportLength || 0}자 생성`);
      }
      
      console.log('\n=====================================');
      
      // 🎯 성공 기준 검증
      const stage3Success = stages.stage3?.summary?.uniqueHospitals > 0 && 
                           stages.stage3?.summary?.uniqueDiagnoses > 0;
      
      if (stage3Success) {
        console.log('🎉 AI Stage3 성공! 엔티티 추출 완료');
        
        // 결과 저장
        const outputDir = 'temp/ai-stage3-test';
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(
          `${outputDir}/case2_ai_stage3_result.json`, 
          JSON.stringify(stages.stage3, null, 2), 
          'utf8'
        );
        
        console.log(`💾 결과 저장: ${outputDir}/case2_ai_stage3_result.json`);
        
      } else {
        console.log('❌ AI Stage3 실패: 엔티티 추출되지 않음');
        console.log('🔍 문제 진단이 필요합니다.');
      }
      
    } else {
      console.error('❌ API 호출 실패:', result.message);
    }
    
  } catch (error) {
    console.error('💥 테스트 실패:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 해결방법:');
      console.log('   1. 서버가 실행 중인지 확인: http://localhost:3031');
      console.log('   2. backend 디렉토리에서 서버 시작: node run-app.js');
    }
  }
}

// 실행
if (require.main === module) {
  testAIStage3().catch(console.error);
}

module.exports = { testAIStage3 }; 