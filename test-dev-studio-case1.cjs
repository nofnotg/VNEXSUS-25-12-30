const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function testDevStudioCase1Processing() {
  try {
    console.log('=== 개발자 스튜디오 Case1 데이터 처리 테스트 ===');
    
    // 1. Case1.txt 파일 읽기
    const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
    const content = fs.readFileSync(casePath, 'utf-8');
    
    console.log(`원본 파일 크기: ${content.length}자`);
    console.log(`원본 라인 수: ${content.split('\n').length}`);
    
    // 2. 개발자 스튜디오 API 호출 (텍스트 처리)
    const serverUrl = 'http://localhost:3030';
    
    console.log('\n=== API 테스트 시작 ===');
    
    // 텍스트 처리 API 호출
    const response = await axios.post(`${serverUrl}/api/dev/studio/preprocess-text`, {
      text: content.substring(0, 5000), // 첫 5000자만 테스트
      options: {
        advancedDateClassification: true,
        enableDNASequencing: true,
        useReportSample: true
      }
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n=== API 응답 분석 ===');
    console.log(`응답 상태: ${response.status}`);
    
    if (response.data) {
      const result = response.data;
      
      // 날짜 분류 결과 분석
      if (result.dateClassification) {
        console.log('\n=== 날짜 분류 결과 ===');
        console.log(`발견된 날짜 수: ${result.dateClassification.dates?.length || 0}`);
        
        if (result.dateClassification.dates) {
          result.dateClassification.dates.forEach((date, idx) => {
            console.log(`${idx + 1}. ${date.date} (신뢰도: ${date.confidence || 'N/A'})`);
          });
        }
      }
      
      // 이벤트 분류 결과 분석
      if (result.events) {
        console.log('\n=== 이벤트 분류 결과 ===');
        console.log(`총 이벤트 수: ${result.events.length}`);
        
        result.events.slice(0, 5).forEach((event, idx) => {
          console.log(`${idx + 1}. 날짜: ${event.date}, 텍스트: ${event.text?.substring(0, 100)}...`);
        });
      }
      
      // DNA 시퀀싱 결과
      if (result.dnaSequencing) {
        console.log('\n=== DNA 시퀀싱 결과 ===');
        console.log(`처리된 시퀀스: ${result.dnaSequencing.sequences?.length || 0}개`);
      }
      
      // 전체 결과를 파일로 저장
      const outputPath = path.join(__dirname, 'temp/dev-studio-case1-result.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`\n결과가 저장되었습니다: ${outputPath}`);
      
    } else {
      console.log('응답 데이터가 없습니다.');
    }
    
  } catch (error) {
    console.error('테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
  }
}

// 테스트 실행
testDevStudioCase1Processing();