import { normalizeDiagnosisLines } from '../../src/shared/utils/report/normalizeDiagnosisLine.js';

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error('❌', message, '\nExpected:', expected, '\nActual  :', actual);
    process.exit(1);
  } else {
    console.log('✅', message);
  }
}

// 1) Nested parentheses & duplicate removal
{
  const input = '당뇨병(Diabetes Mellitus (당뇨병)) 진단';
  const { normalizedText } = normalizeDiagnosisLines(input);
  assertEqual(normalizedText, '당뇨병(Diabetes Mellitus) 진단', '중첩 괄호 및 중복 용어 제거');
}

// 2) Simple paired term stays
{
  const input = '협심증(angina pectoris) 진단';
  const { normalizedText } = normalizeDiagnosisLines(input);
  assertEqual(normalizedText, '협심증(angina pectoris) 진단', '정상 병기 유지');
}

// 3) ICD code notation unify
{
  const input = '흉통(Chest pain) (ICD코드: R074)';
  const { normalizedText } = normalizeDiagnosisLines(input);
  assertEqual(normalizedText, '흉통(Chest pain) (ICD: R074)', 'ICD 표기 통일');
}

// 4) Deduplicate paired terms
{
  const input = '고혈압(Hypertension) 및 고혈압(Hypertension)';
  const { normalizedText } = normalizeDiagnosisLines(input);
  assertEqual(normalizedText, '고혈압(Hypertension) 및', '중복 병기 제거');
}

// 5) Non-diagnosis line remains unchanged
{
  const input = '보고서 헤더: Report_Sample.txt';
  const { normalizedText } = normalizeDiagnosisLines(input);
  assertEqual(normalizedText, '보고서 헤더: Report_Sample.txt', '비진단 라인 변경 없음');
}

console.log('\nAll normalizeDiagnosisLine unit tests passed.');

