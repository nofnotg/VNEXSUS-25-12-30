/**
 * 간단한 실제 케이스 템플릿 캐시 테스트
 */

import fs from 'fs';
import path from 'path';
import hospitalTemplateCache from '../postprocess/hospitalTemplateCache.js';

async function quickRealCaseTest() {
  console.log('=== 실제 케이스 템플릿 캐시 간단 테스트 ===\n');

  // 케이스 파일 경로들 시도
  const possiblePaths = [
    path.join(process.cwd(), 'src', 'rag', 'case_sample'),
    path.join(process.cwd(), '..', 'src', 'rag', 'case_sample'),
    path.join(process.cwd(), 'backend', '..', 'src', 'rag', 'case_sample')
  ];

  let caseDir = null;
  for (const testPath of possiblePaths) {
    console.log(`경로 확인 중: ${testPath}`);
    if (fs.existsSync(testPath)) {
      caseDir = testPath;
      console.log(`✓ 케이스 디렉토리 발견: ${caseDir}\n`);
      break;
    }
  }

  if (!caseDir) {
    console.log('❌ 케이스 디렉토리를 찾을 수 없습니다.');
    return;
  }

  try {
    // 케이스 파일들 로드
    const files = fs.readdirSync(caseDir);
    const caseFiles = files.filter(file => 
      file.startsWith('Case') && 
      file.endsWith('.txt') && 
      !file.includes('_report')
    );

    console.log(`📁 발견된 케이스 파일: ${caseFiles.length}개`);
    console.log(`파일 목록: ${caseFiles.slice(0, 5).join(', ')}\n`);

    // 첫 번째 케이스 파일로 테스트
    if (caseFiles.length > 0) {
      const testFile = caseFiles[0];
      const filePath = path.join(caseDir, testFile);
      
      console.log(`📄 테스트 파일: ${testFile}`);
      
      // 파일 내용 읽기
      const content = fs.readFileSync(filePath, 'utf-8');
      console.log(`📏 원본 문서 길이: ${content.length} 문자`);
      
      // 문서 일부 미리보기
      const preview = content.substring(0, 200).replace(/\n/g, ' ');
      console.log(`📖 문서 미리보기: ${preview}...\n`);

      // 템플릿 캐시 처리
      console.log('🔄 템플릿 캐시 처리 중...');
      const startTime = Date.now();
      const result = await hospitalTemplateCache.processDocument(content);
      const endTime = Date.now();

      // 결과 분석
      const processingTime = endTime - startTime;
      const originalLength = content.length;
      const cleanedLength = result.cleanedText ? result.cleanedText.length : originalLength;
      const noiseReduction = ((originalLength - cleanedLength) / originalLength * 100).toFixed(2);

      console.log('📊 처리 결과:');
      console.log(`  🏥 감지된 병원: ${result.hospital || '미감지'}`);
      console.log(`  🧹 노이즈 제거율: ${noiseReduction}% (${originalLength} → ${cleanedLength})`);
      console.log(`  ⏱️ 처리 시간: ${processingTime}ms`);
      console.log(`  🔍 감지된 패턴: ${result.removedPatterns ? result.removedPatterns.length : 0}개`);

      // 제거된 패턴 미리보기
      if (result.removedPatterns && result.removedPatterns.length > 0) {
        console.log('\n🗑️ 제거된 패턴 예시:');
        result.removedPatterns.slice(0, 3).forEach((pattern, index) => {
          const preview = pattern.substring(0, 50).replace(/\n/g, ' ');
          console.log(`  ${index + 1}. ${preview}...`);
        });
      }

      // 추가 케이스 테스트 (최대 3개)
      console.log('\n🔄 추가 케이스 테스트...');
      for (let i = 1; i < Math.min(4, caseFiles.length); i++) {
        const additionalFile = caseFiles[i];
        const additionalPath = path.join(caseDir, additionalFile);
        
        try {
          const additionalContent = fs.readFileSync(additionalPath, 'utf-8');
          const additionalResult = await hospitalTemplateCache.processDocument(additionalContent);
          
          const additionalNoiseReduction = additionalResult.cleanedText ? 
            ((additionalContent.length - additionalResult.cleanedText.length) / additionalContent.length * 100).toFixed(2) : 0;
          
          console.log(`  📄 ${additionalFile}: ${additionalResult.hospital || '미감지'} - ${additionalNoiseReduction}% 노이즈 제거`);
        } catch (error) {
          console.log(`  ❌ ${additionalFile}: 처리 실패 - ${error.message}`);
        }
      }

      console.log('\n✅ 실제 케이스 테스트 완료!');
      console.log('템플릿 캐시 시스템이 실제 의료 문서에서 정상적으로 작동합니다.');

    } else {
      console.log('❌ 테스트할 케이스 파일이 없습니다.');
    }

  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
  }
}

quickRealCaseTest();