/**
 * 🧪 환자 정보 전달 통합 검증 테스트
 *
 * 목적: 환자 정보가 프롬프트 빌더까지 정확히 전달되는지 확인
 */

import {
  buildStructuredJsonPrompt,
  loadEnhancedMedicalKnowledgeBase
} from '../config/enhancedPromptBuilder.js';

async function verifyPatientInfoIntegration() {
  console.log('\n🧪 환자 정보 전달 통합 검증 시작...\n');

  // 테스트 데이터
  const testData = {
    extractedText: `
환자명: 김철수
생년월일: 1975-03-15
진료일: 2024-01-15
진단명: 고혈압
    `,
    patientInfo: {
      patientName: '김철수',
      birthDate: '1975-03-15'
    },
    insuranceJoinDate: '2024-01-01'
  };

  try {
    // 지식 베이스 로드
    const knowledgeBase = await loadEnhancedMedicalKnowledgeBase();

    // 프롬프트 생성 (환자 정보 포함)
    const { systemPrompt, userPrompt } = buildStructuredJsonPrompt(
      testData.extractedText,
      knowledgeBase,
      testData.insuranceJoinDate,
      testData.patientInfo
    );

    // 검증 1: 환자 이름이 프롬프트에 포함되었는지
    const hasPatientName = systemPrompt.includes('김철수');
    console.log(`✓ 환자 이름 포함: ${hasPatientName ? '✅ PASS' : '❌ FAIL'}`);
    if (hasPatientName) {
      console.log(`  └─ 프롬프트에서 발견: "...피보험자 이름**: 김철수..."`);
    }

    // 검증 2: 생년월일이 프롬프트에 포함되었는지
    const hasBirthDate = systemPrompt.includes('1975-03-15');
    console.log(`✓ 생년월일 포함: ${hasBirthDate ? '✅ PASS' : '❌ FAIL'}`);
    if (hasBirthDate) {
      console.log(`  └─ 프롬프트에서 발견: "...생년월일**: 1975-03-15..."`);
    }

    // 검증 3: 플레이스홀더가 아닌 실제 정보 사용 여부
    const hasPlaceholder = systemPrompt.includes('[문서에서 추출 필요]');
    console.log(`✓ 실제 정보 사용 (플레이스홀더 없음): ${!hasPlaceholder ? '✅ PASS' : '⚠️  WARNING'}`);
    if (hasPlaceholder) {
      console.log(`  └─ 플레이스홀더 발견: 일부 정보가 누락되었을 수 있습니다`);
    }

    // 검증 4: JSON 스키마 가이드 포함
    const hasJsonSchema = systemPrompt.includes('응답 JSON 스키마');
    console.log(`✓ JSON 스키마 가이드 포함: ${hasJsonSchema ? '✅ PASS' : '❌ FAIL'}`);

    // 검증 5: 보험 가입일 기준 기간 계산
    const has3MonthPeriod = systemPrompt.includes('2023-10-01') || systemPrompt.includes('3개월 이내');
    console.log(`✓ 보험 가입일 기준 기간 계산: ${has3MonthPeriod ? '✅ PASS' : '❌ FAIL'}`);

    // 종합 결과
    const allPassed = hasPatientName && hasBirthDate && !hasPlaceholder && hasJsonSchema && has3MonthPeriod;

    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('🎉 모든 검증 통과! 환자 정보가 정확히 전달됩니다.');
    } else {
      console.log('⚠️  일부 검증 실패. 위 결과를 확인하세요.');
    }
    console.log('='.repeat(60) + '\n');

    return allPassed;

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
    return false;
  }
}

// 테스트 케이스 2: 환자 정보 없는 경우
async function verifyFallbackBehavior() {
  console.log('\n🧪 환자 정보 없는 경우 폴백 동작 검증...\n');

  try {
    const knowledgeBase = await loadEnhancedMedicalKnowledgeBase();

    // 환자 정보 없이 호출
    const { systemPrompt } = buildStructuredJsonPrompt(
      '진료일: 2024-01-15',
      knowledgeBase,
      '2024-01-01',
      {} // 빈 환자 정보
    );

    // 플레이스홀더가 사용되어야 함
    const hasPlaceholder = systemPrompt.includes('[문서에서 추출 필요]');
    console.log(`✓ 플레이스홀더 사용: ${hasPlaceholder ? '✅ PASS' : '❌ FAIL'}`);

    if (hasPlaceholder) {
      console.log(`  └─ 환자 정보 없을 때 올바른 폴백 동작 확인`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(hasPlaceholder ? '🎉 폴백 동작 정상!' : '⚠️  폴백 동작 확인 필요');
    console.log('='.repeat(60) + '\n');

    return hasPlaceholder;

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    return false;
  }
}

// 메인 실행
(async () => {
  const test1 = await verifyPatientInfoIntegration();
  const test2 = await verifyFallbackBehavior();

  const allTestsPassed = test1 && test2;

  console.log('\n📊 최종 결과:');
  console.log(`  테스트 1 (환자 정보 전달): ${test1 ? '✅' : '❌'}`);
  console.log(`  테스트 2 (폴백 동작):    ${test2 ? '✅' : '❌'}`);
  console.log(`  종합:                  ${allTestsPassed ? '✅ 성공' : '❌ 실패'}\n`);

  process.exit(allTestsPassed ? 0 : 1);
})();
