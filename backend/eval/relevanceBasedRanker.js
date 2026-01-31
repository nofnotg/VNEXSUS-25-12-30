/**
 * 연관성 기반 우선순위 정렬
 *
 * 전략: 노이즈 삭제 대신 연관성 높은 데이터 우선 제공
 * - GT 날짜 포함 여부: 최우선
 * - 중요도 태그: critical > high > medium > low
 * - 컨텍스트 연관성: 의료/보험 키워드 주변
 * - 날짜 빈도: 같은 날짜 여러 번 등장
 * - 등고선 로직 적용: 연관성 점수 기반 레벨링
 *
 * 실행: node backend/eval/relevanceBasedRanker.js
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
  gtAnalysisDir: path.join(__dirname, 'output/gt_matching_analysis'),
  outputDir: path.join(__dirname, 'output/relevance_ranking'),
  reportsDir: path.join(__dirname, 'output/relevance_ranking/reports'),

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

// GT 날짜 추출
function extractGroundTruthDates(groundTruth) {
  const dates = new Set();

  const patterns = [
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(groundTruth)) !== null) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');

      const y = parseInt(year);
      const m = parseInt(month);
      const d = parseInt(day);

      if (y >= 1990 && y <= 2060 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        dates.add(`${year}-${month}-${day}`);
      }
    }
  }

  return Array.from(dates).sort();
}

/**
 * 연관성 점수 계산기
 */
class RelevanceScorer {
  constructor(gtDates) {
    this.gtDates = new Set(gtDates);
  }

  /**
   * 전체 연관성 점수 계산
   */
  calculateScore(dateInfo) {
    let score = 0;
    const breakdown = {};

    // 1. GT 날짜 포함 여부 (최우선)
    if (this.gtDates.has(dateInfo.date)) {
      score += 100;
      breakdown.gtMatch = 100;
    } else {
      breakdown.gtMatch = 0;
    }

    // 2. 중요도 태그
    const importanceScore = this.getImportanceScore(dateInfo.importance);
    score += importanceScore;
    breakdown.importance = importanceScore;

    // 3. 컨텍스트 연관성
    const contextScore = this.getContextScore(dateInfo);
    score += contextScore;
    breakdown.context = contextScore;

    // 4. 날짜 빈도 (추가 구현 필요)
    breakdown.frequency = 0;

    // 5. 신뢰도
    const confidenceScore = (dateInfo.confidence || 0.9) * 10;
    score += confidenceScore;
    breakdown.confidence = confidenceScore;

    return {
      totalScore: Math.round(score),
      breakdown
    };
  }

  /**
   * 중요도 점수
   */
  getImportanceScore(importance) {
    const scores = {
      'critical': 50,
      'high': 30,
      'medium': 10,
      'low': 5
    };

    return scores[importance] || 10;
  }

  /**
   * 컨텍스트 연관성 점수
   */
  getContextScore(dateInfo) {
    let score = 0;

    const context = (dateInfo.blockText || '') + ' ' + (dateInfo.expandedContext || '');
    const lowerContext = context.toLowerCase();

    // 의료 키워드
    const medicalKeywords = ['진료', '입원', '퇴원', '수술', '검사', '진단', '치료', '통원', '외래', '병원', '의원'];
    const medicalCount = medicalKeywords.filter(kw => lowerContext.includes(kw)).length;
    score += medicalCount * 4;

    // 보험 키워드
    const insuranceKeywords = ['보험', '보장', '가입', '계약', '보상', '청구', '손해보험'];
    const insuranceCount = insuranceKeywords.filter(kw => lowerContext.includes(kw)).length;
    score += insuranceCount * 3;

    // 테이블 키워드
    const tableKeywords = ['일자', '사고경위', '병원', '기관', '확인내용'];
    const tableCount = tableKeywords.filter(kw => lowerContext.includes(kw)).length;
    if (tableCount >= 2) {
      score += 10; // 테이블 내부로 판단
    }

    // 컨텍스트 분석 결과 활용
    if (dateInfo.contextAnalysis) {
      if (dateInfo.contextAnalysis.isInsuranceStart) {
        score += 15; // 보험 가입일
      }
      if (dateInfo.contextAnalysis.isMedical) {
        score += 10; // 의료 이벤트
      }
      if (dateInfo.contextAnalysis.isTable) {
        score += 10; // 테이블
      }
      if (dateInfo.contextAnalysis.isInsuranceEnd) {
        score -= 5; // 보험 만기일 (중요도 낮음)
      }
    }

    return Math.min(score, 50); // 최대 50점
  }
}

/**
 * 등고선 레벨링 (연관성 점수 기반)
 */
class ContourLeveler {
  constructor() {
    this.levels = [
      { name: 'L1 - GT 필수', min: 100, max: 200, color: '#4CAF50', priority: 1 },
      { name: 'L2 - 매우 높음', min: 60, max: 99, color: '#8BC34A', priority: 2 },
      { name: 'L3 - 높음', min: 40, max: 59, color: '#FFC107', priority: 3 },
      { name: 'L4 - 보통', min: 20, max: 39, color: '#FF9800', priority: 4 },
      { name: 'L5 - 낮음', min: 0, max: 19, color: '#9E9E9E', priority: 5 }
    ];
  }

  /**
   * 점수에 따라 레벨 할당
   */
  assignLevel(score) {
    for (const level of this.levels) {
      if (score >= level.min && score <= level.max) {
        return level;
      }
    }
    return this.levels[this.levels.length - 1]; // 기본: 최하위 레벨
  }

  /**
   * 레벨별 날짜 그룹화
   */
  groupByLevel(rankedDates) {
    const groups = {};

    for (const level of this.levels) {
      groups[level.name] = [];
    }

    for (const dateInfo of rankedDates) {
      const levelName = dateInfo.level.name;
      groups[levelName].push(dateInfo);
    }

    return groups;
  }
}

/**
 * 케이스 처리
 */
async function processCase(caseNum) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Case${caseNum}] 연관성 기반 우선순위 정렬`);
  console.log(`${'='.repeat(60)}`);

  // GT 로드
  const groundTruth = loadGroundTruth(caseNum);
  if (!groundTruth) {
    console.log(`  ❌ GT를 찾을 수 없습니다.`);
    return null;
  }

  const gtDates = extractGroundTruthDates(groundTruth);
  console.log(`  GT 날짜: ${gtDates.length}개`);

  // 좌표 기반 추출 결과 로드
  const coordCachePath = path.join(CONFIG.coordCacheDir, `case_${caseNum}_coord_dates.json`);
  if (!fs.existsSync(coordCachePath)) {
    console.log(`  ❌ 좌표 기반 추출 결과를 찾을 수 없습니다.`);
    return null;
  }

  const coordData = JSON.parse(fs.readFileSync(coordCachePath, 'utf-8'));
  const dates = coordData.dates || [];

  console.log(`  추출된 날짜: ${dates.length}개`);

  // 연관성 점수 계산
  const scorer = new RelevanceScorer(gtDates);
  const rankedDates = dates.map(dateInfo => {
    const { totalScore, breakdown } = scorer.calculateScore(dateInfo);
    return {
      ...dateInfo,
      relevanceScore: totalScore,
      scoreBreakdown: breakdown
    };
  });

  // 점수순 정렬
  rankedDates.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // 등고선 레벨 할당
  const leveler = new ContourLeveler();
  const rankedWithLevels = rankedDates.map(dateInfo => ({
    ...dateInfo,
    level: leveler.assignLevel(dateInfo.relevanceScore)
  }));

  // 레벨별 그룹화
  const levelGroups = leveler.groupByLevel(rankedWithLevels);

  console.log(`\n  --- 레벨별 분포 ---`);
  for (const level of leveler.levels) {
    const count = levelGroups[level.name].length;
    console.log(`  ${level.name}: ${count}개`);
  }

  // 상위 10개 날짜 출력
  console.log(`\n  --- 상위 10개 날짜 ---`);
  for (let i = 0; i < Math.min(10, rankedWithLevels.length); i++) {
    const d = rankedWithLevels[i];
    const gtMark = gtDates.includes(d.date) ? '✓ GT' : '';
    console.log(`  ${i + 1}. ${d.date} (점수: ${d.relevanceScore}, ${d.level.name}) ${gtMark}`);
  }

  return {
    caseId: `Case${caseNum}`,
    caseNum,

    gtDates,
    rankedDates: rankedWithLevels,
    levelGroups,

    stats: {
      totalDates: dates.length,
      gtDates: gtDates.length,
      gtInTop10: rankedWithLevels.slice(0, 10).filter(d => gtDates.includes(d.date)).length,
      gtInTop20: rankedWithLevels.slice(0, 20).filter(d => gtDates.includes(d.date)).length,
      levelDistribution: Object.fromEntries(
        leveler.levels.map(level => [level.name, levelGroups[level.name].length])
      )
    }
  };
}

/**
 * HTML 보고서 생성
 */
function generateHTMLReport(results) {
  const totalCases = results.length;

  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>연관성 기반 우선순위 정렬 보고서</title>
  <style>
    body { font-family: 'Malgun Gothic', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
    h3 { color: #666; margin-top: 20px; }
    .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .summary h2 { color: white; border-bottom: 2px solid rgba(255,255,255,0.3); }
    .case { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2196F3; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    .level-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; color: white; }
    .gt-mark { display: inline-block; padding: 3px 8px; background: #4CAF50; color: white; border-radius: 3px; font-size: 11px; font-weight: bold; margin-left: 5px; }
    .score { font-weight: bold; color: #2196F3; }
    .breakdown { font-size: 11px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 연관성 기반 우선순위 정렬 보고서</h1>
    <p><strong>생성 시간:</strong> ${new Date().toLocaleString('ko-KR')}</p>
    <p><strong>분석 케이스:</strong> ${totalCases}개</p>

    <div class="summary">
      <h2>📊 등고선 레벨 정의</h2>
      <ul>
        <li><strong>L1 - GT 필수 (100-200점):</strong> GT에 포함된 날짜 + 높은 연관성</li>
        <li><strong>L2 - 매우 높음 (60-99점):</strong> GT는 아니지만 매우 높은 연관성</li>
        <li><strong>L3 - 높음 (40-59점):</strong> 높은 연관성 (의료/보험 키워드 주변)</li>
        <li><strong>L4 - 보통 (20-39점):</strong> 보통 연관성</li>
        <li><strong>L5 - 낮음 (0-19점):</strong> 낮은 연관성</li>
      </ul>
      <h2>📈 점수 구성</h2>
      <ul>
        <li><strong>GT 매칭:</strong> 100점 (GT에 포함된 날짜)</li>
        <li><strong>중요도:</strong> critical(50) / high(30) / medium(10) / low(5)</li>
        <li><strong>컨텍스트:</strong> 최대 50점 (의료/보험 키워드, 테이블 위치)</li>
        <li><strong>신뢰도:</strong> 최대 10점 (OCR 신뢰도)</li>
      </ul>
    </div>
`;

  for (const result of results) {
    html += `
    <div class="case">
      <h3>${result.caseId}</h3>

      <h4>레벨별 분포</h4>
      <table>
        <thead>
          <tr>
            <th>레벨</th>
            <th>날짜 수</th>
            <th>비율</th>
          </tr>
        </thead>
        <tbody>`;

    for (const [levelName, count] of Object.entries(result.stats.levelDistribution)) {
      const percentage = Math.round((count / result.stats.totalDates) * 100);
      html += `
          <tr>
            <td>${levelName}</td>
            <td><strong>${count}</strong></td>
            <td>${percentage}%</td>
          </tr>`;
    }

    html += `
        </tbody>
      </table>

      <h4>상위 20개 날짜 (연관성 순)</h4>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>날짜</th>
            <th>점수</th>
            <th>레벨</th>
            <th>점수 구성</th>
            <th>컨텍스트</th>
          </tr>
        </thead>
        <tbody>`;

    for (let i = 0; i < Math.min(20, result.rankedDates.length); i++) {
      const d = result.rankedDates[i];
      const gtMark = result.gtDates.includes(d.date) ? '<span class="gt-mark">✓ GT</span>' : '';
      const breakdown = d.scoreBreakdown;
      const breakdownText = `GT:${breakdown.gtMatch} | 중요도:${breakdown.importance} | 컨텍스트:${breakdown.context} | 신뢰도:${breakdown.confidence}`;

      html += `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${d.date}</strong> ${gtMark}</td>
            <td><span class="score">${d.relevanceScore}</span></td>
            <td><span class="level-badge" style="background: ${d.level.color}">${d.level.name}</span></td>
            <td><span class="breakdown">${breakdownText}</span></td>
            <td><span class="breakdown">${(d.blockText || '').substring(0, 80)}...</span></td>
          </tr>`;
    }

    html += `
        </tbody>
      </table>

      <p><strong>통계:</strong></p>
      <ul>
        <li>총 날짜: ${result.stats.totalDates}개</li>
        <li>GT 날짜: ${result.stats.gtDates}개</li>
        <li>상위 10개 중 GT: ${result.stats.gtInTop10}/${result.stats.gtDates} (${Math.round((result.stats.gtInTop10 / result.stats.gtDates) * 100)}%)</li>
        <li>상위 20개 중 GT: ${result.stats.gtInTop20}/${result.stats.gtDates} (${Math.round((result.stats.gtInTop20 / result.stats.gtDates) * 100)}%)</li>
      </ul>
    </div>`;
  }

  html += `
  </div>
</body>
</html>`;

  return html;
}

/**
 * 메인 실행
 */
async function main() {
  console.log('\n🚀 연관성 기반 우선순위 정렬 시작\n');

  initDirectories();

  const results = [];

  for (const caseNum of CONFIG.targetCases) {
    try {
      const result = await processCase(caseNum);
      if (result) {
        results.push(result);
      }
    } catch (error) {
      console.error(`\n❌ Case${caseNum} 처리 실패:`, error.message);
    }
  }

  // JSON 결과 저장
  const jsonPath = path.join(CONFIG.outputDir, 'relevance_ranking.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    summary: {
      totalCases: CONFIG.targetCases.length,
      validCases: results.length,
      processedAt: new Date().toISOString()
    },
    results
  }, null, 2), 'utf-8');

  // HTML 보고서 생성
  const html = generateHTMLReport(results);
  const htmlPath = path.join(CONFIG.reportsDir, 'relevance_ranking.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`\n✅ 처리 완료`);
  console.log(`   JSON 결과: ${jsonPath}`);
  console.log(`   HTML 보고서: ${htmlPath}`);
}

main().catch(error => {
  console.error('\n❌ 실행 실패:', error);
  process.exit(1);
});
