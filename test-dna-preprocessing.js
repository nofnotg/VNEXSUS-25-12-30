/**
 * DNA 전처리 로직 직접 테스트 - TextArrayDateController 검증
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TextArrayDateController } from './src/dna-engine/core/textArrayDateControllerComplete.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testTextArrayDateController() {
  try {
    console.log('🧬 TextArrayDateController 테스트 시작...');
    
    // Case1 데이터 로드
    const case1Path = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
    const case1Content = fs.readFileSync(case1Path, 'utf-8');
    
    console.log('📄 Case1 데이터 로드 완료');
    console.log(`📊 텍스트 길이: ${case1Content.length}자`);
    
    // 작은 샘플로 테스트 (메모리 문제 방지)
    const sampleText = case1Content.substring(0, 5000);
    console.log('\n📝 테스트 샘플 (첫 5000자):');
    console.log(sampleText.substring(0, 500) + '...');
    
    // TextArrayDateController 인스턴스 생성
    console.log('\n🔧 TextArrayDateController 인스턴스 생성...');
    const controller = new TextArrayDateController();
    
    console.log('\n🔬 processDocumentDateArrays 실행...');
    const startTime = Date.now();
    
    // 옵션 설정
    const options = {
      enableDNASequencing: true,
      enableAdvancedClassification: true,
      confidenceThreshold: 0.7,
      maxProcessingTime: 30000 // 30초 제한
    };
    
    console.log('옵션:', JSON.stringify(options, null, 2));
    
    // DNA 전처리 실행
    const result = await controller.processDocumentDateArrays(sampleText, options);
    
    const processingTime = Date.now() - startTime;
    
    console.log('\n✅ processDocumentDateArrays 완료!');
    console.log(`⏱️ 처리 시간: ${processingTime}ms`);
    
    // 결과 분석
    console.log('\n📊 결과 분석:');
    console.log('='.repeat(60));
    
    console.log('\n🔍 결과 구조:');
    console.log('- success:', result.success);
    console.log('- result 존재:', !!result.result);
    
    if (result.success && result.result) {
      const resultData = result.result;
      
      console.log('\n📈 통계 정보:');
      if (resultData.documentSummary) {
        console.log('- 총 날짜 수:', resultData.documentSummary.totalDates || 0);
        console.log('- 처리된 배열:', resultData.documentSummary.processedArrays || 0);
      }
      
      if (resultData.qualityMetrics) {
        console.log('- 전체 신뢰도:', (resultData.qualityMetrics.overallConfidence * 100).toFixed(1) + '%');
      }
      
      if (resultData.dnaAnalysis) {
        console.log('- DNA 패턴 수:', resultData.dnaAnalysis.patterns?.length || 0);
      }
      
      // 추출된 날짜들
      if (resultData.extractedDates && resultData.extractedDates.length > 0) {
        console.log('\n📅 추출된 날짜들:');
        resultData.extractedDates.slice(0, 10).forEach((dateInfo, index) => {
          console.log(`${index + 1}. ${dateInfo.standardizedDate || dateInfo.originalText}`);
          if (dateInfo.confidence) {
            console.log(`   신뢰도: ${(dateInfo.confidence * 100).toFixed(1)}%`);
          }
          if (dateInfo.context) {
            console.log(`   맥락: "${dateInfo.context.substring(0, 100)}..."`);
          }
        });
        
        if (resultData.extractedDates.length > 10) {
          console.log(`   ... 및 ${resultData.extractedDates.length - 10}개 더`);
        }
      } else {
        console.log('\n❌ 추출된 날짜가 없습니다!');
      }
      
      // 텍스트 배열 정보
      if (resultData.textArrays && resultData.textArrays.length > 0) {
        console.log('\n📋 텍스트 배열 정보:');
        console.log(`- 총 배열 수: ${resultData.textArrays.length}`);
        
        resultData.textArrays.slice(0, 3).forEach((array, index) => {
          console.log(`\n배열 ${index + 1}:`);
          console.log(`  내용: "${array.content?.substring(0, 100) || 'N/A'}..."`);
          console.log(`  분류: ${array.classification || 'N/A'}`);
          if (array.dates && array.dates.length > 0) {
            console.log(`  날짜: ${array.dates.map(d => d.date || d.originalText).join(', ')}`);
          }
        });
      }
      
      // 성능 메트릭
      if (resultData.performance) {
        console.log('\n⚡ 성능 메트릭:');
        console.log(`- 전체 처리 시간: ${resultData.performance.totalTime || processingTime}ms`);
        console.log(`- DNA 분석 시간: ${resultData.performance.dnaAnalysisTime || 'N/A'}ms`);
        console.log(`- 분류 시간: ${resultData.performance.classificationTime || 'N/A'}ms`);
      }
      
    } else {
      console.log('❌ 처리 실패 또는 결과 없음');
      if (result.error) {
        console.log(`오류: ${result.error}`);
      }
      if (result.message) {
        console.log(`메시지: ${result.message}`);
      }
    }
    
    // 전체 결과를 파일로 저장
    const outputPath = path.join(__dirname, 'temp', 'textarray-controller-test.json');
    
    // temp 디렉토리 생성
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify({
      testInfo: {
        timestamp: new Date().toISOString(),
        processingTime,
        inputLength: sampleText.length,
        options
      },
      result
    }, null, 2));
    
    console.log(`\n💾 상세 결과가 저장되었습니다: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ TextArrayDateController 테스트 실패:', error);
    console.error('스택 트레이스:', error.stack);
    
    // 에러 정보도 저장
    try {
      const errorOutputPath = path.join(__dirname, 'temp', 'textarray-controller-error.json');
      const tempDir = path.dirname(errorOutputPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(errorOutputPath, JSON.stringify({
        error: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }, null, 2));
      
      console.log(`💾 에러 정보가 저장되었습니다: ${errorOutputPath}`);
    } catch (saveError) {
      console.error('에러 저장 실패:', saveError);
    }
  }
}

// 테스트 실행
testTextArrayDateController();