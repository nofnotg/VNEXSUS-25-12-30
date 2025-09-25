/**
 * DNA 전처리 메모리 문제 디버깅
 * 단계별로 메모리 사용량을 확인하며 문제 지점을 찾기
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getMemoryUsage() {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(used.external / 1024 / 1024 * 100) / 100
  };
}

async function debugMemoryIssue() {
  try {
    console.log('🔍 DNA 전처리 메모리 문제 디버깅 시작');
    console.log('초기 메모리:', getMemoryUsage());
    
    // 1. 작은 텍스트로 시작
    const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
    const fullText = fs.readFileSync(casePath, 'utf8');
    const smallText = fullText.substring(0, 200); // 매우 작은 샘플
    
    console.log(`\n📄 테스트 텍스트: ${smallText.length}자`);
    console.log('텍스트 로드 후 메모리:', getMemoryUsage());
    
    // 2. TextArrayDateController 로드
    console.log('\n🧬 TextArrayDateController 로드 중...');
    const { TextArrayDateController } = await import('./src/dna-engine/core/textArrayDateControllerComplete.js');
    console.log('클래스 로드 후 메모리:', getMemoryUsage());
    
    // 3. 인스턴스 생성
    console.log('\n🏗️ 인스턴스 생성 중...');
    const controller = new TextArrayDateController();
    console.log('인스턴스 생성 후 메모리:', getMemoryUsage());
    
    // 4. segmentTextIntoArrays만 테스트
    console.log('\n📊 텍스트 분할 테스트...');
    try {
      const arrays = await controller.segmentTextIntoArrays(smallText, {});
      console.log(`분할 완료: ${arrays.length}개 배열`);
      console.log('분할 후 메모리:', getMemoryUsage());
      
      // 5. EnhancedDateAnchor 직접 테스트
      console.log('\n⚓ EnhancedDateAnchor 직접 테스트...');
      const { EnhancedDateAnchor } = await import('./src/dna-engine/core/enhancedDateAnchor.js');
      const anchor = new EnhancedDateAnchor();
      console.log('DateAnchor 생성 후 메모리:', getMemoryUsage());
      
      // 6. dualSweepAnalysis 테스트 (작은 텍스트)
      console.log('\n🔄 dualSweepAnalysis 테스트...');
      const result = await anchor.dualSweepAnalysis(smallText, {});
      console.log('dualSweepAnalysis 완료');
      console.log('분석 후 메모리:', getMemoryUsage());
      
      if (result && result.result) {
        console.log(`추출된 날짜: ${result.result.primary?.length || 0}개`);
      }
      
      // 7. 점진적으로 텍스트 크기 증가
      const sizes = [500, 1000, 2000];
      for (const size of sizes) {
        console.log(`\n📈 텍스트 크기 ${size}자로 테스트...`);
        const testText = fullText.substring(0, size);
        
        try {
          const testResult = await anchor.dualSweepAnalysis(testText, {});
          console.log(`크기 ${size} 완료, 메모리:`, getMemoryUsage());
          
          if (testResult && testResult.result) {
            console.log(`  - 추출된 날짜: ${testResult.result.primary?.length || 0}개`);
          }
        } catch (error) {
          console.log(`❌ 크기 ${size}에서 오류:`, error.message);
          console.log('오류 시 메모리:', getMemoryUsage());
          break;
        }
        
        // 가비지 컬렉션 강제 실행
        if (global.gc) {
          global.gc();
          console.log('GC 후 메모리:', getMemoryUsage());
        }
      }
      
    } catch (error) {
      console.log('❌ 분할 테스트 실패:', error.message);
      console.log('오류 시 메모리:', getMemoryUsage());
    }
    
    console.log('\n✅ 메모리 디버깅 완료');
    console.log('최종 메모리:', getMemoryUsage());
    
  } catch (error) {
    console.error('❌ 디버깅 중 오류:', error.message);
    console.log('오류 시 메모리:', getMemoryUsage());
  }
}

// 테스트 실행
debugMemoryIssue();