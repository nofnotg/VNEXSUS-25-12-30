/**
 * 웹 API를 통한 간단한 DNA 전처리 테스트
 * 실제 서버에 HTTP 요청을 보내서 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testWebAPI() {
  try {
    console.log('🌐 웹 API 테스트 시작');
    
    // Case1.txt 파일 정보 확인
    const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
    const fullText = fs.readFileSync(casePath, 'utf8');
    const lines = fullText.split('\n');
    const fileStats = fs.statSync(casePath);
    
    console.log(`📄 Case1.txt 파일 정보:`);
    console.log(`   - 전체 크기: ${fileStats.size} bytes (${(fileStats.size/1024).toFixed(2)} KB)`);
    console.log(`   - 전체 줄 수: ${lines.length}줄`);
    console.log(`   - 전체 문자 수: ${fullText.length}자`);
    
    // 작은 텍스트 샘플 준비 (처음 1000자)
    const sampleText = fullText.substring(0, 1000);
    const sampleLines = sampleText.split('\n').length;
    
    console.log(`\n📋 테스트 샘플 정보:`);
    console.log(`   - 샘플 크기: ${sampleText.length}자`);
    console.log(`   - 샘플 줄 수: ${sampleLines}줄`);
    
    // API 요청 데이터
    const requestData = {
      text: sampleText,
      options: {
        enableDNASequencing: true,
        enableAdvancedClassification: true
      }
    };
    
    console.log('🚀 API 요청 전송 중...');
    
    // fetch를 사용하여 API 호출
    const response = await fetch('http://localhost:3030/api/dev/studio/preprocess-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    console.log(`📡 응답 상태: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      
      console.log('\n=== API 응답 결과 ===');
      console.log('성공 여부:', result.success);
      
      if (result.success && result.results) {
        const stats = result.results.statistics;
        console.log('\n📊 통계:');
        console.log('- 총 날짜 수:', stats?.totalDates || 0);
        console.log('- DNA 패턴 수:', stats?.dnaPatterns || 0);
        console.log('- 신뢰도:', stats?.confidenceScore || 0);
        console.log('- 처리 시간:', stats?.processingTime || 'N/A');
        
        // 추출된 날짜 확인
        const dateAnalysis = result.results.dateAnalysis;
        if (dateAnalysis?.result?.extractedDates) {
          console.log('\n📅 추출된 날짜:');
          dateAnalysis.result.extractedDates.forEach((date, index) => {
            console.log(`  ${index + 1}. ${date.date} (신뢰도: ${date.confidence}%)`);
          });
        } else {
          console.log('\n❌ 추출된 날짜가 없습니다.');
        }
        
        // 결과 저장
        const outputPath = path.join(__dirname, 'temp/web-api-test-result.json');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`\n💾 결과 저장: ${outputPath}`);
        
      } else {
        console.log('❌ API 실패:', result.error || '알 수 없는 오류');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ HTTP 오류:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error.message);
    
    // 서버가 실행 중인지 확인
    try {
      const healthCheck = await fetch('http://localhost:3000/health');
      if (healthCheck.ok) {
        console.log('✅ 서버는 실행 중입니다.');
      } else {
        console.log('⚠️ 서버 상태 확인 필요');
      }
    } catch (healthError) {
      console.log('❌ 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
    }
  }
}

// 테스트 실행
testWebAPI();