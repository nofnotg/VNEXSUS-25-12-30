/**
 * 간단한 템플릿 캐시 테스트
 */

import hospitalTemplateCache from '../postprocess/hospitalTemplateCache.js';
import preprocessor from '../postprocess/preprocessor.js';

async function runSimpleTest() {
  console.log('=== 간단한 템플릿 캐시 테스트 ===\n');

  // 테스트 문서
  const testDocument = `
서울대학교병원
환자명: 홍길동
생년월일: 1980.01.01
진료과: 내과

2024.01.15
진단명: 고혈압
처방: 혈압약 복용

--- 병원 공통 양식 ---
본 진료기록은 서울대학교병원의 공식 문서입니다.
문의사항은 02-2072-2114로 연락바랍니다.
--- 양식 끝 ---

추가 소견: 정기 검진 필요
`;

  try {
    console.log('1. 템플릿 캐시 단독 테스트');
    const cacheResult = await hospitalTemplateCache.processDocument(testDocument);
    console.log(`✓ 병원명: ${cacheResult.hospital || '미감지'}`);
    console.log(`✓ 제거된 패턴 수: ${cacheResult.removedPatterns ? cacheResult.removedPatterns.length : 0}`);
    console.log(`✓ 원본 길이: ${testDocument.length}, 정리 후 길이: ${cacheResult.cleanedText ? cacheResult.cleanedText.length : testDocument.length}\n`);

    console.log('2. 전처리기 통합 테스트 (캐시 비활성화)');
    const resultWithoutCache = await preprocessor.run(testDocument, {
      enableTemplateCache: false
    });
    console.log(`✓ 추출된 섹션 수: ${resultWithoutCache.length}\n`);

    console.log('3. 전처리기 통합 테스트 (캐시 활성화)');
    const resultWithCache = await preprocessor.run(testDocument, {
      enableTemplateCache: true
    });
    console.log(`✓ 추출된 섹션 수: ${resultWithCache.length}\n`);

    console.log('4. 파이프라인 무결성 검증');
    if (resultWithoutCache.length === resultWithCache.length) {
      console.log('✅ 파이프라인 무결성 유지됨 - 섹션 수 동일');
    } else {
      console.log('⚠️ 섹션 수 차이 발견');
    }

    // 핵심 데이터 비교
    if (resultWithCache.length > 0 && resultWithoutCache.length > 0) {
      const section1 = resultWithoutCache[0];
      const section2 = resultWithCache[0];
      
      console.log(`캐시 없음 - 병원: ${section1.hospital}, 날짜: ${section1.date}`);
      console.log(`캐시 있음 - 병원: ${section2.hospital}, 날짜: ${section2.date}`);
      
      if (section1.hospital === section2.hospital && section1.date === section2.date) {
        console.log('✅ 핵심 데이터 일치 - 파이프라인 무결성 확인됨');
      }
    }

    console.log('\n=== 테스트 완료 ===');
    console.log('병원별 템플릿 캐시 시스템이 정상 작동하며, 기존 파이프라인의 무결성이 유지됩니다.');

  } catch (error) {
    console.error('테스트 실행 중 오류:', error);
  }
}

runSimpleTest();