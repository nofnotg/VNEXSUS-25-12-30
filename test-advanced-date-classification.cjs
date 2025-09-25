const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function testAdvancedDateClassification() {
  try {
    console.log('=== 고급 날짜 분류 기능 테스트 ===\n');
    
    // Case1.txt 파일 읽기
    const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
    const content = fs.readFileSync(casePath, 'utf-8');
    
    // 첫 10000자로 테스트 (더 많은 데이터)
    const testContent = content.substring(0, 10000);
    
    console.log(`테스트 데이터 크기: ${testContent.length}자`);
    console.log(`테스트 라인 수: ${testContent.split('\n').length}\n`);
    
    const serverUrl = 'http://localhost:3030';
    
    // 1. 고급 날짜 분석 API 테스트
    console.log('=== 1. 고급 날짜 분석 API 테스트 ===');
    try {
      const dateAnalysisResponse = await axios.post(`${serverUrl}/api/dev/studio/date-analysis/analyze`, {
        text: testContent,
        options: {
          enableAdvancedClassification: true,
          includeContextualAnalysis: true,
          validateDateConsistency: true
        }
      }, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`응답 상태: ${dateAnalysisResponse.status}`);
      if (dateAnalysisResponse.data) {
        const result = dateAnalysisResponse.data;
        console.log('날짜 분석 결과:');
        console.log(JSON.stringify(result, null, 2));
        
        // 결과 저장
        const outputPath = path.join(__dirname, 'temp/advanced-date-analysis-result.json');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`결과 저장: ${outputPath}\n`);
      }
    } catch (error) {
      console.log(`날짜 분석 API 오류: ${error.message}\n`);
    }
    
    // 2. 배치 분석 API 테스트
    console.log('=== 2. 배치 분석 API 테스트 ===');
    try {
      const batchResponse = await axios.post(`${serverUrl}/api/dev/studio/date-analysis/batch-analyze`, {
        texts: [
          testContent.substring(0, 2000),
          testContent.substring(2000, 4000),
          testContent.substring(4000, 6000)
        ],
        options: {
          enableDateExtraction: true,
          enableContextAnalysis: true
        }
      }, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`응답 상태: ${batchResponse.status}`);
      if (batchResponse.data) {
        const result = batchResponse.data;
        console.log('배치 분석 결과:');
        console.log(JSON.stringify(result, null, 2));
        
        // 결과 저장
        const outputPath = path.join(__dirname, 'temp/batch-analysis-result.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`결과 저장: ${outputPath}\n`);
      }
    } catch (error) {
      console.log(`배치 분석 API 오류: ${error.message}\n`);
    }
    
    // 3. 결과 검증 API 테스트
    console.log('=== 3. 결과 검증 API 테스트 ===');
    try {
      const validationResponse = await axios.post(`${serverUrl}/api/dev/studio/date-analysis/validate`, {
        originalText: testContent,
        extractedDates: [
          '2025-03-24',
          '2025-03-10', 
          '2025-02-17'
        ],
        validationLevel: 'comprehensive'
      }, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`응답 상태: ${validationResponse.status}`);
      if (validationResponse.data) {
        const result = validationResponse.data;
        console.log('검증 결과:');
        console.log(JSON.stringify(result, null, 2));
        
        // 결과 저장
        const outputPath = path.join(__dirname, 'temp/validation-result.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`결과 저장: ${outputPath}\n`);
      }
    } catch (error) {
      console.log(`결과 검증 API 오류: ${error.message}\n`);
    }
    
    // 4. 타임라인 생성 API 테스트
    console.log('=== 4. 타임라인 생성 API 테스트 ===');
    try {
      const timelineResponse = await axios.get(`${serverUrl}/api/dev/studio/date-analysis/timeline/test123`, {
        timeout: 60000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`응답 상태: ${timelineResponse.status}`);
      if (timelineResponse.data) {
        const result = timelineResponse.data;
        console.log('타임라인 생성 결과:');
        console.log(JSON.stringify(result, null, 2));
        
        // 결과 저장
        const outputPath = path.join(__dirname, 'temp/timeline-result.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`결과 저장: ${outputPath}\n`);
      }
    } catch (error) {
      console.log(`타임라인 생성 API 오류: ${error.message}\n`);
    }
    
    console.log('=== 모든 테스트 완료 ===');
    
  } catch (error) {
    console.error('전체 테스트 실패:', error.message);
  }
}

// 테스트 실행
testAdvancedDateClassification();