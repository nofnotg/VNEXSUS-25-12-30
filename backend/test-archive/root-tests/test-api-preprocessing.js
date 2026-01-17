/**
 * API를 통한 DNA 전처리 테스트
 * devStudioController의 preprocessText 메서드를 직접 호출하여 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DevStudioController } from './backend/controllers/devStudioController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAPIPreprocessing() {
  try {
    console.log('🧪 API 기반 DNA 전처리 테스트 시작');
    
    // Case1.txt 로드 (첫 2000자)
    const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
    const fullText = fs.readFileSync(casePath, 'utf8');
    const sampleText = fullText.substring(0, 2000);
    
    console.log(`📄 테스트 텍스트 로드: ${sampleText.length}자`);
    console.log('텍스트 샘플:', sampleText.substring(0, 200) + '...');
    
    // DevStudioController 인스턴스 생성
    const controller = new DevStudioController();
    
    // Mock request/response 객체 생성
    const mockReq = {
      body: {
        text: sampleText,
        options: {
          enableDNASequencing: true,
          enableAdvancedClassification: true
        }
      }
    };
    
    let responseData = null;
    const mockRes = {
      json: (data) => {
        responseData = data;
        console.log('📊 API 응답 수신');
      },
      status: (code) => ({
        json: (data) => {
          responseData = { statusCode: code, ...data };
          console.log(`❌ 오류 응답 (${code}):`, data);
        }
      })
    };
    
    // preprocessText 메서드 호출
    console.log('🧬 preprocessText 메서드 호출 중...');
    await controller.preprocessText(mockReq, mockRes);
    
    if (responseData) {
      console.log('\n=== API 테스트 결과 ===');
      console.log('성공 여부:', responseData.success);
      
      if (responseData.success && responseData.results) {
        const results = responseData.results;
        
        console.log('\n📈 통계 정보:');
        console.log('- 총 날짜 수:', results.statistics?.totalDates || 0);
        console.log('- DNA 패턴 수:', results.statistics?.dnaPatterns || 0);
        console.log('- 신뢰도 점수:', results.statistics?.confidenceScore || 0);
        console.log('- 처리 시간:', results.statistics?.processingTime || 'N/A');
        
        console.log('\n🧬 DNA 분석 결과:');
        if (results.dateAnalysis?.result) {
          const dateResult = results.dateAnalysis.result;
          
          if (dateResult.documentSummary) {
            console.log('- 문서 요약:', dateResult.documentSummary);
          }
          
          if (dateResult.extractedDates && dateResult.extractedDates.length > 0) {
            console.log('\n📅 추출된 날짜들:');
            dateResult.extractedDates.forEach((date, index) => {
              console.log(`  ${index + 1}. ${date.date} (신뢰도: ${date.confidence}%)`);
              if (date.context) {
                console.log(`     컨텍스트: ${date.context.substring(0, 100)}...`);
              }
            });
          } else {
            console.log('❌ 추출된 날짜가 없습니다!');
          }
          
          if (dateResult.dnaAnalysis) {
            console.log('\n🧬 DNA 분석:');
            console.log('- 패턴:', dateResult.dnaAnalysis.patterns?.length || 0);
            console.log('- 시퀀스:', dateResult.dnaAnalysis.sequences?.length || 0);
          }
        } else {
          console.log('❌ DNA 분석 결과가 없습니다!');
        }
        
        // 결과를 파일로 저장
        const outputPath = path.join(__dirname, 'temp/api-preprocessing-result.json');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(responseData, null, 2));
        console.log(`\n💾 결과 저장: ${outputPath}`);
        
      } else {
        console.log('❌ API 호출 실패:', responseData.error || '알 수 없는 오류');
      }
    } else {
      console.log('❌ 응답 데이터가 없습니다.');
    }
    
  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
    console.error('스택 트레이스:', error.stack);
  }
}

// 테스트 실행
testAPIPreprocessing();