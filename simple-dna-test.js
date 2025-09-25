/**
 * 간단한 DNA 전처리 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EnhancedDateAnchor } from './src/dna-engine/core/enhancedDateAnchor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function simpleDNATest() {
  try {
    console.log('🧬 간단한 DNA 테스트 시작...');
    
    // Case1 데이터 로드
    const case1Path = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
    const case1Content = fs.readFileSync(case1Path, 'utf-8');
    
    console.log(`📄 Case1 데이터 로드 완료 (${case1Content.length}자)`);
    
    // 작은 샘플로 테스트
    const sampleText = case1Content.substring(0, 1000);
    console.log('\n📝 테스트 샘플:');
    console.log(sampleText);
    
    // EnhancedDateAnchor 인스턴스 생성
    console.log('\n🔧 EnhancedDateAnchor 인스턴스 생성...');
    const dateAnchor = new EnhancedDateAnchor();
    
    console.log('\n🔬 dualSweepAnalysis 실행...');
    const result = await dateAnchor.dualSweepAnalysis(sampleText, {});
    
    console.log('\n✅ dualSweepAnalysis 완료!');
    console.log('결과:', JSON.stringify(result, null, 2));
    
    // 결과 요약
    if (result.success) {
      const primaryCount = result.result?.primary?.length || 0;
      const secondaryCount = result.result?.secondary?.length || 0;
      
      console.log('\n📊 결과 요약:');
      console.log(`- Primary 날짜: ${primaryCount}개`);
      console.log(`- Secondary 날짜: ${secondaryCount}개`);
      console.log(`- 전체 신뢰도: ${result.result?.confidence || 'N/A'}`);
      
      if (primaryCount > 0) {
        console.log('\n🎯 Primary 날짜들:');
        result.result.primary.forEach((date, index) => {
          console.log(`  ${index + 1}. ${date.normalized?.date || date.text} (신뢰도: ${date.confidence})`);
        });
      }
      
      if (secondaryCount > 0) {
        console.log('\n📋 Secondary 날짜들:');
        result.result.secondary.forEach((date, index) => {
          console.log(`  ${index + 1}. ${date.normalized?.date || date.text} (신뢰도: ${date.confidence})`);
        });
      }
    } else {
      console.log('❌ 분석 실패:', result.error);
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    console.error('스택 트레이스:', error.stack);
  }
}

// 실행
simpleDNATest();