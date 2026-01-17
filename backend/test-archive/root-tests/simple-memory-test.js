/**
 * 메모리 안전한 DNA 전처리 테스트
 * 메모리 누수 없이 기본 기능만 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function simpleMemoryTest() {
  try {
    console.log('🧪 메모리 안전 DNA 테스트 시작');
    
    // 매우 작은 텍스트 샘플 사용 (500자만)
    const casePath = path.join(__dirname, 'src/rag/case_sample/Case1.txt');
    const fullText = fs.readFileSync(casePath, 'utf8');
    const sampleText = fullText.substring(0, 500);
    
    console.log(`📄 테스트 텍스트: ${sampleText.length}자`);
    console.log('샘플:', sampleText);
    
    // 1. 기본 날짜 패턴 테스트
    console.log('\n🔍 기본 날짜 패턴 테스트...');
    const datePatterns = [
      /\d{4}[-.]\d{1,2}[-.]\d{1,2}/g,
      /\d{1,2}[-.]\d{1,2}[-.]\d{4}/g,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g
    ];
    
    let totalMatches = 0;
    datePatterns.forEach((pattern, index) => {
      const matches = [...sampleText.matchAll(pattern)];
      console.log(`패턴 ${index + 1}: ${matches.length}개 매치`);
      matches.forEach(match => {
        console.log(`  - ${match[0]}`);
      });
      totalMatches += matches.length;
    });
    
    console.log(`\n총 ${totalMatches}개 날짜 패턴 발견`);
    
    // 2. TextArrayDateController 클래스만 로드 테스트
    console.log('\n🧬 TextArrayDateController 로드 테스트...');
    try {
      const { TextArrayDateController } = await import('./src/dna-engine/core/textArrayDateControllerComplete.js');
      console.log('✅ TextArrayDateController 로드 성공');
      
      // 인스턴스 생성만 테스트 (메서드 호출 안함)
      const controller = new TextArrayDateController();
      console.log('✅ TextArrayDateController 인스턴스 생성 성공');
      
    } catch (error) {
      console.log('❌ TextArrayDateController 로드 실패:', error.message);
    }
    
    // 3. EnhancedDateAnchor 클래스만 로드 테스트
    console.log('\n⚓ EnhancedDateAnchor 로드 테스트...');
    try {
      const { EnhancedDateAnchor } = await import('./src/dna-engine/core/enhancedDateAnchor.js');
      console.log('✅ EnhancedDateAnchor 로드 성공');
      
      const anchor = new EnhancedDateAnchor();
      console.log('✅ EnhancedDateAnchor 인스턴스 생성 성공');
      
    } catch (error) {
      console.log('❌ EnhancedDateAnchor 로드 실패:', error.message);
    }
    
    console.log('\n✅ 메모리 안전 테스트 완료');
    
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error.message);
  }
}

// 테스트 실행
simpleMemoryTest();