const fs = require('fs');
const fetch = require('node-fetch');

async function debugStage2Output() {
  console.log('🔍 Stage2 출력 데이터 디버깅...');
  
  // Case2 데이터 로드
  const caseContent = fs.readFileSync('documents/fixtures/Cast2_fulltext.txt', 'utf-8');
  
  try {
    const response = await fetch('http://localhost:3031/api/enhanced-dna-validation/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedText: caseContent,
        patientInfo: { insuranceJoinDate: '2023-01-01' }
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const stage2 = result.pipelineResults.stage2;
      
      console.log('\n📊 Stage2 전체 구조:');
      console.log(JSON.stringify(stage2, null, 2));
      
      console.log('\n🔍 Stage2 핵심 필드 분석:');
      console.log('- stage:', stage2.stage);
      console.log('- name:', stage2.name);
      console.log('- input:', stage2.input);
      console.log('- output type:', typeof stage2.output);
      console.log('- output is array:', Array.isArray(stage2.output));
      
      if (Array.isArray(stage2.output)) {
        console.log('- output length:', stage2.output.length);
        console.log('- first 3 items:');
        stage2.output.slice(0, 3).forEach((item, index) => {
          console.log(`  [${index}]:`, typeof item, JSON.stringify(item).substring(0, 200));
        });
      }
      
      // Stage1도 확인
      const stage1 = result.pipelineResults.stage1;
      console.log('\n📊 Stage1 비교 분석:');
      console.log('- Stage1 data type:', typeof stage1.data);
      console.log('- Stage1 data is array:', Array.isArray(stage1.data));
      
      if (Array.isArray(stage1.data)) {
        console.log('- Stage1 data length:', stage1.data.length);
        console.log('- Stage1 first item:', JSON.stringify(stage1.data[0]).substring(0, 200));
      }
      
    } else {
      console.error('❌ API 호출 실패:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 디버깅 실패:', error.message);
  }
}

debugStage2Output(); 