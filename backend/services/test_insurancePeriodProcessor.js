/**
 * Insurance Period Processor 테스트
 */

import { InsurancePeriodProcessor } from './insurancePeriodProcessor.js';

// 테스트 데이터
const testOCRBlocks = [
  {
    text: '보험기간: 2020.10.15 ~ 2025.10.15',
    context: '농협손해보험 보험기간: 2020.10.15 ~ 2025.10.15'
  },
  {
    text: '가입일: 2019.05.20',
    context: 'KB손해보험 가입일: 2019.05.20'
  },
  {
    text: '만기일: 2050.12.31',
    context: '삼성화재 만기일: 2050.12.31'
  }
];

const testDates = [
  {
    date: '2020-10-15',
    context: '농협손해보험 보험기간: 2020.10.15 ~ 2025.10.15',
    type: '보험가입일',
    score: 50
  },
  {
    date: '2025-10-15',
    context: '농협손해보험 보험기간: 2020.10.15 ~ 2025.10.15',
    type: '보험만기일',
    score: 50
  },
  {
    date: '2021-06-15',
    context: '심평원 진료내역 조회기간',
    type: '진료일',
    score: 70
  },
  {
    date: '2019-05-20',
    context: 'KB손해보험 가입일: 2019.05.20',
    type: '보험가입일',
    score: 50
  }
];

// 테스트 실행
console.log('=== Insurance Period Processor 테스트 ===\n');

const processor = new InsurancePeriodProcessor();

// 테스트 1: 보험기간 추출
console.log('1. 보험기간 추출 (시작일만):');
const periods = processor.extractInsurancePeriods(testOCRBlocks);
console.log(JSON.stringify(periods, null, 2));
console.log('');

// 테스트 2: 보험 시작일 필터링
console.log('2. 보험 시작일 필터링:');
const startDates = processor.filterInsuranceStartDates(testDates);
console.log(JSON.stringify(startDates, null, 2));
console.log('');

// 테스트 3: 만기일 제거
console.log('3. 보험 만기일 제거:');
const withoutEndDates = processor.removeInsuranceEndDates(testDates);
console.log(`원본: ${testDates.length}개 → 제거 후: ${withoutEndDates.length}개`);
console.log(JSON.stringify(withoutEndDates, null, 2));
console.log('');

// 테스트 4: 스코어 조정
console.log('4. 보험 관련 스코어 조정:');
const adjusted = processor.adjustInsuranceScores(testDates);
adjusted.forEach(d => {
  if (d.adjustReason) {
    console.log(`  ${d.date} (${d.type}): score ${d.score} - ${d.adjustReason}`);
  }
});
console.log('');

// 테스트 5: 선후관계 분석
console.log('5. 사건과 보험가입일 선후관계 분석:');

const eventDate = '2021-06-15';  // 사건 발생일
const insuranceStartDates = [
  { startDate: '2020-10-15', company: '농협손해보험' },
  { startDate: '2019-05-20', company: 'KB손해보험' }
];

const analysis = processor.analyzeCoverageEligibility(eventDate, insuranceStartDates);
console.log(`  사건 발생일: ${eventDate}`);
console.log(`  보상 가능 여부: ${analysis.eligible ? '✓ 가능' : '✗ 불가'}`);
console.log(`  사유: ${analysis.reason}`);
console.log(`  적용 가능 보험: ${analysis.policies.length}개`);
if (analysis.mostRecentPolicy) {
  console.log(`  최근 가입 보험: ${analysis.mostRecentPolicy.company} (${analysis.mostRecentPolicy.startDate})`);
}
console.log('');

// 테스트 6: 기왕증 케이스 (사건이 보험 가입 전)
console.log('6. 기왕증 케이스 (사건이 보험 가입 전):');
const earlyEventDate = '2018-01-10';  // 가입 전 사건
const analysisEarly = processor.analyzeCoverageEligibility(earlyEventDate, insuranceStartDates);
console.log(`  사건 발생일: ${earlyEventDate}`);
console.log(`  보상 가능 여부: ${analysisEarly.eligible ? '✓ 가능' : '✗ 불가'}`);
console.log(`  사유: ${analysisEarly.reason}`);
console.log('');

// 테스트 7: 종합 처리
console.log('7. 종합 처리 (추출 + 제거 + 조정):');
const result = processor.process(testDates);
console.log(`  총 날짜: ${result.stats.totalDates}개`);
console.log(`  보험 시작일: ${result.stats.insuranceStartDates}개`);
console.log(`  만기일 제거: ${result.stats.insuranceEndDatesRemoved}개`);
console.log(`  스코어 조정: ${result.stats.scoresAdjusted}개`);
console.log(`  처리 후 날짜: ${result.processed.length}개`);
console.log('');

console.log('✓ 모든 테스트 완료');
