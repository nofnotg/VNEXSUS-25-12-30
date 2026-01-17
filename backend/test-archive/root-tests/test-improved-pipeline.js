import fs from 'fs';
import fetch from 'node-fetch';

async function testImprovedPipeline() {
  console.log('🧪 개선된 파이프라인으로 Case2 테스트 시작...');
  
  // Case2 데이터 로드
  const caseContent = fs.readFileSync('documents/fixtures/Cast2_fulltext.txt', 'utf-8');
  
  console.log('📊 테스트 데이터:');
  console.log(`  - 파일 크기: ${caseContent.length}자`);
  console.log(`  - 한글 비율: ${((caseContent.match(/[가-힣]/g) || []).length / caseContent.length * 100).toFixed(1)}%`);
  console.log(`  - 미리보기: ${caseContent.substring(0, 100).replace(/\n/g, ' ')}...`);
  
  try {
    console.log('\n🚀 개선된 4단계 파이프라인 실행...');
    
    const response = await fetch('http://localhost:3031/api/enhanced-dna-validation/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedText: caseContent,
        patientInfo: { insuranceJoinDate: '2023-01-01' }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 개선된 파이프라인 성공!');
      console.log(`⏱️ 총 처리 시간: ${result.processingTime}초`);
      
      console.log('\n📊 Stage별 결과:');
      ['stage1', 'stage2', 'stage3', 'stage4'].forEach(stage => {
        const stageResult = result.pipelineResults[stage];
        if (stageResult) {
          console.log(`\n🔍 ${stage.toUpperCase()}: ${stageResult.name}`);
          console.log(`   성공: ${stageResult.success ? '✅' : '❌'}`);
          
          if (stageResult.summary) {
            Object.entries(stageResult.summary).forEach(([key, value]) => {
              console.log(`   ${key}: ${value}`);
            });
          }
          
          if (stageResult.error) {
            console.log(`   오류: ${stageResult.error}`);
          }
        }
      });
      
      console.log('\n📄 최종 보고서:');
      console.log('=' .repeat(50));
      console.log(result.finalReport);
      console.log('=' .repeat(50));
      
      // 품질 평가
      const reportLength = result.finalReport.length;
      const hasHospitals = /병원|의원|클리닉/.test(result.finalReport);
      const hasDiagnoses = /진단|질병|병명/.test(result.finalReport);
      const hasPatientInfo = /환자|김미화/.test(result.finalReport);
      const hasStats = /\d+회/.test(result.finalReport);
      
      console.log('\n📈 품질 평가:');
      console.log(`   보고서 길이: ${reportLength}자`);
      console.log(`   병원 정보 포함: ${hasHospitals ? '✅' : '❌'}`);
      console.log(`   진단 정보 포함: ${hasDiagnoses ? '✅' : '❌'}`);
      console.log(`   환자 정보 포함: ${hasPatientInfo ? '✅' : '❌'}`);
      console.log(`   방문 통계 포함: ${hasStats ? '✅' : '❌'}`);
      
    } else {
      console.error('❌ 파이프라인 실패:', result.error);
    }
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

testImprovedPipeline().catch(console.error); 