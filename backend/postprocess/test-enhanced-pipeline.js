/**
 * 개선된 OCR 파이프라인 검증 스크립트
 *
 * 목적: 피드백 반영 후 타겟 케이스들의 누락 패턴 집중 검증
 *
 * 타겟 케이스:
 * - Case2: 보험 가입일, 검사 결과 날짜, 입원 기간
 * - Case5: 날짜 데이터 전반, 보험 가입일
 * - Case13, 15, 17: 미제공 내용이지만 중요한 날짜들
 * - Case30: 과거 날짜, 보험 관련 날짜
 * - Case41: 보험 가입일, 과거 날짜
 * - Case42: 보험 가입일 (2018-09-27)
 * - Case44: 조사중 내용 필터링
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import EnhancedMassiveDateBlockProcessor from './enhancedMassiveDateBlockProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_CASES = [2, 5, 13, 15, 17, 30, 41, 42, 44];

// 케이스별 누락 날짜 (GT 기준)
const EXPECTED_MISSING_DATES = {
  2: ['2019-04-09', '2024-01-09', '2024-04-23', '2025-02-04'],
  5: ['2018-05-10', '2023-02-10', '2023-05-10', '2024-12-12', '2020-01-17'],
  13: ['2021-03-24', '2021-07-30', '2025-03-13'],
  15: ['2025-02-25', '2025-05-26', '2025-06-16'],
  17: ['2025-08-12'],
  30: ['2012-11-23', '2025-01-01', '2025-03-23', '2025-04-22'],
  41: ['2007-08-08', '2021-05-17', '2021-05-20', '2024-04-24', '2025-09-02'],
  42: ['2018-09-27'],
  44: ['2020-09-09', '2024-06-03', '2024-09-03']
};

// 케이스별 중요 패턴 설명
const CASE_PATTERNS = {
  2: {
    description: '보험 가입일, 검사 보고일시, 입원 기간',
    criticalPatterns: [
      '보험가입일: 2019.04.09',
      '보험가입일: 2024.01.09',
      '보고일시: 2024.04.23',
      '입원기간: 2025.02.04 ~ 2025.02.12'
    ]
  },
  5: {
    description: '보험 가입일 (5년, 3개월 이내), 심평원 진료내역',
    criticalPatterns: [
      '가입 5년 이내: 2018.05.10',
      '가입 3개월 이내: 2023.02.10',
      '보험가입: 2023.05.10',
      '심평원 진료내역: 2020.01.17 ~ 2024.01.24'
    ]
  },
  13: {
    description: '통원 기간 종료일',
    criticalPatterns: [
      '통원기간: 2024.04.12 ~ 2024.11.04'
    ]
  },
  15: {
    description: '보험 계약일, 보장기간',
    criticalPatterns: [
      '계약일: 2025.02.25 ~ 2053.02.25',
      '보험계약일: 2025.05.26'
    ]
  },
  17: {
    description: '보험 계약 기간',
    criticalPatterns: [
      '계약기간: 2025.08.12 ~ 2030.08.12'
    ]
  },
  30: {
    description: '오래된 날짜, 보험 관련 날짜',
    criticalPatterns: [
      '과거 날짜: 2012.11.23',
      '보험 관련: 2025.01.01'
    ]
  },
  41: {
    description: '오래된 날짜, 보험 가입일',
    criticalPatterns: [
      '과거 날짜: 2007.08.08',
      '보험 가입일: 2021.05.17'
    ]
  },
  42: {
    description: '보험 가입일',
    criticalPatterns: [
      '보험가입일: 2018.09.27'
    ]
  },
  44: {
    description: '조사중 내용은 제외되어야 함',
    criticalPatterns: [
      '실제 의료 날짜만 추출'
    ]
  }
};

/**
 * OCR 캐시 파일 읽기
 */
function readOCRCache(caseNum) {
  // cycle4_topdown 경로 사용
  const cachePath = `/home/user/VNEXSUS-25-12-30/backend/eval/output/cycle4_topdown/ocr_cache/case_${caseNum}_topdown.json`;

  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const data = JSON.parse(content);
    return data.fullText || data.text || '';
  } catch (error) {
    console.error(`Case ${caseNum} OCR 캐시 읽기 실패:`, error.message);
    console.error(`경로: ${cachePath}`);
    return null;
  }
}

/**
 * 날짜 정규화
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // 다양한 형식 처리
  const patterns = [
    /(\d{4})[년.-](\d{1,2})[월.-](\d{1,2})[일]?/,
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/
  ];

  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return dateStr;
}

/**
 * 케이스별 테스트 실행
 */
async function testCase(caseNum) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Case ${caseNum} 테스트 시작`);
  console.log(`${'='.repeat(80)}`);

  const pattern = CASE_PATTERNS[caseNum];
  if (pattern) {
    console.log(`\n[패턴 설명] ${pattern.description}`);
    console.log('중요 패턴:');
    pattern.criticalPatterns.forEach(p => console.log(`  - ${p}`));
  }

  // OCR 텍스트 읽기
  const ocrText = readOCRCache(caseNum);
  if (!ocrText) {
    console.log(`❌ Case ${caseNum} OCR 데이터 없음`);
    return null;
  }

  // 개선된 파이프라인 실행
  const processor = new EnhancedMassiveDateBlockProcessor();
  const result = await processor.processEnhancedDateBlocks(ocrText, {
    filterInvestigation: caseNum === 44 // Case44는 조사중 필터링 적용
  });

  // 추출된 날짜 수집
  const extractedDates = new Set();

  result.dateBlocks.forEach(block => {
    if (block.date) {
      const normalized = normalizeDate(block.date);
      if (normalized) {
        extractedDates.add(normalized);
      }
    }
  });

  // GT 누락 날짜와 비교
  const expectedMissing = EXPECTED_MISSING_DATES[caseNum] || [];
  const foundMissing = [];
  const stillMissing = [];

  expectedMissing.forEach(date => {
    if (extractedDates.has(date)) {
      foundMissing.push(date);
    } else {
      stillMissing.push(date);
    }
  });

  // 결과 출력
  console.log(`\n[결과]`);
  console.log(`총 추출 날짜: ${extractedDates.size}개`);
  console.log(`예상 누락: ${expectedMissing.length}개`);
  console.log(`개선 발견: ${foundMissing.length}개 ✅`);
  console.log(`여전히 누락: ${stillMissing.length}개 ${stillMissing.length > 0 ? '❌' : '✅'}`);

  if (foundMissing.length > 0) {
    console.log(`\n✅ 개선 성공한 날짜:`);
    foundMissing.forEach(date => console.log(`  - ${date}`));
  }

  if (stillMissing.length > 0) {
    console.log(`\n❌ 여전히 누락된 날짜:`);
    stillMissing.forEach(date => console.log(`  - ${date}`));
  }

  // 통계
  const improvement = expectedMissing.length > 0
    ? (foundMissing.length / expectedMissing.length * 100).toFixed(1)
    : 0;

  console.log(`\n개선률: ${improvement}%`);

  return {
    caseNum,
    totalExtracted: extractedDates.size,
    expectedMissing: expectedMissing.length,
    foundMissing: foundMissing.length,
    stillMissing: stillMissing.length,
    improvement: parseFloat(improvement),
    foundDates: foundMissing,
    missingDates: stillMissing
  };
}

/**
 * 전체 테스트 실행
 */
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   개선된 OCR 파이프라인 검증 테스트                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const results = [];

  for (const caseNum of TARGET_CASES) {
    const result = await testCase(caseNum);
    if (result) {
      results.push(result);
    }
  }

  // 전체 요약
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('전체 요약');
  console.log(`${'='.repeat(80)}\n`);

  const totalExpectedMissing = results.reduce((sum, r) => sum + r.expectedMissing, 0);
  const totalFoundMissing = results.reduce((sum, r) => sum + r.foundMissing, 0);
  const totalStillMissing = results.reduce((sum, r) => sum + r.stillMissing, 0);
  const overallImprovement = totalExpectedMissing > 0
    ? (totalFoundMissing / totalExpectedMissing * 100).toFixed(1)
    : 0;

  console.log(`테스트 케이스: ${results.length}개`);
  console.log(`전체 예상 누락: ${totalExpectedMissing}개`);
  console.log(`개선 발견: ${totalFoundMissing}개 ✅`);
  console.log(`여전히 누락: ${totalStillMissing}개 ${totalStillMissing > 0 ? '❌' : '✅'}`);
  console.log(`\n전체 개선률: ${overallImprovement}%`);

  // 케이스별 요약 테이블
  console.log(`\n\n케이스별 개선률:`);
  console.log('┌────────┬──────────┬──────────┬──────────┬────────────┐');
  console.log('│ Case   │ 예상누락 │ 발견     │ 여전히   │ 개선률     │');
  console.log('├────────┼──────────┼──────────┼──────────┼────────────┤');

  results.forEach(r => {
    const caseStr = `Case${r.caseNum}`.padEnd(6);
    const expectedStr = String(r.expectedMissing).padStart(8);
    const foundStr = String(r.foundMissing).padStart(8);
    const missingStr = String(r.stillMissing).padStart(8);
    const improvementStr = `${r.improvement}%`.padStart(10);

    console.log(`│ ${caseStr} │ ${expectedStr} │ ${foundStr} │ ${missingStr} │ ${improvementStr} │`);
  });

  console.log('└────────┴──────────┴──────────┴──────────┴────────────┘');

  // 결과 파일 저장
  const outputPath = './test-enhanced-pipeline-results.json';
  fs.writeFileSync(
    outputPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      overallImprovement: parseFloat(overallImprovement),
      totalExpectedMissing,
      totalFoundMissing,
      totalStillMissing,
      results
    }, null, 2)
  );

  console.log(`\n결과 저장: ${outputPath}`);
}

// 실행
runAllTests().catch(error => {
  console.error('테스트 실행 오류:', error);
  process.exit(1);
});
