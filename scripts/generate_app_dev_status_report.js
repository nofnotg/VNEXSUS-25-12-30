// Generate single-file App Development Status HTML report from markdown sources
// Node 18+ ESM
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const reportsDir = path.resolve(root, 'reports');

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

function parseIntSafe(s) {
  const m = String(s).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function parsePhaseTable(md) {
  const lines = md.split('\n');
  const rows = [];
  for (const line of lines) {
    if (line.startsWith('|')) rows.push(line);
  }
  const modules = [];
  for (const row of rows) {
    const cells = row.split('|').map(v => v.trim());
    // Expect: | **Phase 1** | 3개 | 3개 | 0개 | 0개 | **100%** |
    const nameCell = cells[1] || '';
    if (!nameCell.includes('Phase') && !nameCell.includes('모니터링')) continue;
    const moduleName = nameCell.replace(/\*\*/g, '');
    const planned = parseIntSafe(cells[2]);
    const completed = parseIntSafe(cells[3]);
    const inProgress = parseIntSafe(cells[4]);
    const waiting = parseIntSafe(cells[5]);
    const progressPercent = parseIntSafe((cells[6] || '').replace(/\*\*/g, ''));
    // status: completed/in_progress/on_hold/delayed
    let status = 'in_progress';
    if (completed >= planned && planned > 0) status = 'completed';
    else if (waiting > 0 && inProgress === 0) status = 'on_hold';
    else if (progressPercent < 50) status = 'delayed';

    modules.push({
      name: moduleName,
      planned,
      completed,
      inProgress,
      waiting,
      progressPercent,
      status,
    });
  }
  return modules;
}

function parseIssues(projectMd, comprehensiveMd) {
  const issues = [];
  // From PROJECT_PROGRESS_REPORT.md (pending task)
  if (projectMd.includes('Vite 클라이언트')) {
    issues.push({
      title: '프론트엔드 서버 Vite 클라이언트 404 오류',
      priority: '중',
      severity: 'yellow',
      status: '대기',
      source: 'PROJECT_PROGRESS_REPORT.md',
    });
  }
  // From COMPREHENSIVE_DEVELOPMENT_PROGRESS_REPORT.md
  if (comprehensiveMd.includes('NaN 이슈')) {
    issues.push({
      title: 'progressReport NaN 이슈',
      priority: '상',
      severity: 'red',
      status: '미해결',
      source: 'COMPREHENSIVE_DEVELOPMENT_PROGRESS_REPORT.md',
    });
  }
  if (comprehensiveMd.includes('o1-mini 시스템 메시지 오류')) {
    issues.push({
      title: 'o1-mini 시스템 메시지 오류',
      priority: '상',
      severity: 'red',
      status: '미해결',
      source: 'COMPREHENSIVE_DEVELOPMENT_PROGRESS_REPORT.md',
    });
  }
  if (comprehensiveMd.includes('Case4 리포트 파일 누락')) {
    issues.push({
      title: 'Case4 리포트 파일 누락',
      priority: '중',
      severity: 'yellow',
      status: '미해결',
      source: 'COMPREHENSIVE_DEVELOPMENT_PROGRESS_REPORT.md',
    });
  }
  if (comprehensiveMd.includes('결과 형식 표준화')) {
    issues.push({
      title: '결과 형식 표준화 미완료',
      priority: '중',
      severity: 'yellow',
      status: '진행 중',
      source: 'COMPREHENSIVE_DEVELOPMENT_PROGRESS_REPORT.md',
    });
  }
  return issues;
}

function parseVerificationSummary(comprehensiveMd) {
  const summary = {
    overallVerificationRate: null,
    aiAccuracy: null,
    hybridAccuracy: null,
    basicAccuracy: null,
    logicScore: null,
  };
  const ovMatch = comprehensiveMd.match(/전체 검증율\: ([0-9.]+)%/);
  if (ovMatch) summary.overallVerificationRate = Number(ovMatch[1]);
  const aiMatch = comprehensiveMd.match(/AI 검증 \(GPT-4o-mini\)\: ([0-9.]+)%/);
  if (aiMatch) summary.aiAccuracy = Number(aiMatch[1]);
  const hybrMatch = comprehensiveMd.match(/하이브리드 후처리\: ([0-9.]+)%/);
  if (hybrMatch) summary.hybridAccuracy = Number(hybrMatch[1]);
  const basicMatch = comprehensiveMd.match(/기본 후처리\: ([0-9.]+)%/);
  if (basicMatch) summary.basicAccuracy = Number(basicMatch[1]);
  const logicMatch = comprehensiveMd.match(/로직 처리\: ([0-9.]+)%/);
  if (logicMatch) summary.logicScore = Number(logicMatch[1]);
  return summary;
}

async function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function colorForStatus(status) {
  switch (status) {
    case 'completed':
      return '#27ae60'; // green
    case 'in_progress':
      return '#f1c40f'; // yellow
    case 'on_hold':
      return '#f39c12'; // amber
    case 'delayed':
      return '#e74c3c'; // red
    default:
      return '#7f8c8d';
  }
}

async function main() {
  const projectMd = readFileSafe(path.resolve(root, 'PROJECT_PROGRESS_REPORT.md'));
  const comprehensiveMd = readFileSafe(path.resolve(root, 'COMPREHENSIVE_DEVELOPMENT_PROGRESS_REPORT.md'));
  const roadmapMd = readFileSafe(path.resolve(root, 'DEVELOPMENT_TASKS_ROADMAP.md'));
  const checklistMd = readFileSafe(path.resolve(root, 'CHECKLIST_INSPECTION_REPORT.md'));

  const modules = parsePhaseTable(projectMd);
  const issues = parseIssues(projectMd, comprehensiveMd);
  const verification = parseVerificationSummary(comprehensiveMd);

  // Overview data
  const overallCompletionRow = modules.find(m => m.name.includes('전체'));
  const overallCompletion = overallCompletionRow ? overallCompletionRow.progressPercent : null;

  // Fetch Chart.js and inline it
  let chartJs;
  try {
    chartJs = await fetchText('https://cdn.jsdelivr.net/npm/chart.js');
  } catch (e) {
    chartJs = `console.warn('Chart.js load failed; charts disabled.', ${JSON.stringify(String(e.message))});`;
  }

  ensureDir(reportsDir);
  const outPath = path.resolve(reportsDir, 'app_development_status_report.html');

  const nowStr = new Date().toLocaleString('ko-KR', { hour12: false });

  const moduleRowsHtml = modules.map(m => {
    const statusLabel = m.status === 'completed' ? '완료' : m.status === 'in_progress' ? '진행 중' : m.status === 'on_hold' ? '보류' : '지연';
    const statusColor = colorForStatus(m.status);
    return `
      <tr>
        <td role="cell">${m.name}</td>
        <td role="cell" class="num">${m.planned}</td>
        <td role="cell" class="num">${m.completed}</td>
        <td role="cell" class="num">${m.inProgress}</td>
        <td role="cell" class="num">${m.waiting}</td>
        <td role="cell">
          <div class="progress" aria-label="진행률 ${m.progressPercent}%">
            <div class="progress-fill" style="width:${m.progressPercent}%; background:${statusColor}"></div>
          </div>
          <span class="progress-text">${m.progressPercent}%</span>
        </td>
        <td role="cell"><span class="status-pill" style="background:${statusColor}">${statusLabel}</span></td>
      </tr>`;
  }).join('\n');

  const issueRowsHtml = issues.map(i => {
    const color = i.severity === 'red' ? '#e74c3c' : i.severity === 'yellow' ? '#f1c40f' : '#27ae60';
    return `
      <tr>
        <td role="cell">${i.title}</td>
        <td role="cell">${i.priority}</td>
        <td role="cell"><span class="status-pill" style="background:${color}">${i.status}</span></td>
        <td role="cell">${i.source}</td>
      </tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>앱 개발 상태 종합 리포트</title>
  <style>
    :root {
      --green: #27ae60; --yellow: #f1c40f; --red: #e74c3c; --blue: #3498db;
      --bg: #f8f9fa; --text: #2c3e50; --card: #ffffff; --muted: #7f8c8d;
    }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; background: var(--bg); color: var(--text); }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border-radius: 12px; padding: 24px; }
    .header h1 { margin: 0 0 8px 0; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.9rem; opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 16px; }
    .card { background: var(--card); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); padding: 16px; }
    .card h2 { margin: 0 0 12px 0; font-size: 1.2rem; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f0f3f8; }
    .num { text-align: right; }
    .status-pill { display: inline-block; color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 0.85rem; }
    .progress { position: relative; height: 10px; background: #e9ecef; border-radius: 6px; overflow: hidden; }
    .progress-fill { height: 100%; transition: width .4s ease; }
    .progress-text { margin-left: 8px; font-size: 0.9rem; color: var(--muted); }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .footer { color: var(--muted); font-size: 0.85rem; margin-top: 16px; }
    @media (prefers-color-scheme: dark) {
      body { background: #121212; color: #eaeaea; }
      .card { background: #1e1e1e; }
      th { background: #242424; }
      .header { box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
    }
  </style>
  <!-- Inline Chart.js for single-file distribution -->
  <script>/* Chart.js inline */\n${chartJs.replace(/<\/(script)>/gi, '<\\/$1>')}</script>
</head>
<body>
  <main class="container" aria-label="앱 개발 상태 종합 리포트">
    <section class="header" role="region" aria-label="요약">
      <h1>앱 개발 상태 종합 리포트</h1>
      <div class="meta" aria-label="메타 정보">
        <span>생성 시각: ${nowStr}</span>
        ${overallCompletion != null ? `<span>전체 완료율: ${overallCompletion}%</span>` : ''}
        ${verification.overallVerificationRate != null ? `<span>전체 검증율: ${verification.overallVerificationRate}%</span>` : ''}
      </div>
    </section>

    <section class="grid" role="region" aria-label="대시보드">
      <div class="card" role="article" aria-label="모듈별 진행 현황">
        <h2>모듈별 진행 현황</h2>
        <div class="table-wrapper" role="group" aria-label="진행 현황 테이블">
          <table role="table" aria-label="모듈별 진행률 데이터">
            <thead role="rowgroup"><tr role="row">
              <th role="columnheader" scope="col">모듈</th>
              <th role="columnheader" scope="col">계획</th>
              <th role="columnheader" scope="col">완료</th>
              <th role="columnheader" scope="col">진행</th>
              <th role="columnheader" scope="col">대기</th>
              <th role="columnheader" scope="col">진행률</th>
              <th role="columnheader" scope="col">상태</th>
            </tr></thead>
            <tbody role="rowgroup">
              ${moduleRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" role="article" aria-label="이슈 및 장애">
        <h2>이슈 및 장애</h2>
        <div class="table-wrapper">
          <table role="table" aria-label="이슈 목록">
            <thead role="rowgroup"><tr role="row">
              <th role="columnheader" scope="col">이슈</th>
              <th role="columnheader" scope="col">우선순위</th>
              <th role="columnheader" scope="col">상태</th>
              <th role="columnheader" scope="col">출처</th>
            </tr></thead>
            <tbody role="rowgroup">
              ${issueRowsHtml || '<tr><td role="cell" colspan="4">등록된 이슈가 없습니다</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" role="article" aria-label="차트">
        <h2>진행률 시각화</h2>
        <div class="charts" role="group" aria-label="차트 그룹">
          <canvas id="chartModules" aria-label="모듈 진행률 바 차트" role="img"></canvas>
          <canvas id="chartStatus" aria-label="상태 분포 도넛 차트" role="img"></canvas>
        </div>
      </div>

      <div class="card" role="article" aria-label="테스트/검증 요약">
        <h2>테스트/검증 요약</h2>
        <ul>
          ${verification.overallVerificationRate != null ? `<li>전체 검증율: <strong>${verification.overallVerificationRate}%</strong></li>` : ''}
          ${verification.aiAccuracy != null ? `<li>AI 검증(GPT-4o-mini) 정확도: <strong>${verification.aiAccuracy}%</strong></li>` : ''}
          ${verification.hybridAccuracy != null ? `<li>하이브리드 후처리 정확도: <strong>${verification.hybridAccuracy}%</strong></li>` : ''}
          ${verification.basicAccuracy != null ? `<li>기본 후처리 정확도: <strong>${verification.basicAccuracy}%</strong></li>` : ''}
          ${verification.logicScore != null ? `<li>로직 처리 정확도: <strong>${verification.logicScore}%</strong></li>` : ''}
        </ul>
      </div>
    </section>

    <section class="footer" role="contentinfo" aria-label="출처 및 업데이트 정보">
      <p>데이터 출처: PROJECT_PROGRESS_REPORT.md, COMPREHENSIVE_DEVELOPMENT_PROGRESS_REPORT.md, DEVELOPMENT_TASKS_ROADMAP.md, CHECKLIST_INSPECTION_REPORT.md</p>
      <p>주의: 일부 데이터는 문서 최신 갱신 시점에 따라 변동 가능. 최신 상태 확인 필요.</p>
    </section>
  </main>

  <script>
    (function(){
      const modules = ${JSON.stringify(modules)};
      const labels = modules.map(m => m.name);
      const progress = modules.map(m => m.progressPercent);
      const ctx1 = document.getElementById('chartModules');
      if (window.Chart && ctx1) {
        new Chart(ctx1, {
          type: 'bar',
          data: { labels, datasets: [{ label: '진행률(%)', data: progress, backgroundColor: labels.map((_, i) => '#3498db') }] },
          options: { responsive: true, plugins: { legend: { display: false }, tooltip: { enabled: true } }, scales: { y: { beginAtZero: true, max: 100 } } }
        });
      }
      const statusCounts = modules.reduce((acc, m) => { acc[m.status] = (acc[m.status]||0)+1; return acc; }, {});
      const statusLabels = Object.keys(statusCounts);
      const statusColors = statusLabels.map(s => ({completed:'#27ae60',in_progress:'#f1c40f',on_hold:'#f39c12',delayed:'#e74c3c'}[s]||'#7f8c8d'));
      const ctx2 = document.getElementById('chartStatus');
      if (window.Chart && ctx2) {
        new Chart(ctx2, {
          type: 'doughnut',
          data: { labels: statusLabels.map(l => ({completed:'완료',in_progress:'진행 중',on_hold:'보류',delayed:'지연'}[l]||l)), datasets: [{ data: statusLabels.map(l => statusCounts[l]), backgroundColor: statusColors }] },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
      }
    })();
  </script>
</body>
</html>`;

  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`Report generated: ${outPath}`);
}

main().catch(err => {
  console.error('Failed to generate report:', err);
  process.exitCode = 1;
});

