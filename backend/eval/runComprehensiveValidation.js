/**
 * 종합 검증 실행 스크립트
 *
 * 사용자 피드백 기반 OCR 파이프라인 종합 검증
 * - Phase 1: Google OCR bbox 좌표 추출
 * - Phase 2: 좌표 기반 날짜 추출 개선
 * - Phase 3: GT 매칭율 100% 분석
 * - Phase 4: 연관성 기반 우선순위 정렬
 * - Phase 5: 최종 종합 보고서 생성
 *
 * 실행: node backend/eval/runComprehensiveValidation.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  outputDir: path.join(__dirname, 'output/comprehensive_validation'),
  reportsDir: path.join(__dirname, 'output/comprehensive_validation/reports'),

  scripts: [
    {
      name: 'Phase 1: Google OCR bbox 좌표 추출',
      script: 'backend/eval/extractGoogleOCRBbox.js',
      optional: false
    },
    {
      name: 'Phase 2: 좌표 기반 날짜 추출 개선',
      script: 'backend/eval/coordinateBasedDateExtractor.js',
      optional: false
    },
    {
      name: 'Phase 3: GT 매칭율 100% 분석',
      script: 'backend/eval/gtMatchingAnalyzer.js',
      optional: false
    },
    {
      name: 'Phase 4: 연관성 기반 우선순위 정렬',
      script: 'backend/eval/relevanceBasedRanker.js',
      optional: false
    }
  ]
};

// 초기화
function initDirectories() {
  [CONFIG.outputDir, CONFIG.reportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// 스크립트 실행
function runScript(scriptPath, name) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 ${name}`);
  console.log(`${'='.repeat(70)}\n`);

  const startTime = Date.now();

  try {
    execSync(`node ${scriptPath}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ ${name} 완료 (${elapsed}초)`);

    return {
      name,
      success: true,
      elapsed
    };

  } catch (error) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.error(`\n❌ ${name} 실패 (${elapsed}초)`);
    console.error(error.message);

    return {
      name,
      success: false,
      elapsed,
      error: error.message
    };
  }
}

// 최종 종합 보고서 생성
function generateFinalReport(results) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 최종 종합 보고서 생성`);
  console.log(`${'='.repeat(70)}\n`);

  // 각 단계별 결과 로드
  const gtAnalysisPath = path.join(__dirname, 'output/gt_matching_analysis/gt_matching_analysis.json');
  const rankingPath = path.join(__dirname, 'output/relevance_ranking/relevance_ranking.json');

  let gtAnalysis = null;
  let ranking = null;

  if (fs.existsSync(gtAnalysisPath)) {
    gtAnalysis = JSON.parse(fs.readFileSync(gtAnalysisPath, 'utf-8'));
    console.log(`  ✓ GT 매칭 분석 로드 완료`);
  }

  if (fs.existsSync(rankingPath)) {
    ranking = JSON.parse(fs.readFileSync(rankingPath, 'utf-8'));
    console.log(`  ✓ 연관성 순위 로드 완료`);
  }

  // HTML 보고서 생성
  const html = generateHTML(results, gtAnalysis, ranking);
  const htmlPath = path.join(CONFIG.reportsDir, 'comprehensive_validation_report.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  console.log(`  ✓ HTML 보고서 생성: ${htmlPath}`);

  // JSON 요약 저장
  const summary = {
    executionTime: new Date().toISOString(),
    phases: results,
    gtAnalysisSummary: gtAnalysis ? gtAnalysis.summary : null,
    rankingSummary: ranking ? ranking.summary : null
  };

  const jsonPath = path.join(CONFIG.outputDir, 'validation_summary.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log(`  ✓ JSON 요약 저장: ${jsonPath}`);

  return { htmlPath, jsonPath };
}

// HTML 생성
function generateHTML(results, gtAnalysis, ranking) {
  const successCount = results.filter(r => r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);

  let html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>사용자 피드백 기반 OCR 파이프라인 종합 검증 보고서</title>
  <style>
    body {
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      border-bottom: 4px solid #667eea;
      padding-bottom: 15px;
      margin-bottom: 30px;
      font-size: 32px;
    }
    h2 {
      color: #555;
      margin-top: 40px;
      border-bottom: 2px solid #ddd;
      padding-bottom: 10px;
      font-size: 24px;
    }
    h3 {
      color: #666;
      margin-top: 25px;
      font-size: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: white;
      border-bottom: 3px solid rgba(255,255,255,0.3);
      margin: 0 0 20px 0;
      padding-bottom: 15px;
    }
    .meta {
      display: flex;
      gap: 30px;
      flex-wrap: wrap;
    }
    .meta-item {
      flex: 1;
      min-width: 200px;
    }
    .meta-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .meta-value {
      font-size: 28px;
      font-weight: bold;
    }
    .phase-card {
      background: #f9f9f9;
      padding: 20px;
      margin: 15px 0;
      border-radius: 8px;
      border-left: 5px solid #2196F3;
    }
    .phase-card.success {
      border-left-color: #4CAF50;
    }
    .phase-card.failed {
      border-left-color: #f44336;
    }
    .badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 15px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }
    .badge-success {
      background: #4CAF50;
      color: white;
    }
    .badge-error {
      background: #f44336;
      color: white;
    }
    .badge-info {
      background: #2196F3;
      color: white;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f5f5f5;
      font-weight: bold;
      color: #333;
    }
    .progress-bar {
      width: 100%;
      height: 35px;
      background: #e0e0e0;
      border-radius: 18px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      transition: width 0.3s;
    }
    .highlight {
      background: #fff3cd;
      padding: 15px;
      border-left: 4px solid #ffc107;
      margin: 15px 0;
      border-radius: 4px;
    }
    .success-box {
      background: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .key-finding {
      background: #e3f2fd;
      border-left: 4px solid #2196F3;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .key-finding h3 {
      margin-top: 0;
      color: #1976D2;
    }
    ul.findings {
      list-style: none;
      padding: 0;
    }
    ul.findings li {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    ul.findings li:last-child {
      border-bottom: none;
    }
    ul.findings li::before {
      content: "✓ ";
      color: #4CAF50;
      font-weight: bold;
      margin-right: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 사용자 피드백 기반 OCR 파이프라인 종합 검증 보고서</h1>
      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">실행 시간</div>
          <div class="meta-value">${new Date().toLocaleString('ko-KR')}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">완료된 Phase</div>
          <div class="meta-value">${successCount}/${results.length}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">총 소요 시간</div>
          <div class="meta-value">${Math.round(totalTime / 60)}분</div>
        </div>
      </div>
    </div>

    <h2>📋 실행 단계</h2>`;

  // Phase별 결과
  for (const result of results) {
    const badgeClass = result.success ? 'badge-success' : 'badge-error';
    const badgeText = result.success ? '✓ 성공' : '✗ 실패';
    const cardClass = result.success ? 'success' : 'failed';

    html += `
    <div class="phase-card ${cardClass}">
      <h3>
        ${result.name}
        <span class="badge ${badgeClass}">${badgeText}</span>
        <span class="badge badge-info">${result.elapsed}초</span>
      </h3>`;

    if (!result.success && result.error) {
      html += `<p style="color: #f44336;"><strong>오류:</strong> ${result.error}</p>`;
    }

    html += `
    </div>`;
  }

  // GT 매칭 분석 결과
  if (gtAnalysis && gtAnalysis.summary) {
    const summary = gtAnalysis.summary;
    html += `
    <h2>📊 GT 날짜 매칭율 분석</h2>

    <div class="key-finding">
      <h3>핵심 발견사항</h3>
      <ul class="findings">
        <li><strong>평균 GT 매칭율:</strong> ${summary.avgCoverage}% (목표: 100%)</li>
        <li><strong>100% 달성 케이스:</strong> ${summary.achieved100Count}/${summary.totalCases} 케이스</li>
        <li><strong>총 GT 날짜:</strong> ${gtAnalysis.results.reduce((sum, r) => sum + (r.gtDates?.length || 0), 0)}개</li>
        <li><strong>총 누락:</strong> ${gtAnalysis.results.reduce((sum, r) => sum + (r.combinedMatching?.missedCount || 0), 0)}개</li>
      </ul>
    </div>`;

    if (summary.achieved100Count === summary.totalCases) {
      html += `
    <div class="success-box">
      <h3>🎉 축하합니다!</h3>
      <p><strong>모든 케이스에서 GT 날짜 매칭율 100%를 달성했습니다!</strong></p>
    </div>`;
    } else {
      html += `
    <div class="highlight">
      <h3>⚠️  개선 필요</h3>
      <p>아직 ${summary.totalCases - summary.achieved100Count}개 케이스에서 GT 날짜 누락이 발생하고 있습니다.</p>
      <p>누락된 날짜 패턴을 분석하여 추출 로직을 개선해야 합니다.</p>
    </div>`;
    }

    // 케이스별 상세
    html += `
    <h3>케이스별 GT 매칭율</h3>
    <table>
      <thead>
        <tr>
          <th>케이스</th>
          <th>좌표 기반</th>
          <th>Cycle 4 (Vision LLM)</th>
          <th>통합 (좌표 + Cycle 4)</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>`;

    for (const caseResult of gtAnalysis.results) {
      const coordRate = caseResult.coordMatching ? caseResult.coordMatching.gtCoverageRate : '-';
      const cycle4Rate = caseResult.cycle4Matching ? caseResult.cycle4Matching.gtCoverageRate : '-';
      const combinedRate = caseResult.combinedMatching ? caseResult.combinedMatching.gtCoverageRate : '-';
      const status = caseResult.achieved100 ? '<span class="badge badge-success">✓ 100%</span>' : `<span class="badge badge-error">누락 ${caseResult.combinedMatching?.missedCount || 0}</span>`;

      html += `
        <tr>
          <td><strong>${caseResult.caseId}</strong></td>
          <td>${coordRate}%</td>
          <td>${cycle4Rate}%</td>
          <td><strong>${combinedRate}%</strong></td>
          <td>${status}</td>
        </tr>`;
    }

    html += `
      </tbody>
    </table>`;
  }

  // 연관성 순위 결과
  if (ranking && ranking.summary) {
    html += `
    <h2>🎯 연관성 기반 우선순위 정렬</h2>

    <div class="key-finding">
      <h3>등고선 레벨링 적용</h3>
      <ul class="findings">
        <li><strong>L1 - GT 필수 (100-200점):</strong> GT에 포함된 날짜 + 높은 연관성</li>
        <li><strong>L2 - 매우 높음 (60-99점):</strong> GT는 아니지만 매우 높은 연관성</li>
        <li><strong>L3 - 높음 (40-59점):</strong> 높은 연관성 (의료/보험 키워드 주변)</li>
        <li><strong>L4 - 보통 (20-39점):</strong> 보통 연관성</li>
        <li><strong>L5 - 낮음 (0-19점):</strong> 낮은 연관성</li>
      </ul>
    </div>

    <p><strong>점수 구성:</strong></p>
    <ul>
      <li><strong>GT 매칭:</strong> 100점 (GT에 포함된 날짜)</li>
      <li><strong>중요도:</strong> critical(50) / high(30) / medium(10) / low(5)</li>
      <li><strong>컨텍스트:</strong> 최대 50점 (의료/보험 키워드, 테이블 위치)</li>
      <li><strong>신뢰도:</strong> 최대 10점 (OCR 신뢰도)</li>
    </ul>`;
  }

  html += `
    <h2>📝 결론 및 다음 단계</h2>

    <div class="key-finding">
      <h3>핵심 성과</h3>
      <ul class="findings">
        <li><strong>좌표 정보 활용:</strong> Google OCR bbox 좌표를 컨텍스트 보조 정보로 활용</li>
        <li><strong>전체집합 접근:</strong> GT(부분집합)를 100% 포함하는 전체집합 날짜 추출</li>
        <li><strong>연관성 우선:</strong> 노이즈 삭제 대신 연관성 높은 데이터 우선 제공</li>
      </ul>
    </div>

    <div class="highlight">
      <h3>다음 단계</h3>
      <p>`;

  if (gtAnalysis && gtAnalysis.summary.achieved100Count === gtAnalysis.summary.totalCases) {
    html += `<strong>✅ GT 매칭율 100% 달성!</strong><br>`;
    html += `이제 실제 파이프라인에 통합하고 프로덕션 배포를 준비하세요.`;
  } else {
    html += `<strong>⚠️  GT 매칭율 개선 필요</strong><br>`;
    html += `1. 누락된 날짜 패턴 분석 (형식, 문맥, 좌표)<br>`;
    html += `2. 추출 로직 강화 (정규식, 키워드 범위 확대)<br>`;
    html += `3. 재검증 및 100% 달성까지 반복`;
  }

  html += `
      </p>
    </div>

    <hr style="margin: 40px 0; border: none; border-top: 2px solid #ddd;">

    <p style="text-align: center; color: #999; font-size: 14px;">
      보고서 생성: ${new Date().toLocaleString('ko-KR')}<br>
      VNEXSUS Medical OCR Pipeline - User Feedback Validation
    </p>
  </div>
</body>
</html>`;

  return html;
}

// 메인 실행
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  사용자 피드백 기반 OCR 파이프라인 종합 검증 시작           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  initDirectories();

  const results = [];

  // 각 Phase 순차 실행
  for (const phase of CONFIG.scripts) {
    if (phase.optional) {
      console.log(`\n⚠️  ${phase.name}은 선택적 단계입니다. 건너뛸 수 있습니다.`);
    }

    const result = runScript(phase.script, phase.name);
    results.push(result);

    if (!result.success && !phase.optional) {
      console.error(`\n❌ 필수 단계 실패. 검증을 중단합니다.`);
      break;
    }
  }

  // 최종 보고서 생성
  const { htmlPath, jsonPath } = generateFinalReport(results);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`✅ 종합 검증 완료!`);
  console.log(`${'='.repeat(70)}`);
  console.log(`\n📊 최종 보고서:`);
  console.log(`   HTML: ${htmlPath}`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`\n👉 브라우저에서 HTML 보고서를 확인하세요.\n`);
}

main().catch(error => {
  console.error('\n❌ 검증 실패:', error);
  process.exit(1);
});
