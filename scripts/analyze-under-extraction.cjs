#!/usr/bin/env node

/**
 * Under-Extraction 패턴 분석 스크립트
 * - 놓친 날짜들의 공통 패턴 분석
 * - 항목별 Under-Extraction 상세 분석
 * - 컨텍스트 분석 및 개선 방향 도출
 */

const fs = require('fs');
const path = require('path');

// 검증 결과 로드
const validationResultPath = path.join(__dirname, '../OCR_VALIDATION_10_CASES_WITH_COORDINATES.json');
const validationResult = JSON.parse(fs.readFileSync(validationResultPath, 'utf8'));

// GT 데이터 로드
const gtDataPath = path.join(__dirname, '../backend/eval/output/comprehensive_gt_analysis/comprehensive_gt_analysis.json');
const gtData = JSON.parse(fs.readFileSync(gtDataPath, 'utf8'));

// OCR 결과 로드 함수
function loadOCRResult(caseNum) {
  const ocrPath = path.join(__dirname, `../backend/eval/output/cycle4_topdown/ocr_cache/case_${caseNum}_topdown.json`);
  if (!fs.existsSync(ocrPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(ocrPath, 'utf8'));
}

/**
 * 날짜 정규화
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  return dateStr.replace(/[./]/g, '-').trim();
}

/**
 * Under-Extraction 상세 분석
 */
function analyzeUnderExtraction() {
  const underExtractionAnalysis = {
    summary: {
      totalCases: validationResult.caseResults.length,
      totalGT: validationResult.overallStats.totalStats.totalGT,
      totalMatched: validationResult.overallStats.totalStats.totalMatched,
      totalMissed: validationResult.overallStats.totalStats.totalGT - validationResult.overallStats.totalStats.totalMatched,
      missRate: ((validationResult.overallStats.totalStats.totalGT - validationResult.overallStats.totalStats.totalMatched) / validationResult.overallStats.totalStats.totalGT * 100).toFixed(2)
    },
    itemAnalysis: {},
    categoryAnalysis: {},
    caseAnalysis: [],
    missedDatePatterns: [],
    contextPatterns: {
      withStrongContext: [],
      withWeakContext: [],
      withoutContext: []
    }
  };

  // 항목별 Under-Extraction 분석
  const itemStats = validationResult.overallStats.aggregatedItemStats;
  Object.keys(itemStats).forEach(itemKey => {
    const stats = itemStats[itemKey];
    underExtractionAnalysis.itemAnalysis[itemKey] = {
      name: itemKey,
      totalGT: stats.totalGT,
      matched: stats.totalMatched,
      missed: stats.totalGT - stats.totalMatched,
      missRate: stats.totalGT > 0 ? ((stats.totalGT - stats.totalMatched) / stats.totalGT * 100).toFixed(2) : 0,
      matchingRate: stats.matchingRate
    };
  });

  // 카테고리별 Under-Extraction 분석
  const categoryStats = validationResult.overallStats.aggregatedCategoryStats;
  Object.keys(categoryStats).forEach(catKey => {
    const stats = categoryStats[catKey];
    if (stats.totalGT > 0) {
      underExtractionAnalysis.categoryAnalysis[catKey] = {
        name: catKey,
        totalGT: stats.totalGT,
        matched: stats.totalMatched,
        missed: stats.totalGT - stats.totalMatched,
        missRate: ((stats.totalGT - stats.totalMatched) / stats.totalGT * 100).toFixed(2),
        matchingRate: stats.matchingRate
      };
    }
  });

  // 케이스별 상세 분석
  validationResult.caseResults.forEach(caseResult => {
    const caseNum = caseResult.caseNum;

    // GT 데이터 찾기
    const gtCaseData = gtData.results.find(r => r.caseNum === caseNum);
    if (!gtCaseData) return;

    // OCR 결과 로드
    const ocrData = loadOCRResult(caseNum);
    if (!ocrData) return;

    const gtDates = gtCaseData.gtDates || [];
    const ocrDates = ocrData.generatedJson?.allExtractedDates || [];
    const ocrDateSet = new Set(ocrDates.map(d => normalizeDate(d.date)));

    // 놓친 날짜 찾기
    const missedDates = gtDates.filter(gtDate => {
      const normalized = normalizeDate(gtDate.date);
      return !ocrDateSet.has(normalized);
    });

    // 케이스 분석
    const caseAnalysis = {
      caseNum,
      caseId: caseResult.caseId,
      totalGT: caseResult.totalGT,
      matched: caseResult.totalMatched,
      missed: missedDates.length,
      missRate: ((missedDates.length / caseResult.totalGT) * 100).toFixed(2),
      missedDates: missedDates.map(md => ({
        date: md.date,
        categories: md.categories || [],
        context: md.context || '',
        coordinates: md.coordinates || null
      }))
    };

    underExtractionAnalysis.caseAnalysis.push(caseAnalysis);

    // 놓친 날짜 패턴 수집
    missedDates.forEach(md => {
      underExtractionAnalysis.missedDatePatterns.push({
        caseNum,
        date: md.date,
        categories: md.categories || [],
        context: md.context || '',
        coordinates: md.coordinates || null
      });

      // 컨텍스트 강도 분류
      const context = md.context || '';
      const hasStrongContext = /내원|진료|검사|치료|입원|통원|진단|소견|병력/i.test(context);
      const hasWeakContext = context.length > 0 && context.length < 50;

      if (hasStrongContext) {
        underExtractionAnalysis.contextPatterns.withStrongContext.push({
          caseNum,
          date: md.date,
          context,
          categories: md.categories
        });
      } else if (hasWeakContext) {
        underExtractionAnalysis.contextPatterns.withWeakContext.push({
          caseNum,
          date: md.date,
          context,
          categories: md.categories
        });
      } else {
        underExtractionAnalysis.contextPatterns.withoutContext.push({
          caseNum,
          date: md.date,
          context,
          categories: md.categories
        });
      }
    });
  });

  return underExtractionAnalysis;
}

/**
 * Over-Extraction 분석 (과다 추출)
 */
function analyzeOverExtraction() {
  const overExtractionAnalysis = {
    summary: {
      totalOCR: validationResult.overallStats.totalStats.totalOCR,
      totalGT: validationResult.overallStats.totalStats.totalGT,
      overExtracted: validationResult.overallStats.totalStats.totalOCR - validationResult.overallStats.totalStats.totalGT,
      overExtractionRate: ((validationResult.overallStats.totalStats.totalOCR / validationResult.overallStats.totalStats.totalGT - 1) * 100).toFixed(2)
    },
    caseAnalysis: []
  };

  validationResult.caseResults.forEach(caseResult => {
    const overExtracted = caseResult.totalOCR - caseResult.totalGT;
    const overRate = caseResult.totalGT > 0 ? ((overExtracted / caseResult.totalGT) * 100).toFixed(2) : 0;

    overExtractionAnalysis.caseAnalysis.push({
      caseNum: caseResult.caseNum,
      caseId: caseResult.caseId,
      totalOCR: caseResult.totalOCR,
      totalGT: caseResult.totalGT,
      overExtracted,
      overRate: parseFloat(overRate),
      ocrOnlyDates: caseResult.matchDetails.ocrOnly
    });
  });

  // 과다 추출 많은 순으로 정렬
  overExtractionAnalysis.caseAnalysis.sort((a, b) => b.overExtracted - a.overExtracted);

  return overExtractionAnalysis;
}

/**
 * 개선 방향 도출
 */
function deriveImprovementDirections(underExtraction, overExtraction) {
  const improvements = {
    underExtractionImprovements: [],
    overExtractionImprovements: [],
    contextFilteringImprovements: []
  };

  // Under-Extraction 개선 방향
  const sortedItems = Object.values(underExtraction.itemAnalysis)
    .sort((a, b) => b.missRate - a.missRate);

  sortedItems.forEach(item => {
    if (parseFloat(item.missRate) > 20) {
      improvements.underExtractionImprovements.push({
        priority: 'HIGH',
        item: item.name,
        missRate: item.missRate,
        suggestion: `${item.name} 항목의 날짜 추출 패턴 강화 필요 (누락률 ${item.missRate}%)`
      });
    }
  });

  // Over-Extraction 개선 방향
  const avgOverRate = parseFloat(overExtraction.summary.overExtractionRate);
  if (avgOverRate > 100) {
    improvements.overExtractionImprovements.push({
      priority: 'CRITICAL',
      issue: '과다 추출 심각',
      overRate: avgOverRate.toFixed(2),
      suggestion: `OCR이 GT 대비 ${avgOverRate.toFixed(0)}% 과다 추출. 중복 제거 및 필터링 로직 강화 필요`
    });
  }

  // 컨텍스트 기반 필터링 개선
  const strongContextMissed = underExtraction.contextPatterns.withStrongContext.length;
  const weakContextMissed = underExtraction.contextPatterns.withWeakContext.length;
  const noContextMissed = underExtraction.contextPatterns.withoutContext.length;

  if (strongContextMissed > 0) {
    improvements.contextFilteringImprovements.push({
      priority: 'HIGH',
      issue: '강한 컨텍스트가 있는데도 놓친 날짜',
      count: strongContextMissed,
      suggestion: '의료 키워드가 포함된 컨텍스트의 날짜 추출 로직 개선 필요'
    });
  }

  if (weakContextMissed > 5) {
    improvements.contextFilteringImprovements.push({
      priority: 'MEDIUM',
      issue: '약한 컨텍스트로 인한 누락',
      count: weakContextMissed,
      suggestion: '컨텍스트 범위 확장 및 주변 텍스트 분석 강화 필요'
    });
  }

  if (noContextMissed > 0) {
    improvements.contextFilteringImprovements.push({
      priority: 'LOW',
      issue: '컨텍스트 없는 날짜 누락',
      count: noContextMissed,
      suggestion: '날짜 단독 추출 로직 검토 필요'
    });
  }

  return improvements;
}

/**
 * 결과 출력
 */
function printAnalysis(underExtraction, overExtraction, improvements) {
  console.log('\n' + '='.repeat(100));
  console.log('Under-Extraction & Over-Extraction 심층 분석 보고서');
  console.log('='.repeat(100));

  // Under-Extraction 요약
  console.log('\n[1] Under-Extraction 요약 (놓친 날짜)');
  console.log('-'.repeat(100));
  console.log(`전체 GT 날짜: ${underExtraction.summary.totalGT}개`);
  console.log(`매칭된 날짜: ${underExtraction.summary.totalMatched}개`);
  console.log(`놓친 날짜: ${underExtraction.summary.totalMissed}개`);
  console.log(`전체 누락률: ${underExtraction.summary.missRate}%`);

  // 항목별 Under-Extraction
  console.log('\n[2] 항목별 Under-Extraction 분석');
  console.log('-'.repeat(100));
  console.log('항목명'.padEnd(40) + 'GT'.padStart(8) + '매칭'.padStart(8) + '누락'.padStart(8) + '누락률'.padStart(12));
  console.log('-'.repeat(100));

  const sortedItems = Object.values(underExtraction.itemAnalysis)
    .sort((a, b) => b.missRate - a.missRate);

  sortedItems.forEach(item => {
    console.log(
      item.name.padEnd(40) +
      item.totalGT.toString().padStart(8) +
      item.matched.toString().padStart(8) +
      item.missed.toString().padStart(8) +
      `${item.missRate}%`.padStart(12)
    );
  });

  // Over-Extraction 요약
  console.log('\n[3] Over-Extraction 요약 (과다 추출)');
  console.log('-'.repeat(100));
  console.log(`전체 OCR 날짜: ${overExtraction.summary.totalOCR}개`);
  console.log(`전체 GT 날짜: ${overExtraction.summary.totalGT}개`);
  console.log(`과다 추출: ${overExtraction.summary.overExtracted}개`);
  console.log(`과다 추출률: ${overExtraction.summary.overExtractionRate}%`);

  // 케이스별 Over-Extraction Top 5
  console.log('\n[4] 케이스별 Over-Extraction Top 5');
  console.log('-'.repeat(100));
  console.log('케이스'.padEnd(15) + 'OCR'.padStart(8) + 'GT'.padStart(8) + '과다추출'.padStart(10) + '과다율'.padStart(12));
  console.log('-'.repeat(100));

  overExtraction.caseAnalysis.slice(0, 5).forEach(ca => {
    console.log(
      ca.caseId.padEnd(15) +
      ca.totalOCR.toString().padStart(8) +
      ca.totalGT.toString().padStart(8) +
      ca.overExtracted.toString().padStart(10) +
      `${ca.overRate}%`.padStart(12)
    );
  });

  // 컨텍스트 패턴 분석
  console.log('\n[5] 놓친 날짜의 컨텍스트 패턴 분석');
  console.log('-'.repeat(100));
  console.log(`강한 컨텍스트가 있는데 놓친 날짜: ${underExtraction.contextPatterns.withStrongContext.length}개`);
  console.log(`약한 컨텍스트로 놓친 날짜: ${underExtraction.contextPatterns.withWeakContext.length}개`);
  console.log(`컨텍스트 없이 놓친 날짜: ${underExtraction.contextPatterns.withoutContext.length}개`);

  if (underExtraction.contextPatterns.withStrongContext.length > 0) {
    console.log('\n강한 컨텍스트가 있는데 놓친 날짜 예시 (최대 10개):');
    underExtraction.contextPatterns.withStrongContext.slice(0, 10).forEach(item => {
      console.log(`  - Case${item.caseNum}: ${item.date} | ${item.context.substring(0, 80)}...`);
    });
  }

  // 개선 방향
  console.log('\n[6] 개선 방향 제안');
  console.log('-'.repeat(100));

  if (improvements.underExtractionImprovements.length > 0) {
    console.log('\n▶ Under-Extraction 개선:');
    improvements.underExtractionImprovements.forEach(imp => {
      console.log(`  [${imp.priority}] ${imp.suggestion}`);
    });
  }

  if (improvements.overExtractionImprovements.length > 0) {
    console.log('\n▶ Over-Extraction 개선:');
    improvements.overExtractionImprovements.forEach(imp => {
      console.log(`  [${imp.priority}] ${imp.suggestion}`);
    });
  }

  if (improvements.contextFilteringImprovements.length > 0) {
    console.log('\n▶ 컨텍스트 필터링 개선:');
    improvements.contextFilteringImprovements.forEach(imp => {
      console.log(`  [${imp.priority}] ${imp.suggestion} (${imp.count}건)`);
    });
  }

  console.log('\n' + '='.repeat(100));
}

/**
 * 결과를 JSON으로 저장
 */
function saveAnalysis(underExtraction, overExtraction, improvements, outputPath) {
  const output = {
    timestamp: new Date().toISOString(),
    underExtraction,
    overExtraction,
    improvements
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n분석 결과 저장: ${outputPath}`);
}

/**
 * 메인 실행
 */
function main() {
  console.log('Under-Extraction & Over-Extraction 분석 시작...');

  // Under-Extraction 분석
  const underExtraction = analyzeUnderExtraction();

  // Over-Extraction 분석
  const overExtraction = analyzeOverExtraction();

  // 개선 방향 도출
  const improvements = deriveImprovementDirections(underExtraction, overExtraction);

  // 결과 출력
  printAnalysis(underExtraction, overExtraction, improvements);

  // 결과 저장
  const outputPath = path.join(__dirname, '../UNDER_OVER_EXTRACTION_ANALYSIS.json');
  saveAnalysis(underExtraction, overExtraction, improvements, outputPath);

  console.log('\n분석 완료!');
}

// 실행
if (require.main === module) {
  main();
}

module.exports = { analyzeUnderExtraction, analyzeOverExtraction };
