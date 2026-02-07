#!/usr/bin/env node

/**
 * OCR 좌표정보 포함된 10개 케이스 검증 스크립트
 * - 세무항목별 매칭률 계산
 * - 날짜 9항목별 매칭률 계산
 */

const fs = require('fs');
const path = require('path');

// 10개 타겟 케이스
const TARGET_CASES = [2, 5, 13, 15, 17, 29, 30, 41, 42, 44];

// 날짜 항목 정의
const DATE_ITEMS = {
  'item_1.내원일시': '내원일시 (Visit DateTime)',
  'item_2.내원경위': '내원경위 (Visit Reason)',
  'item_3.진단병명': '진단병명 (Diagnosis)',
  'item_4.검사결과': '검사결과 (Examination)',
  'item_6.치료내용': '치료내용 (Treatment)',
  'item_7.통원기간': '통원기간 (Outpatient Period)',
  'item_8.입원기간': '입원기간 (Hospitalization)',
  'item_9.과거병력': '과거병력 (Medical History)',
  'item_10.의사소견': '의사소견 (Doctor Opinion)'
};

// 세무항목(의료/보험 카테고리) 정의
const CATEGORY_ITEMS = {
  'medical_visit': '의료 내원',
  'medical_examination': '의료 검사',
  'medical_treatment': '의료 치료',
  'medical_diagnosis': '의료 진단',
  'medical_history': '과거 병력',
  'insurance_start': '보험 시작일',
  'insurance_end': '보험 종료일',
  'insurance_period': '보험 기간'
};

/**
 * GT 데이터 로드 (comprehensive_gt_analysis.json)
 */
function loadGTData() {
  const gtPath = path.join(__dirname, '../backend/eval/output/comprehensive_gt_analysis/comprehensive_gt_analysis.json');
  const data = JSON.parse(fs.readFileSync(gtPath, 'utf8'));
  return data.results;
}

/**
 * OCR 결과 로드 (cycle4_topdown)
 */
function loadOCRResult(caseNum) {
  const ocrPath = path.join(__dirname, `../backend/eval/output/cycle4_topdown/ocr_cache/case_${caseNum}_topdown.json`);
  if (!fs.existsSync(ocrPath)) {
    console.warn(`Warning: OCR file not found for Case${caseNum}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(ocrPath, 'utf8'));
}

/**
 * 날짜 정규화 (YYYY-MM-DD 형식으로)
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD 등을 YYYY-MM-DD로 통일
  return dateStr.replace(/[./]/g, '-').trim();
}

/**
 * GT 날짜와 OCR 날짜 매칭
 */
function matchDates(gtDates, ocrDates) {
  const gtDateSet = new Set(gtDates.map(d => normalizeDate(d.date)));
  const ocrDateSet = new Set(ocrDates.map(d => normalizeDate(d.date)));

  const matched = [];
  const gtOnly = [];
  const ocrOnly = [];

  gtDates.forEach(gtDate => {
    const normalized = normalizeDate(gtDate.date);
    if (ocrDateSet.has(normalized)) {
      matched.push({ date: normalized, gt: gtDate, source: 'matched' });
    } else {
      gtOnly.push({ date: normalized, gt: gtDate, source: 'gt_only' });
    }
  });

  ocrDates.forEach(ocrDate => {
    const normalized = normalizeDate(ocrDate.date);
    if (!gtDateSet.has(normalized)) {
      ocrOnly.push({ date: normalized, ocr: ocrDate, source: 'ocr_only' });
    }
  });

  return { matched, gtOnly, ocrOnly };
}

/**
 * 항목별 매칭률 계산
 */
function calculateItemMatchingRates(gtDates, ocrDates) {
  const itemStats = {};

  // 각 날짜 항목별로 초기화
  Object.keys(DATE_ITEMS).forEach(item => {
    itemStats[item] = {
      gtCount: 0,
      matchedCount: 0,
      matchingRate: 0,
      gtDates: [],
      matchedDates: []
    };
  });

  // GT 데이터에서 항목별 날짜 수집
  gtDates.forEach(gtDate => {
    const normalized = normalizeDate(gtDate.date);
    if (gtDate.categories) {
      gtDate.categories.forEach(category => {
        if (DATE_ITEMS[category]) {
          itemStats[category].gtCount++;
          itemStats[category].gtDates.push(normalized);
        }
      });
    }
  });

  // OCR 결과와 매칭
  const ocrDateSet = new Set(ocrDates.map(d => normalizeDate(d.date)));

  Object.keys(itemStats).forEach(item => {
    const stats = itemStats[item];
    stats.matchedDates = stats.gtDates.filter(date => ocrDateSet.has(date));
    stats.matchedCount = stats.matchedDates.length;
    stats.matchingRate = stats.gtCount > 0
      ? (stats.matchedCount / stats.gtCount * 100).toFixed(2)
      : 0;
  });

  return itemStats;
}

/**
 * 카테고리별 매칭률 계산
 */
function calculateCategoryMatchingRates(gtDates, ocrDates) {
  const categoryStats = {};

  // 각 카테고리별로 초기화
  Object.keys(CATEGORY_ITEMS).forEach(category => {
    categoryStats[category] = {
      gtCount: 0,
      matchedCount: 0,
      matchingRate: 0,
      gtDates: [],
      matchedDates: []
    };
  });

  // GT 데이터에서 카테고리별 날짜 수집
  gtDates.forEach(gtDate => {
    const normalized = normalizeDate(gtDate.date);
    if (gtDate.categories) {
      gtDate.categories.forEach(category => {
        if (CATEGORY_ITEMS[category]) {
          categoryStats[category].gtCount++;
          categoryStats[category].gtDates.push(normalized);
        }
      });
    }
  });

  // OCR 결과와 매칭
  const ocrDateSet = new Set(ocrDates.map(d => normalizeDate(d.date)));

  Object.keys(categoryStats).forEach(category => {
    const stats = categoryStats[category];
    stats.matchedDates = stats.gtDates.filter(date => ocrDateSet.has(date));
    stats.matchedCount = stats.matchedDates.length;
    stats.matchingRate = stats.gtCount > 0
      ? (stats.matchedCount / stats.gtCount * 100).toFixed(2)
      : 0;
  });

  return categoryStats;
}

/**
 * 케이스별 검증 수행
 */
function validateCase(caseNum, gtResults) {
  console.log(`\n=== Validating Case${caseNum} ===`);

  // GT 데이터 찾기
  const gtData = gtResults.find(r => r.caseNum === caseNum);
  if (!gtData) {
    console.error(`GT data not found for Case${caseNum}`);
    return null;
  }

  // OCR 결과 로드
  const ocrData = loadOCRResult(caseNum);
  if (!ocrData || !ocrData.generatedJson) {
    console.error(`OCR data not found for Case${caseNum}`);
    return null;
  }

  const gtDates = gtData.gtDates || [];
  const ocrDates = ocrData.generatedJson.allExtractedDates || [];

  console.log(`GT Dates: ${gtDates.length}, OCR Dates: ${ocrDates.length}`);

  // 날짜 매칭
  const matchResult = matchDates(gtDates, ocrDates);

  // 항목별 매칭률 계산
  const itemStats = calculateItemMatchingRates(gtDates, ocrDates);

  // 카테고리별 매칭률 계산
  const categoryStats = calculateCategoryMatchingRates(gtDates, ocrDates);

  // 전체 매칭률 계산
  const totalGT = gtDates.length;
  const totalMatched = matchResult.matched.length;
  const matchingRate = totalGT > 0 ? (totalMatched / totalGT * 100).toFixed(2) : 0;

  console.log(`Matching Rate: ${matchingRate}% (${totalMatched}/${totalGT})`);

  return {
    caseNum,
    caseId: gtData.caseId,
    totalGT,
    totalOCR: ocrDates.length,
    totalMatched,
    matchingRate: parseFloat(matchingRate),
    matchResult,
    itemStats,
    categoryStats,
    gtDates,
    ocrDates
  };
}

/**
 * 전체 통계 계산
 */
function calculateOverallStats(results) {
  const validResults = results.filter(r => r !== null);

  if (validResults.length === 0) {
    return null;
  }

  // 전체 통계
  const totalStats = {
    totalCases: validResults.length,
    totalGT: validResults.reduce((sum, r) => sum + r.totalGT, 0),
    totalOCR: validResults.reduce((sum, r) => sum + r.totalOCR, 0),
    totalMatched: validResults.reduce((sum, r) => sum + r.totalMatched, 0)
  };

  totalStats.overallMatchingRate = totalStats.totalGT > 0
    ? (totalStats.totalMatched / totalStats.totalGT * 100).toFixed(2)
    : 0;

  // 항목별 통계 집계
  const aggregatedItemStats = {};
  Object.keys(DATE_ITEMS).forEach(item => {
    aggregatedItemStats[item] = {
      totalGT: 0,
      totalMatched: 0,
      matchingRate: 0
    };
  });

  validResults.forEach(result => {
    Object.keys(result.itemStats).forEach(item => {
      aggregatedItemStats[item].totalGT += result.itemStats[item].gtCount;
      aggregatedItemStats[item].totalMatched += result.itemStats[item].matchedCount;
    });
  });

  Object.keys(aggregatedItemStats).forEach(item => {
    const stats = aggregatedItemStats[item];
    stats.matchingRate = stats.totalGT > 0
      ? (stats.totalMatched / stats.totalGT * 100).toFixed(2)
      : 0;
  });

  // 카테고리별 통계 집계
  const aggregatedCategoryStats = {};
  Object.keys(CATEGORY_ITEMS).forEach(category => {
    aggregatedCategoryStats[category] = {
      totalGT: 0,
      totalMatched: 0,
      matchingRate: 0
    };
  });

  validResults.forEach(result => {
    Object.keys(result.categoryStats).forEach(category => {
      aggregatedCategoryStats[category].totalGT += result.categoryStats[category].gtCount;
      aggregatedCategoryStats[category].totalMatched += result.categoryStats[category].matchedCount;
    });
  });

  Object.keys(aggregatedCategoryStats).forEach(category => {
    const stats = aggregatedCategoryStats[category];
    stats.matchingRate = stats.totalGT > 0
      ? (stats.totalMatched / stats.totalGT * 100).toFixed(2)
      : 0;
  });

  return {
    totalStats,
    aggregatedItemStats,
    aggregatedCategoryStats
  };
}

/**
 * 결과 출력
 */
function printResults(results, overallStats) {
  console.log('\n' + '='.repeat(80));
  console.log('OCR 좌표정보 포함 10개 케이스 검증 결과');
  console.log('='.repeat(80));

  console.log('\n[1] 전체 통계');
  console.log('-'.repeat(80));
  console.log(`검증 케이스 수: ${overallStats.totalStats.totalCases}개`);
  console.log(`전체 GT 날짜: ${overallStats.totalStats.totalGT}개`);
  console.log(`전체 OCR 날짜: ${overallStats.totalStats.totalOCR}개`);
  console.log(`전체 매칭 날짜: ${overallStats.totalStats.totalMatched}개`);
  console.log(`전체 매칭률: ${overallStats.totalStats.overallMatchingRate}%`);

  console.log('\n[2] 날짜 9항목별 매칭률');
  console.log('-'.repeat(80));
  console.log('항목명'.padEnd(40) + 'GT'.padStart(8) + '매칭'.padStart(8) + '매칭률'.padStart(12));
  console.log('-'.repeat(80));

  Object.entries(DATE_ITEMS).forEach(([key, name]) => {
    const stats = overallStats.aggregatedItemStats[key];
    console.log(
      name.padEnd(40) +
      stats.totalGT.toString().padStart(8) +
      stats.totalMatched.toString().padStart(8) +
      `${stats.matchingRate}%`.padStart(12)
    );
  });

  console.log('\n[3] 세무항목별(카테고리별) 매칭률');
  console.log('-'.repeat(80));
  console.log('카테고리'.padEnd(40) + 'GT'.padStart(8) + '매칭'.padStart(8) + '매칭률'.padStart(12));
  console.log('-'.repeat(80));

  Object.entries(CATEGORY_ITEMS).forEach(([key, name]) => {
    const stats = overallStats.aggregatedCategoryStats[key];
    if (stats.totalGT > 0) {  // GT가 있는 항목만 표시
      console.log(
        name.padEnd(40) +
        stats.totalGT.toString().padStart(8) +
        stats.totalMatched.toString().padStart(8) +
        `${stats.matchingRate}%`.padStart(12)
      );
    }
  });

  console.log('\n[4] 케이스별 상세 결과');
  console.log('-'.repeat(80));
  console.log('케이스'.padEnd(12) + 'GT'.padStart(8) + 'OCR'.padStart(8) + '매칭'.padStart(8) + '매칭률'.padStart(12));
  console.log('-'.repeat(80));

  results.filter(r => r !== null).forEach(result => {
    console.log(
      result.caseId.padEnd(12) +
      result.totalGT.toString().padStart(8) +
      result.totalOCR.toString().padStart(8) +
      result.totalMatched.toString().padStart(8) +
      `${result.matchingRate}%`.padStart(12)
    );
  });

  console.log('\n' + '='.repeat(80));
}

/**
 * 결과를 JSON 파일로 저장
 */
function saveResults(results, overallStats, outputPath) {
  const output = {
    timestamp: new Date().toISOString(),
    targetCases: TARGET_CASES,
    overallStats,
    caseResults: results.filter(r => r !== null).map(r => ({
      caseNum: r.caseNum,
      caseId: r.caseId,
      totalGT: r.totalGT,
      totalOCR: r.totalOCR,
      totalMatched: r.totalMatched,
      matchingRate: r.matchingRate,
      itemStats: r.itemStats,
      categoryStats: r.categoryStats,
      matchDetails: {
        matched: r.matchResult.matched.map(m => m.date),
        gtOnly: r.matchResult.gtOnly.map(m => m.date),
        ocrOnly: r.matchResult.ocrOnly.map(m => m.date)
      }
    }))
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n결과 저장: ${outputPath}`);
}

/**
 * 메인 실행
 */
function main() {
  console.log('OCR 좌표정보 포함 10개 케이스 검증 시작...');
  console.log(`타겟 케이스: ${TARGET_CASES.join(', ')}`);

  // GT 데이터 로드
  const gtResults = loadGTData();
  console.log(`GT 데이터 로드 완료: ${gtResults.length}개 케이스`);

  // 각 케이스 검증
  const results = TARGET_CASES.map(caseNum => validateCase(caseNum, gtResults));

  // 전체 통계 계산
  const overallStats = calculateOverallStats(results);

  if (!overallStats) {
    console.error('검증 결과가 없습니다.');
    process.exit(1);
  }

  // 결과 출력
  printResults(results, overallStats);

  // 결과 저장
  const outputPath = path.join(__dirname, '../OCR_VALIDATION_10_CASES_WITH_COORDINATES.json');
  saveResults(results, overallStats, outputPath);

  console.log('\n검증 완료!');
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { validateCase, calculateOverallStats };
