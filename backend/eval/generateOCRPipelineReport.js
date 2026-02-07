/**
 * OCR Pipeline Validation Report Generator
 *
 * Cycle 4 (Top-Down) 및 Cycle 5 (Post-Processing) 결과를 통합하여
 * OCR_Pipeline_Validation_Report.html 생성
 *
 * 실행: node backend/eval/generateOCRPipelineReport.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { publishReport } from '../../utils/reportPublisher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const CONFIG = {
  cycle4ResultsPath: path.join(__dirname, 'output/cycle4_topdown/cycle4_topdown_results.json'),
  cycle5ResultsPath: path.join(__dirname, 'output/cycle5_postprocessing/cycle5_results.json'),
  outputFilename: 'OCR_Pipeline_Validation_Report.html'
};

// 결과 로드
function loadResults() {
  const cycle4 = JSON.parse(fs.readFileSync(CONFIG.cycle4ResultsPath, 'utf-8'));
  const cycle5 = JSON.parse(fs.readFileSync(CONFIG.cycle5ResultsPath, 'utf-8'));

  return { cycle4, cycle5 };
}

// HTML 보고서 생성
function generateHTML(cycle4, cycle5) {
  const validResults4 = cycle4.results.filter(r => r.matching);
  const validResults5 = cycle5.results.filter(r => r.matching);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VNEXSUS OCR 파이프라인 검증 보고서 (Case18 제외)</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .header .date {
            margin-top: 15px;
            opacity: 0.8;
            font-size: 0.9em;
        }

        .content {
            padding: 40px;
        }

        .summary-box {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 40px;
        }

        .summary-box h2 {
            margin-bottom: 20px;
            font-size: 1.8em;
        }

        .summary-box ul {
            list-style: none;
            padding: 0;
        }

        .summary-box li {
            margin: 12px 0;
            font-size: 1.1em;
            padding-left: 25px;
            position: relative;
        }

        .summary-box li:before {
            content: "✓";
            position: absolute;
            left: 0;
            font-weight: bold;
        }

        .section-title {
            font-size: 1.8em;
            color: #2d3748;
            margin: 40px 0 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }

        .comparison-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }

        .comparison-card {
            background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%);
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 25px;
            transition: all 0.3s ease;
        }

        .comparison-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .comparison-card h3 {
            font-size: 1.4em;
            color: #667eea;
            margin-bottom: 15px;
        }

        .comparison-card .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .comparison-card .metric:last-child {
            border-bottom: none;
        }

        .comparison-card .metric-label {
            font-weight: 600;
            color: #4a5568;
        }

        .comparison-card .metric-value {
            font-weight: 700;
            color: #2d3748;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }

        th, td {
            padding: 15px;
            text-align: left;
        }

        tbody tr {
            border-bottom: 1px solid #e2e8f0;
        }

        tbody tr:hover {
            background: #f7fafc;
        }

        .badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        }

        .badge-success {
            background: #c6f6d5;
            color: #22543d;
        }

        .badge-warning {
            background: #fef3c7;
            color: #92400e;
        }

        .badge-danger {
            background: #fed7d7;
            color: #742a2a;
        }

        .alert {
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }

        .alert-info {
            background: #bee3f8;
            border-left: 4px solid #3182ce;
            color: #1a365d;
        }

        .alert-warning {
            background: #fef3c7;
            border-left: 4px solid #d69e2e;
            color: #744210;
        }

        .improvement-indicator {
            font-size: 2em;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            margin: 20px 0;
            border-radius: 12px;
        }

        .improvement-positive {
            background: #c6f6d5;
            color: #22543d;
        }

        .improvement-negative {
            background: #fed7d7;
            color: #742a2a;
        }

        .improvement-neutral {
            background: #e2e8f0;
            color: #2d3748;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>VNEXSUS OCR 파이프라인 검증 보고서</h1>
            <p class="subtitle">Vision LLM → OCR 전환 대비 성능 검증 (Case18 제외)</p>
            <p class="date">생성일: ${new Date().toLocaleString('ko-KR')}</p>
        </div>

        <div class="content">
            <div class="summary-box">
                <h2>📊 Executive Summary</h2>
                <ul>
                    <li><strong>검증 케이스</strong>: 10개 케이스 (Case18 제외 - GT 불일치)</li>
                    <li><strong>Cycle 4 GT Coverage</strong>: ${cycle4.summary.overallGtCoverageRate}% (Matched: ${cycle4.summary.totalMatched}/${cycle4.summary.totalGtDates})</li>
                    <li><strong>Cycle 5 GT Coverage</strong>: ${cycle5.summary.overallGtCoverageRate}% (변화: ${cycle5.summary.overallGtCoverageRate - cycle4.summary.overallGtCoverageRate}%p)</li>
                    <li><strong>Cycle 4 Precision</strong>: ${Math.round((cycle4.summary.totalMatched / cycle4.summary.totalAiDates) * 100)}%</li>
                    <li><strong>Cycle 5 Precision</strong>: ${Math.round((cycle5.summary.totalMatched / cycle5.summary.totalAiDates) * 100)}%</li>
                    <li><strong>핵심 발견</strong>: Cycle 4 과추출 전략이 효과적, Cycle 5 7-Phase 필터링은 개선 효과 미미</li>
                </ul>
            </div>

            <div class="alert alert-warning">
                <h3 style="margin-bottom: 10px;">⚠️ Case18 제외 사유</h3>
                <p>Case18(김명희)은 GT 문서와 PDF 간 일치율이 검증되지 않아 데이터 신뢰성 부족으로 제외되었습니다.
                검증 가능한 케이스는 총 <strong>10개</strong>입니다.</p>
            </div>

            <h2 class="section-title">1. Cycle 4 (Top-Down) vs Cycle 5 (Post-Processing) 비교</h2>

            <div class="comparison-grid">
                <div class="comparison-card">
                    <h3>Cycle 4: Top-Down 과추출</h3>
                    <div class="metric">
                        <span class="metric-label">GT Coverage</span>
                        <span class="metric-value">${cycle4.summary.overallGtCoverageRate}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Precision</span>
                        <span class="metric-value">${Math.round((cycle4.summary.totalMatched / cycle4.summary.totalAiDates) * 100)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">AI Extracted</span>
                        <span class="metric-value">${cycle4.summary.totalAiDates} dates</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Matched/GT</span>
                        <span class="metric-value">${cycle4.summary.totalMatched}/${cycle4.summary.totalGtDates}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Extra (Noise)</span>
                        <span class="metric-value">${cycle4.summary.totalExtra}</span>
                    </div>
                </div>

                <div class="comparison-card">
                    <h3>Cycle 5: 7-Phase 후처리</h3>
                    <div class="metric">
                        <span class="metric-label">GT Coverage</span>
                        <span class="metric-value">${cycle5.summary.overallGtCoverageRate}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Precision</span>
                        <span class="metric-value">${Math.round((cycle5.summary.totalMatched / cycle5.summary.totalAiDates) * 100)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">AI Extracted</span>
                        <span class="metric-value">${cycle5.summary.totalAiDates} dates</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Matched/GT</span>
                        <span class="metric-value">${cycle5.summary.totalMatched}/${cycle5.summary.totalGtDates}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Extra (Noise)</span>
                        <span class="metric-value">${cycle5.summary.totalExtra}</span>
                    </div>
                </div>
            </div>

            <div class="improvement-indicator ${
              cycle5.summary.overallGtCoverageRate > cycle4.summary.overallGtCoverageRate
                ? 'improvement-positive'
                : cycle5.summary.overallGtCoverageRate < cycle4.summary.overallGtCoverageRate
                ? 'improvement-negative'
                : 'improvement-neutral'
            }">
                GT Coverage 변화: ${cycle5.summary.overallGtCoverageRate > cycle4.summary.overallGtCoverageRate ? '+' : ''}${cycle5.summary.overallGtCoverageRate - cycle4.summary.overallGtCoverageRate}%p
                <br>
                <span style="font-size: 0.5em; font-weight: normal;">
                    ${cycle4.summary.overallGtCoverageRate}% → ${cycle5.summary.overallGtCoverageRate}%
                </span>
            </div>

            <h2 class="section-title">2. 케이스별 상세 결과</h2>

            <table>
                <thead>
                    <tr>
                        <th>Case</th>
                        <th>환자명</th>
                        <th>페이지</th>
                        <th>Cycle 4 GT Coverage</th>
                        <th>Cycle 5 GT Coverage</th>
                        <th>GT/Matched</th>
                        <th>AI Extracted (C4/C5)</th>
                    </tr>
                </thead>
                <tbody>
                    ${validResults4.map((r4, idx) => {
                        const r5 = validResults5[idx];
                        const c4Coverage = r4.matching.gtCoverageRate;
                        const c5Coverage = r5 ? r5.matching.gtCoverageRate : 0;

                        return `
                        <tr>
                            <td><strong>${r4.caseId}</strong></td>
                            <td>${r4.patientName || '-'}</td>
                            <td>${r4.totalPages}p</td>
                            <td>
                                <span class="badge ${c4Coverage >= 70 ? 'badge-success' : c4Coverage >= 50 ? 'badge-warning' : 'badge-danger'}">
                                    ${c4Coverage}%
                                </span>
                            </td>
                            <td>
                                <span class="badge ${c5Coverage >= 70 ? 'badge-success' : c5Coverage >= 50 ? 'badge-warning' : 'badge-danger'}">
                                    ${c5Coverage}%
                                </span>
                            </td>
                            <td>${r4.matching.gtCount} / ${r4.matching.matchedCount}</td>
                            <td>${r4.matching.aiCount} / ${r5 ? r5.matching.aiCount : 0}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <h2 class="section-title">3. 핵심 발견사항</h2>

            <div class="alert alert-info">
                <h3 style="margin-bottom: 15px;">✅ Cycle 4 (Top-Down 과추출) 분석</h3>
                <ul style="margin-left: 20px;">
                    <li style="margin: 8px 0;"><strong>GT Coverage ${cycle4.summary.overallGtCoverageRate}%</strong> 달성 (10개 케이스 평균)</li>
                    <li style="margin: 8px 0;">과추출 전략으로 누락 최소화 (Missed: ${cycle4.summary.totalMissed})</li>
                    <li style="margin: 8px 0;">프롬프트 개선으로 importance 태깅 및 타임스탬프 제외 적용</li>
                    <li style="margin: 8px 0;">보험 가입일(importance=critical), 만기일(importance=low) 구분</li>
                </ul>
            </div>

            <div class="alert alert-info">
                <h3 style="margin-bottom: 15px;">⚠️ Cycle 5 (7-Phase 후처리) 평가</h3>
                <ul style="margin-left: 20px;">
                    <li style="margin: 8px 0;"><strong>GT Coverage ${cycle5.summary.overallGtCoverageRate - cycle4.summary.overallGtCoverageRate}%p 변화</strong> - 개선 효과 미미</li>
                    <li style="margin: 8px 0;">Precision ${Math.round((cycle5.summary.totalMatched / cycle5.summary.totalAiDates) * 100)}% (목표 70-80% 미달)</li>
                    <li style="margin: 8px 0;">7-Phase 필터링의 한계: Rule-based 접근으로는 컨텍스트 이해 부족</li>
                    <li style="margin: 8px 0;"><strong>결론: Cycle 5는 경량화하여 Cycle 4에 통합 필요</strong></li>
                </ul>
            </div>

            <h2 class="section-title">4. 권장사항 및 다음 단계</h2>

            <div style="background: #f7fafc; padding: 25px; border-radius: 12px; margin: 20px 0;">
                <h3 style="color: #2d3748; margin-bottom: 15px;">🎯 즉시 실행 권장사항</h3>
                <ol style="margin-left: 20px; color: #4a5568;">
                    <li style="margin: 10px 0;">
                        <strong>Cycle 4 프롬프트 지속 개선</strong>
                        <ul style="margin-left: 20px; margin-top: 5px;">
                            <li>컨텍스트 태깅 강화 (importance 필드 활용)</li>
                            <li>보험 만기일 하향 조정 (심사 무관)</li>
                            <li>타임스탬프 제외 (YYYY-MM-DD만 사용)</li>
                        </ul>
                    </li>
                    <li style="margin: 10px 0;">
                        <strong>Cycle 5 경량화 (7-Phase → 3-Phase)</strong>
                        <ul style="margin-left: 20px; margin-top: 5px;">
                            <li>Phase 1: 보험 만기일 제거</li>
                            <li>Phase 2: 타임스탬프 정규화</li>
                            <li>Phase 3: 중요도 기반 정렬</li>
                        </ul>
                    </li>
                    <li style="margin: 10px 0;">
                        <strong>컨텍스트 기반 후처리 설계</strong>
                        <ul style="margin-left: 20px; margin-top: 5px;">
                            <li>컨텍스트 우선, BBox는 보조 정보로 활용</li>
                            <li>키워드 + 문맥 분석 중심</li>
                        </ul>
                    </li>
                    <li style="margin: 10px 0;">
                        <strong>보고서 포맷 강제화</strong>
                        <ul style="margin-left: 20px; margin-top: 5px;">
                            <li>9-10항목 표준 포맷 적용</li>
                            <li>항목 구조 강제, 내용 어레인지는 유연하게</li>
                        </ul>
                    </li>
                </ol>
            </div>

            <div style="margin-top: 40px; padding: 20px; background: #edf2f7; border-radius: 12px; text-align: center;">
                <p style="color: #4a5568;">
                    <strong>VNEXSUS AI Claims System</strong> |
                    Cycle 4-5 검증 완료 |
                    ${new Date().toISOString()}
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// 메인 실행
async function main() {
  console.log('Generating OCR Pipeline Validation Report...\n');

  const { cycle4, cycle5 } = loadResults();

  console.log('Cycle 4 Summary:');
  console.log(`  GT Coverage: ${cycle4.summary.overallGtCoverageRate}%`);
  console.log(`  Cases: ${cycle4.summary.validCases}`);

  console.log('\nCycle 5 Summary:');
  console.log(`  GT Coverage: ${cycle5.summary.overallGtCoverageRate}%`);
  console.log(`  Cases: ${cycle5.summary.validCases}`);

  const html = generateHTML(cycle4, cycle5);

  // HTML 보고서를 GitHub 링크와 브라우저 프리뷰로 게시
  const reportInfo = await publishReport({
    htmlContent: html,
    filename: CONFIG.outputFilename,
    title: 'VNEXSUS OCR 파이프라인 검증 보고서',
    openBrowser: true
  });

  console.log('\n✅ Report published successfully!');
  console.log(`\n📊 Report Details:`);
  console.log(`   Local Preview: ${reportInfo.localPath}`);
  console.log(`   GitHub Raw URL: ${reportInfo.githubRawUrl}`);
  console.log(`   GitHub Repo URL: ${reportInfo.githubRepoUrl}`);
  console.log(`\n💡 The browser preview should open automatically.`);
  console.log(`💡 Commit and push to GitHub to make the raw URL accessible.`);
}

main().catch(console.error);
