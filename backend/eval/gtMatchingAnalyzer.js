/**
 * GT 매칭율 100% 분석 및 검증
 *
 * 목표: GT 날짜 매칭율을 100%로 끌어올리기
 * - 누락된 GT 날짜 패턴 분석
 * - 누락 원인 파악 (형식, 문맥, 좌표)
 * - 개선 로직 적용 및 재검증
 * - 100% 달성까지 반복
 *
 * 실행: node backend/eval/gtMatchingAnalyzer.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  coordCacheDir: path.join(__dirname, 'output/coordinate_based_extraction/cache'),
  cycle4CacheDir: path.join(__dirname, 'output/cycle4_topdown/ocr_cache'),
  outputDir: path.join(__dirname, 'output/gt_matching_analysis'),
  reportsDir: path.join(__dirname, 'output/gt_matching_analysis/reports'),

  groundTruthDir: 'C:\\VNEXSUS_26-01-23\\VNEXSUS_reports_pdf\\sample_pdf\\caseN_report',

  targetCases: [2, 5, 13, 15, 17, 29, 30, 41, 42, 44]
};

// 초기화
function initDirectories() {
  [CONFIG.outputDir, CONFIG.reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Ground Truth 로드
function loadGroundTruth(caseNum) {
  const gtPath = path.join(CONFIG.groundTruthDir, `Case${caseNum}_report.txt`);
  if (fs.existsSync(gtPath)) {
    return fs.readFileSync(gtPath, 'utf-8');
  }
  return null;
}

// Ground Truth 날짜 추출 (상세 정보 포함)
function extractGroundTruthDatesDetailed(groundTruth) {
  const dates = [];

  const patterns = [
    { regex: /(\d{4})\.(\d{1,2})\.(\d{1,2})/g, name: 'YYYY.MM.DD' },
    { regex: /(\d{4})-(\d{1,2})-(\d{1,2})/g, name: 'YYYY-MM-DD' },
    { regex: /(\d{4})\/(\d{1,2})\/(\d{1,2})/g, name: 'YYYY/MM/DD' },
    { regex: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g, name: 'YYYY년 MM월 DD일' }
  ];

  for (const { regex, name } of patterns) {
    const regexCopy = new RegExp(regex.source, regex.flags);
    let match;

    while ((match = regexCopy.exec(groundTruth)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');

      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);

      if (y >= 1990 && y <= 2060 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const normalizedDate = `${year}-${month}-${day}`;

        // 주변 컨텍스트 추출
        const startIdx = Math.max(0, match.index - 50);
        const endIdx = Math.min(groundTruth.length, match.index + match[0].length + 50);
        const context = groundTruth.substring(startIdx, endIdx);

        dates.push({
          date: normalizedDate,
          originalFormat: match[0],
          pattern: name,
          context,
          position: match.index
        });
      }
    }
  }

  return dates;
}

// 추출된 날짜 정규화
function normalizeExtractedDates(extractedDates) {
  const normalized = new Set();

  for (const item of extractedDates) {
    const date = item.date || item;
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      normalized.add(date);
    }
  }

  return Array.from(normalized).sort();
}

// 매칭 분석
function analyzeMatching(extractedDates, gtDates) {
  const extractedSet = new Set(extractedDates);
  const gtSet = new Set(gtDates.map(d => d.date));

  const matched = [];
  const missed = [];

  for (const gtDate of gtDates) {
    if (extractedSet.has(gtDate.date)) {
      matched.push(gtDate);
    } else {
      missed.push(gtDate);
    }
  }

  const extra = extractedDates.filter(d => !gtSet.has(d));

  const gtCoverageRate = gtDates.length > 0
    ? Math.round((matched.length / gtDates.length) * 100)
    : 100;

  return {
    matched,
    missed,
    extra,
    gtCoverageRate,
    matchedCount: matched.length,
    missedCount: missed.length,
    extraCount: extra.length,
    totalGtDates: gtDates.length,
    totalExtractedDates: extractedDates.length
  };
}

// 누락 패턴 분석
function analyzeMissedPatterns(missed) {
  const patternStats = {};
  const contextKeywords = {};

  for (const missedDate of missed) {
    // 패턴별 통계
    const pattern = missedDate.pattern;
    if (!patternStats[pattern]) {
      patternStats[pattern] = { count: 0, examples: [] };
    }
    patternStats[pattern].count++;
    if (patternStats[pattern].examples.length < 3) {
      patternStats[pattern].examples.push({
        date: missedDate.date,
        originalFormat: missedDate.originalFormat,
        context: missedDate.context.substring(0, 100)
      });
    }

    // 컨텍스트 키워드 분석
    const context = missedDate.context.toLowerCase();
    const keywords = ['보험', '가입', '보장', '만기', '입원', '퇴원', '수술', '검사', '진단', '치료', '통원'];

    for (const kw of keywords) {
      if (context.includes(kw)) {
        contextKeywords[kw] = (contextKeywords[kw] || 0) + 1;
      }
    }
  }

  return {
    patternStats,
    contextKeywords,
    totalMissed: missed.length
  };
}

// 개선 제안 생성
function generateImprovementSuggestions(missedAnalysis) {
  const suggestions = [];

  // 패턴별 제안
  for (const [pattern, stats] of Object.entries(missedAnalysis.patternStats)) {
    if (stats.count > 0) {
      suggestions.push({
        type: 'pattern',
        priority: 'high',
        pattern,
        count: stats.count,
        suggestion: `${pattern} 형식의 날짜 ${stats.count}개 누락. 정규식 패턴 강화 필요.`,
        examples: stats.examples
      });
    }
  }

  // 컨텍스트별 제안
  const sortedKeywords = Object.entries(missedAnalysis.contextKeywords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  for (const [keyword, count] of sortedKeywords) {
    suggestions.push({
      type: 'context',
      priority: 'medium',
      keyword,
      count,
      suggestion: `"${keyword}" 주변 날짜 ${count}개 누락. 키워드 주변 탐색 범위 확대 필요.`
    });
  }

  return suggestions;
}

// 케이스 분석
async function analyzeCase(caseNum) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] GT 매칭 분석`);
  console.log(`${'='.repeat(60)}`);

  // GT 로드
  const groundTruth = loadGroundTruth(caseNum);
  if (!groundTruth) {
    console.log(`  ❌ GT를 찾을 수 없습니다.`);
    return null;
  }

  const gtDates = extractGroundTruthDatesDetailed(groundTruth);
  console.log(`  GT 날짜: ${gtDates.length}개`);

  // 좌표 기반 추출 결과 로드
  const coordCachePath = path.join(CONFIG.coordCacheDir, `case_${caseNum}_coord_dates.json`);
  let coordDates = [];

  if (fs.existsSync(coordCachePath)) {
    const coordData = JSON.parse(fs.readFileSync(coordCachePath, 'utf-8'));
    coordDates = normalizeExtractedDates(coordData.dates || []);
    console.log(`  좌표 기반 추출: ${coordDates.length}개`);
  } else {
    console.log(`  ⚠️  좌표 기반 추출 결과 없음. coordinateBasedDateExtractor.js를 먼저 실행하세요.`);
  }

  // Cycle 4 결과 로드
  const cycle4CachePath = path.join(CONFIG.cycle4CacheDir, `case_${caseNum}_topdown.json`);
  let cycle4Dates = [];

  if (fs.existsSync(cycle4CachePath)) {
    const cycle4Data = JSON.parse(fs.readFileSync(cycle4CachePath, 'utf-8'));
    const generatedJson = cycle4Data.generatedJson || {};

    const dates = new Set();

    // allExtractedDates
    if (generatedJson.allExtractedDates) {
      generatedJson.allExtractedDates.forEach(item => {
        const normalized = item.date.split('T')[0];
        if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dates.add(normalized);
        }
      });
    }

    // dateRanges
    if (generatedJson.dateRanges) {
      generatedJson.dateRanges.forEach(item => {
        if (item.startDate) {
          const normalized = item.startDate.split('T')[0];
          if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dates.add(normalized);
          }
        }
        if (item.endDate) {
          const normalized = item.endDate.split('T')[0];
          if (normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dates.add(normalized);
          }
        }
      });
    }

    cycle4Dates = Array.from(dates).sort();
    console.log(`  Cycle 4 (Vision LLM): ${cycle4Dates.length}개`);
  } else {
    console.log(`  ⚠️  Cycle 4 결과 없음.`);
  }

  // 통합 날짜 (좌표 + Cycle 4)
  const combined = new Set([...coordDates, ...cycle4Dates]);
  const combinedDates = Array.from(combined).sort();
  console.log(`  통합 (좌표 + Cycle 4): ${combinedDates.length}개`);

  // 매칭 분석
  console.log(`\n  --- 매칭 분석 ---`);

  // 좌표 기반만
  const coordMatching = coordDates.length > 0
    ? analyzeMatching(coordDates, gtDates)
    : null;

  if (coordMatching) {
    console.log(`  좌표 기반: ${coordMatching.gtCoverageRate}% (${coordMatching.matchedCount}/${coordMatching.totalGtDates})`);
    if (coordMatching.missedCount > 0) {
      console.log(`    누락: ${coordMatching.missed.slice(0, 3).map(d => d.date).join(', ')}${coordMatching.missedCount > 3 ? '...' : ''}`);
    }
  }

  // Cycle 4만
  const cycle4Matching = cycle4Dates.length > 0
    ? analyzeMatching(cycle4Dates, gtDates)
    : null;

  if (cycle4Matching) {
    console.log(`  Cycle 4: ${cycle4Matching.gtCoverageRate}% (${cycle4Matching.matchedCount}/${cycle4Matching.totalGtDates})`);
    if (cycle4Matching.missedCount > 0) {
      console.log(`    누락: ${cycle4Matching.missed.slice(0, 3).map(d => d.date).join(', ')}${cycle4Matching.missedCount > 3 ? '...' : ''}`);
    }
  }

  // 통합
  const combinedMatching = analyzeMatching(combinedDates, gtDates);
  console.log(`  통합: ${combinedMatching.gtCoverageRate}% (${combinedMatching.matchedCount}/${combinedMatching.totalGtDates})`);

  if (combinedMatching.gtCoverageRate === 100) {
    console.log(`  🎉 GT 100% 달성!`);
  } else {
    console.log(`  ⚠️  아직 ${combinedMatching.missedCount}개 누락`);
    console.log(`    누락: ${combinedMatching.missed.slice(0, 5).map(d => d.date).join(', ')}`);
  }

  // 누락 패턴 분석
  const missedAnalysis = combinedMatching.missedCount > 0
    ? analyzeMissedPatterns(combinedMatching.missed)
    : null;

  // 개선 제안
  const suggestions = missedAnalysis
    ? generateImprovementSuggestions(missedAnalysis)
    : [];

  return {
    caseId: `Case${caseNum}`,
    caseNum,

    gtDates: gtDates.map(d => ({ date: d.date, format: d.originalFormat, pattern: d.pattern })),

    coordMatching,
    cycle4Matching,
    combinedMatching,

    missedAnalysis,
    suggestions,

    achieved100: combinedMatching.gtCoverageRate === 100
  };
}

// HTML 보고서 생성
function generateHTMLReport(results) {
  const totalCases = results.length;
  const achieved100Count = results.filter(r => r.achieved100).length;
  const avgCoverage = Math.round(
    results.reduce((sum, r) => sum + (r.combinedMatching?.gtCoverageRate || 0), 0) / totalCases
  );

  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GT 매칭율 100% 분석 보고서</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
    h3 { color: #666; margin-top: 20px; }
    .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary h2 { color: white; border-bottom: 2px solid rgba(255,255,255,0.3); }
    .stat { display: inline-block; margin: 10px 20px 10px 0; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .case { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196F3; }
    .case.achieved { border-left-color: #4CAF50; }
    .case.not-achieved { border-left-color: #FF9800; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 10px; }
    .badge-success { background: #4CAF50; color: white; }
    .badge-warning { background: #FF9800; color: white; }
    .badge-info { background: #2196F3; color: white; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    .progress-bar { width: 100%; height: 30px; background: #e0e0e0; border-radius: 15px; overflow: hidden; margin: 10px 0; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; transition: width 0.3s; }
    .suggestion { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .suggestion-high { border-left-color: #f44336; background: #ffebee; }
    .suggestion-medium { border-left-color: #ff9800; background: #fff3e0; }
    .missed-date { color: #f44336; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 GT 날짜 매칭율 100% 분석 보고서</h1>
    <p><strong>생성 시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
    <p><strong>분석 케이스:</strong> ${totalCases}개 (Case 2, 5, 13, 15, 17, 29, 30, 41, 42, 44)</p>

    <div class="summary">
      <h2>📈 전체 요약</h2>
      <div class="stat">
        <div class="stat-label">평균 GT 매칭율</div>
        <div class="stat-value">${avgCoverage}%</div>
      </div>
      <div class="stat">
        <div class="stat-label">100% 달성 케이스</div>
        <div class="stat-value">${achieved100Count}/${totalCases}</div>
      </div>
      <div class="stat">
        <div class="stat-label">총 GT 날짜</div>
        <div class="stat-value">${results.reduce((sum, r) => sum + (r.gtDates?.length || 0), 0)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">총 누락</div>
        <div class="stat-value">${results.reduce((sum, r) => sum + (r.combinedMatching?.missedCount || 0), 0)}</div>
      </div>
    </div>

    <h2>📋 케이스별 상세 분석</h2>
`;

  for (const result of results) {
    const caseClass = result.achieved100 ? 'achieved' : 'not-achieved';
    const badge = result.achieved100
      ? '<span class="badge badge-success">✓ 100% 달성</span>'
      : `<span class="badge badge-warning">⚠ ${result.combinedMatching.missedCount}개 누락</span>`;

    html += `
    <div class="case ${caseClass}">
      <h3>${result.caseId} ${badge}</h3>

      <h4>GT 매칭 현황</h4>
      <table>
        <thead>
          <tr>
            <th>방법</th>
            <th>GT 매칭율</th>
            <th>매칭</th>
            <th>누락</th>
            <th>추출 총 날짜</th>
          </tr>
        </thead>
        <tbody>`;

    if (result.coordMatching) {
      html += `
          <tr>
            <td><span class="badge badge-info">좌표 기반</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${result.coordMatching.gtCoverageRate}%">
                  ${result.coordMatching.gtCoverageRate}%
                </div>
              </div>
            </td>
            <td>${result.coordMatching.matchedCount}/${result.coordMatching.totalGtDates}</td>
            <td><span class="missed-date">${result.coordMatching.missedCount}</span></td>
            <td>${result.coordMatching.totalExtractedDates}</td>
          </tr>`;
    }

    if (result.cycle4Matching) {
      html += `
          <tr>
            <td><span class="badge badge-info">Cycle 4 (Vision LLM)</span></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${result.cycle4Matching.gtCoverageRate}%">
                  ${result.cycle4Matching.gtCoverageRate}%
                </div>
              </div>
            </td>
            <td>${result.cycle4Matching.matchedCount}/${result.cycle4Matching.totalGtDates}</td>
            <td><span class="missed-date">${result.cycle4Matching.missedCount}</span></td>
            <td>${result.cycle4Matching.totalExtractedDates}</td>
          </tr>`;
    }

    html += `
          <tr style="background: #e8f5e9;">
            <td><strong>통합 (좌표 + Cycle 4)</strong></td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${result.combinedMatching.gtCoverageRate}%">
                  ${result.combinedMatching.gtCoverageRate}%
                </div>
              </div>
            </td>
            <td><strong>${result.combinedMatching.matchedCount}/${result.combinedMatching.totalGtDates}</strong></td>
            <td><span class="missed-date"><strong>${result.combinedMatching.missedCount}</strong></span></td>
            <td><strong>${result.combinedMatching.totalExtractedDates}</strong></td>
          </tr>
        </tbody>
      </table>`;

    if (!result.achieved100 && result.combinedMatching.missed.length > 0) {
      html += `
      <h4>누락된 GT 날짜</h4>
      <ul>`;
      for (const missed of result.combinedMatching.missed.slice(0, 10)) {
        html += `<li><span class="missed-date">${missed.date}</span> (${missed.pattern}) - "${missed.context.substring(0, 80)}..."</li>`;
      }
      if (result.combinedMatching.missed.length > 10) {
        html += `<li>... 외 ${result.combinedMatching.missed.length - 10}개</li>`;
      }
      html += `</ul>`;

      if (result.suggestions && result.suggestions.length > 0) {
        html += `
      <h4>개선 제안</h4>`;
        for (const suggestion of result.suggestions) {
          const suggClass = suggestion.priority === 'high' ? 'suggestion-high' : 'suggestion-medium';
          html += `<div class="suggestion ${suggClass}"><strong>${suggestion.type === 'pattern' ? '패턴' : '컨텍스트'}:</strong> ${suggestion.suggestion}</div>`;
        }
      }
    }

    html += `
    </div>`;
  }

  html += `
  </div>
</body>
</html>`;

  return html;
}

// 메인 실행
async function main() {
  console.log('\n🚀 GT 매칭율 100% 분석 시작\n');

  initDirectories();

  const results = [];

  for (const caseNum of CONFIG.targetCases) {
    try {
      const result = await analyzeCase(caseNum);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`\n❌ Case${caseNum} 분석 실패:`, error.message);
    }
  }

  // JSON 결과 저장
  const jsonPath = path.join(CONFIG.outputDir, 'gt_matching_analysis.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    summary: {
      totalCases: CONFIG.targetCases.length,
      validCases: results.length,
      achieved100Count: results.filter(r => r.achieved100).length,
      avgCoverage: Math.round(
        results.reduce((sum, r) => sum + (r.combinedMatching?.gtCoverageRate || 0), 0) / results.length
      ),
      processedAt: new Date().toISOString()
    },
    results
  }, null, 2), 'utf-8');

  // HTML 보고서 생성
  const html = generateHTMLReport(results);
  const htmlPath = path.join(CONFIG.reportsDir, 'gt_matching_analysis.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`\n✅ 분석 완료`);
  console.log(`   JSON 결과: ${jsonPath}`);
  console.log(`   HTML 보고서: ${htmlPath}`);
  console.log(`\n📊 요약:`);
  console.log(`   평균 GT 매칭율: ${Math.round(results.reduce((sum, r) => sum + (r.combinedMatching?.gtCoverageRate || 0), 0) / results.length)}%`);
  console.log(`   100% 달성: ${results.filter(r => r.achieved100).length}/${results.length} 케이스`);
}

main().catch(error => {
  console.error('\n❌ 실행 실패:', error);
  process.exit(1);
});
