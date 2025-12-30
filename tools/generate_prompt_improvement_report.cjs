const fs = require('fs');
const path = require('path');

function arg(k, d) {
  const a = process.argv.find(v => v.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=') : d;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readPromptFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      const sub = readPromptFiles(path.join(dir, e.name));
      for (const s of sub) files.push(s);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (ext === '.txt') {
        const full = path.join(dir, e.name);
        let text = '';
        try { text = fs.readFileSync(full, 'utf-8'); } catch { text = ''; }
        files.push({ name: e.name, path: full, text });
      }
    }
  }
  return files;
}

function scoreStructure(t) {
  const lines = t.split(/\r?\n/).filter(Boolean);
  const numbered = lines.filter(l => /^\s*(\d+)[\).]/.test(l)).length;
  const sections = (t.match(/\n\s*[-*]\s/g) || []).length;
  const total = Math.max(1, lines.length);
  const s = Math.min(1, (numbered + sections) / Math.min(total, 40));
  return s;
}

function scoreCorrelation(t) {
  const keys = ['상관','연관','타임라인','연대기','경과','경로','추적','의무','고지','사건','이벤트','진단','검사','병원','날짜','시점'];
  let hit = 0;
  for (const k of keys) if (t.includes(k)) hit += 1;
  return Math.min(1, hit / keys.length);
}

function scoreDateRules(t) {
  const keys = ['가입일','3개월','2년','5년','유예','기간','윈도우'];
  let hit = 0;
  for (const k of keys) if (t.includes(k)) hit += 1;
  return Math.min(1, hit / keys.length);
}

function scoreDuplicateSuppression(t) {
  const keys = ['중복','제거','억제','한번만','중복 방지','중복 경고 금지'];
  let hit = 0;
  for (const k of keys) if (t.includes(k)) hit += 1;
  return Math.min(1, hit / keys.length);
}

function scoreFormatting(t) {
  const keys = ['YYYY.MM.DD','표','항목','리스트','구분','소제목','번호'];
  let hit = 0;
  for (const k of keys) if (t.includes(k)) hit += 1;
  return Math.min(1, hit / keys.length);
}

function recommendations(r) {
  const out = [];
  if (r.structure < 0.6) out.push('항목 번호/리스트로 9~10개 구조를 고정');
  if (r.dateRules < 0.6) out.push('가입일 기준 3/2/5년 윈도우 명시');
  if (r.correlation < 0.6) out.push('의료 이벤트-날짜-병원 타임라인 연계 강화');
  if (r.dupSuppress < 0.6) out.push('중복 경고/중복 항목 출력 억제 규칙 추가');
  if (r.formatting < 0.6) out.push('YYYY.MM.DD 날짜 표준과 표/소제목 포맷 추가');
  return out;
}

function pct(n) { return `${Math.round(Math.max(0,Math.min(1,n))*100)}%`; }
function bar(p) { const v = Math.max(0, Math.min(100, Number(String(p).replace('%','')))); return `<div class="bar"><span style="width:${v}%"></span></div>`; }

function buildHTML(outDir, rows, summary) {
  const tableRows = rows.map(r => {
    const rec = r.recommendations.map(x => `<li>${x}</li>`).join('');
    return `<tr>
      <td>${r.name}</td>
      <td>${bar(pct(r.structure))}<div>${pct(r.structure)}</div></td>
      <td>${bar(pct(r.correlation))}<div>${pct(r.correlation)}</div></td>
      <td>${bar(pct(r.dateRules))}<div>${pct(r.dateRules)}</div></td>
      <td>${bar(pct(r.dupSuppress))}<div>${pct(r.dupSuppress)}</div></td>
      <td>${bar(pct(r.formatting))}<div>${pct(r.formatting)}</div></td>
      <td>${bar(pct(r.total))}<div>${pct(r.total)}</div></td>
      <td><ul>${rec}</ul></td>
    </tr>`;
  }).join('');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
  <title>VNEXSUS 프롬프트 개선 보고서</title>
  <style>
  body{font-family:system-ui,Segoe UI,Arial;padding:20px;color:#222;background:#fafafa}
  code{background:#f2f2f2;padding:2px 4px;border-radius:4px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
  th{background:#f4f4f4}
  .kpi{display:flex;gap:12px;flex-wrap:wrap}
  .kpi>div{border:1px solid #eee;border-radius:10px;padding:10px 12px;background:#fff;min-width:220px}
  .muted{color:#666}
  .card{border:1px solid #eee;border-radius:10px;padding:12px;background:#fff;margin-top:12px}
  .bar{height:8px;border-radius:6px;background:#eee;overflow:hidden}
  .bar>span{display:block;height:100%;background:#9333ea}
  </style></head><body>
  <h1>VNEXSUS 프롬프트 개선 보고서</h1>
  <div class="kpi">
    <div><div class="muted">생성 시각</div><div>${new Date().toISOString()}</div></div>
    <div><div class="muted">검토 프롬프트 수</div><div>${summary.count}</div></div>
    <div><div class="muted">평균 구조 점수</div><div>${pct(summary.avgStructure)}</div></div>
    <div><div class="muted">평균 상관 점수</div><div>${pct(summary.avgCorrelation)}</div></div>
    <div><div class="muted">평균 날짜규칙</div><div>${pct(summary.avgDateRules)}</div></div>
    <div><div class="muted">평균 중복억제</div><div>${pct(summary.avgDupSuppress)}</div></div>
    <div><div class="muted">평균 포맷</div><div>${pct(summary.avgFormatting)}</div></div>
  </div>
  <div class="card">
    <h2>프롬프트별 상세</h2>
    <table>
      <thead><tr>
        <th>파일명</th><th>구조</th><th>상관</th><th>날짜규칙</th><th>중복억제</th><th>포맷</th><th>종합</th><th>권고</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>
  </body></html>`;
  return html;
}

function run() {
  const outDir = path.resolve(arg('outDir', path.join(process.cwd(), 'VNEXSUS_A-B-C_Execution_Plan')));
  const promptDir = path.resolve(arg('promptDir', path.join(process.cwd(), 'src', 'rag')));
  ensureDir(outDir);
  const files = readPromptFiles(promptDir);
  const rows = [];
  for (const f of files) {
    const t = f.text || '';
    const structure = scoreStructure(t);
    const correlation = scoreCorrelation(t);
    const dateRules = scoreDateRules(t);
    const dupSuppress = scoreDuplicateSuppression(t);
    const formatting = scoreFormatting(t);
    const total = (structure + correlation + dateRules + dupSuppress + formatting) / 5;
    rows.push({ name: f.name, path: f.path, structure, correlation, dateRules, dupSuppress, formatting, total, recommendations: recommendations({structure, correlation, dateRules, dupSuppress, formatting}) });
  }
  const summary = {
    count: rows.length,
    avgStructure: rows.length ? rows.reduce((s,r)=>s+r.structure,0)/rows.length : 0,
    avgCorrelation: rows.length ? rows.reduce((s,r)=>s+r.correlation,0)/rows.length : 0,
    avgDateRules: rows.length ? rows.reduce((s,r)=>s+r.dateRules,0)/rows.length : 0,
    avgDupSuppress: rows.length ? rows.reduce((s,r)=>s+r.dupSuppress,0)/rows.length : 0,
    avgFormatting: rows.length ? rows.reduce((s,r)=>s+r.formatting,0)/rows.length : 0
  };
  const html = buildHTML(outDir, rows, summary);
  fs.writeFileSync(path.join(outDir, 'prompt_improvement_report.html'), html, 'utf-8');
}

run();
