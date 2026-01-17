import fs from 'fs';
import fetch from 'node-fetch';

async function testStage3Fix() {
  console.log('🔧 Stage3 수정사항 테스트 시작...');
  
  // Case2 데이터 로드
  const caseContent = fs.readFileSync('documents/fixtures/Cast2_fulltext.txt', 'utf-8');
  
  console.log('📊 테스트 데이터:');
  console.log('  - 파일 크기:', caseContent.length, '자');
  console.log('  - 한글 비율:', ((caseContent.match(/[가-힣]/g) || []).length / caseContent.length * 100).toFixed(1), '%');
  console.log('  - 병원명 키워드 포함:', caseContent.includes('병원') ? '✅' : '❌');
  console.log('  - 진단명 키워드 포함:', caseContent.includes('진단') ? '✅' : '❌');
  
  try {
    console.log('\n🚀 4단계 파이프라인 실행...');
    
    const response = await fetch('http://localhost:3030/api/enhanced-dna-validation/analyze', {
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
      console.log('✅ 파이프라인 실행 성공!');
      
      // Stage별 상세 결과 출력
      console.log('\n📊 Stage별 상세 결과:');
      ['stage1', 'stage2', 'stage3', 'stage4'].forEach(stage => {
        const stageResult = result.pipelineResults[stage];
        if (stageResult) {
          console.log(`\n🔹 ${stage.toUpperCase()}: ${stageResult.name}`);
          console.log(`   성공: ${stageResult.success !== false ? '✅' : '❌'}`);
          
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
      
      // Stage3 특별 확인
      const stage3 = result.pipelineResults.stage3;
      if (stage3) {
        console.log('\n🏥 Stage3 핵심 지표:');
        console.log(`   병원 추출: ${stage3.summary?.uniqueHospitals || 0}개`);
        console.log(`   진단명 추출: ${stage3.summary?.uniqueDiagnoses || 0}개`);
        console.log(`   방문 횟수: ${stage3.summary?.totalVisits || 0}회`);
        
        if (stage3.summary?.uniqueHospitals > 0) {
          console.log('   🎉 Stage3 병원 추출 성공!');
        } else {
          console.log('   ⚠️ Stage3 병원 추출 여전히 실패');
        }
      }
      
      console.log('\n📄 최종 AI 보고서 (처음 500자):');
      const report = result.finalReport || '보고서 없음';
      console.log(report.substring(0, 500) + (report.length > 500 ? '...' : ''));
      
      // 품질 평가
      console.log('\n📈 품질 평가:');
      console.log(`   보고서 길이: ${report.length}자`);
      console.log(`   환자 정보 포함: ${!report.includes('환자명 미상') ? '✅' : '❌'}`);
      console.log(`   의료 이벤트 포함: ${!report.includes('의료 이벤트 없음') ? '✅' : '❌'}`);
      
    } else {
      console.error('❌ 파이프라인 실패:', result.error);
      if (result.details) {
        console.error('상세 정보:', result.details);
      }
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 서버가 실행되지 않았을 수 있습니다.');
      console.log('   다음 명령으로 서버를 시작하세요: npm start');
    }
  }
}

testStage3Fix();