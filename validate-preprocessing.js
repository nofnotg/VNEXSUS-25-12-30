/**
 * DNA 전처리 검증 스크립트
 * AI 처리 없이 전처리 부분만 검증
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validatePreprocessing() {
  try {
    console.log('🔍 DNA 전처리 검증 시작');
    
    // 1. 케이스 샘플 파일들 확인
    const caseSampleDir = path.join(__dirname, 'src/rag/case_sample');
    const files = fs.readdirSync(caseSampleDir).filter(f => f.endsWith('.txt') && !f.includes('_report'));
    
    console.log('\n📁 케이스 샘플 파일들:');
    files.forEach((file, index) => {
      const filePath = path.join(caseSampleDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      
      console.log(`${index + 1}. ${file}:`);
      console.log(`   - 크기: ${stats.size} bytes (${(stats.size/1024).toFixed(2)} KB)`);
      console.log(`   - 줄 수: ${lines}줄`);
      console.log(`   - 문자 수: ${content.length}자`);
    });
    
    // 2. Case1.txt 상세 분석
    console.log('\n🔬 Case1.txt 상세 분석:');
    const case1Path = path.join(caseSampleDir, 'Case1.txt');
    const case1Content = fs.readFileSync(case1Path, 'utf8');
    const case1Lines = case1Content.split('\n');
    
    console.log(`전체 내용 (처음 500자):`);
    console.log(case1Content.substring(0, 500));
    console.log('...');
    
    // 3. 웹 API 전처리 테스트 (작은 샘플)
    console.log('\n🌐 웹 API 전처리 테스트:');
    const sampleText = case1Content.substring(0, 2000); // 2000자 샘플
    
    const requestData = {
      text: sampleText,
      options: {
        enableDNASequencing: false, // AI 처리 비활성화
        enableAdvancedClassification: false,
        preprocessOnly: true // 전처리만 수행
      }
    };
    
    console.log('📤 API 요청 전송 중... (전처리만)');
    
    try {
      const response = await fetch('http://localhost:3030/api/dev/studio/preprocess-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        const result = await response.json();
        
        console.log('✅ 전처리 성공!');
        console.log('📊 전처리 결과:');
        console.log(`   - 추출된 날짜: ${result.results?.extractedDates?.length || 0}개`);
        console.log(`   - 추출된 병원: ${result.results?.extractedHospitals?.length || 0}개`);
        console.log(`   - 추출된 키워드: ${result.results?.extractedKeywords?.length || 0}개`);
        console.log(`   - 신뢰도: ${result.results?.statistics?.confidenceScore || 'N/A'}`);
        
        if (result.results?.extractedDates?.length > 0) {
          console.log('📅 추출된 날짜들:', result.results.extractedDates.slice(0, 5));
        }
        
        if (result.results?.extractedHospitals?.length > 0) {
          console.log('🏥 추출된 병원들:', result.results.extractedHospitals.slice(0, 3));
        }
        
      } else {
        console.log('❌ API 요청 실패:', response.status);
      }
    } catch (apiError) {
      console.log('❌ API 연결 실패:', apiError.message);
      console.log('💡 백엔드 서버가 실행 중인지 확인하세요.');
    }
    
    // 4. 메모리 사용량 체크
    const memUsage = process.memoryUsage();
    console.log('\n💾 메모리 사용량:');
    console.log(`   - RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n✅ 전처리 검증 완료!');
    
  } catch (error) {
    console.error('❌ 검증 중 오류 발생:', error.message);
    console.error(error.stack);
  }
}

// 실행
validatePreprocessing();