import fs from 'fs';
import path from 'path';
import url from 'url';

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports', 'VNEXSUS_Report');

function pickLatestOutDir() {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const entries = fs.readdirSync(REPORTS_DIR, { withFileTypes: true }).filter(e => e.isDirectory());
  if (entries.length === 0) return null;
  const withTime = entries.map(e => {
    const full = path.join(REPORTS_DIR, e.name);
    const st = fs.statSync(full);
    return { name: e.name, full, mtime: st.mtimeMs };
  });
  withTime.sort((a, b) => b.mtime - a.mtime);
  return withTime[0].full;
}

function readJsonSafe(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

function bar(widthPct) {
  return `<div class="bar"><span style="width:${widthPct}"></span></div>`;
}

function formatNumber(v) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(3);
}

function buildValidationHTML(outDir, pair, subset) {
  const summary = pair?.summary || {};
  const rows = (pair?.rows || []).filter(r => r?.status !== 'SKIPPED');
  const passThreshold = (pair?.thresholds?.combinedPass ?? 0.6);
  const weightedRate = rows.length ? rows.filter(r => ((r?.combinedScore ?? 0) >= passThreshold)).length / rows.length : 0;
  const tableRows = rows.map(r => {
    const d = r?.matching?.dates?.matchRate ?? 0;
    const i = r?.matching?.icds?.matchRate ?? 0;
    const h = r?.matching?.hospitals?.matchRate ?? 0;
    const ls = r?.labelScore ?? 0;
    const j = r?.jaccard ?? 0;
    const c = r?.combinedScore ?? 0;
    const pass = (c >= passThreshold);
    return `<tr>
      <td>Case${r.caseIndex}</td>
      <td>${pass ? '<span class="ok">PASS</span>' : '<span class="bad">REVIEW</span>'}</td>
      <td>${bar(pct(d))}<div>${pct(d)}</div></td>
      <td>${bar(pct(i))}<div>${pct(i)}</div></td>
      <td>${bar(pct(h))}<div>${pct(h)}</div></td>
      <td>${bar(pct(ls))}<div>${pct(ls)}</div></td>
      <td>${bar(pct(j))}<div>${pct(j)}</div></td>
      <td>${bar(pct(c))}<div>${pct(c)}</div></td>
      <td class="muted">${path.basename(r.reportPath || '')}</td>
      <td class="muted">${path.basename(r.vnexsusPath || '')}</td>
    </tr>`;
  }).join('');

  const subsetSummary = subset?.summary || {};
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
  <title>VNEXSUS 검증보고서</title>
  <style>
  body{font-family:system-ui,Segoe UI,Arial;padding:20px;color:#222;background:#fafafa}
  code{background:#f2f2f2;padding:2px 4px;border-radius:4px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
  th{background:#f4f4f4}
  .kpi{display:flex;gap:12px;flex-wrap:wrap}
  .kpi>div{border:1px solid #eee;border-radius:10px;padding:10px 12px;background:#fff;min-width:220px}
  .ok{color:#0a7}
  .bad{color:#c33}
  .muted{color:#666}
  .card{border:1px solid #eee;border-radius:10px;padding:12px;background:#fff;margin-top:12px}
  .bar{height:8px;border-radius:6px;background:#eee;overflow:hidden}
  .bar>span{display:block;height:100%;background:#2563eb}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  </style></head><body>
  <h1>VNEXSUS 검증보고서</h1>
  <div class="kpi">
    <div><div class="muted">생성 시각</div><div>${new Date().toISOString()}</div></div>
    <div><div class="muted">출력 디렉토리</div><div><code>${outDir}</code></div></div>
    <div><div class="muted">검증 쌍 수</div><div>${summary.matched ?? 0}</div></div>
    <div><div class="muted">통과율</div><div>${pct(summary.passRate ?? 0)}</div></div>
    <div><div class="muted">통과율(가중)</div><div>${pct(weightedRate)}</div></div>
  </div>
  <div class="card">
    <div class="grid">
      <div class="card">
        <div class="muted">평균 날짜 매칭률</div>
        ${bar(pct(summary.avgDateMatchRate ?? 0))}
        <div>${pct(summary.avgDateMatchRate ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 ICD 매칭률</div>
        ${bar(pct(summary.avgIcdMatchRate ?? 0))}
        <div>${pct(summary.avgIcdMatchRate ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 병원 매칭률</div>
        ${bar(pct(summary.avgHospitalMatchRate ?? 0))}
        <div>${pct(summary.avgHospitalMatchRate ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 LabelScore</div>
        ${bar(pct(summary.avgLabelScore ?? 0))}
        <div>${pct(summary.avgLabelScore ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 Jaccard</div>
        ${bar(pct(summary.avgJaccard ?? 0))}
        <div>${pct(summary.avgJaccard ?? 0)}</div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="muted">베이스라인 46개 매칭</div>
    <div>매칭 수: ${subsetSummary.matched ?? 0} / ${subsetSummary.baselineReports ?? 0}</div>
    <div>통과율: ${pct(subsetSummary.passRate ?? 0)}</div>
    <div class="grid" style="margin-top:8px">
      <div class="card">
        <div class="muted">평균 날짜</div>
        ${bar(pct(subsetSummary.avgDateMatchRate ?? 0))}
        <div>${pct(subsetSummary.avgDateMatchRate ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 ICD</div>
        ${bar(pct(subsetSummary.avgIcdMatchRate ?? 0))}
        <div>${pct(subsetSummary.avgIcdMatchRate ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 병원</div>
        ${bar(pct(subsetSummary.avgHospitalMatchRate ?? 0))}
        <div>${pct(subsetSummary.avgHospitalMatchRate ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 LabelScore</div>
        ${bar(pct(subsetSummary.avgLabelScore ?? 0))}
        <div>${pct(subsetSummary.avgLabelScore ?? 0)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 Jaccard</div>
        ${bar(pct(subsetSummary.avgJaccard ?? 0))}
        <div>${pct(subsetSummary.avgJaccard ?? 0)}</div>
      </div>
    </div>
  </div>
  <h2>케이스별 상세</h2>
  <table>
    <thead><tr>
      <th>Case</th><th>상태</th><th>날짜</th><th>ICD</th><th>병원</th><th>Label</th><th>Jaccard</th><th>Combined</th><th>Report</th><th>VNEXSUS</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  </body></html>`;
  fs.writeFileSync(path.join(outDir, 'validation_report.html'), html, 'utf-8');
}

function aggregateMissing(rows) {
  const missDate = new Map();
  const missICD = new Map();
  const missHosp = new Map();
  for (const r of rows) {
    const d = r?.matching?.dates?.missing || [];
    const i = r?.matching?.icds?.missing || [];
    const h = r?.matching?.hospitals?.missing || [];
    for (const v of d) missDate.set(v, (missDate.get(v) || 0) + 1);
    for (const v of i) missICD.set(v, (missICD.get(v) || 0) + 1);
    for (const v of h) missHosp.set(v, (missHosp.get(v) || 0) + 1);
  }
  const topN = (m) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { topDate: topN(missDate), topICD: topN(missICD), topHosp: topN(missHosp) };
}

function buildPromptImprovementHTML(outDir, pair, subset) {
  const rows = (pair?.rows || []).filter(r => r?.status !== 'SKIPPED');
  const agg = aggregateMissing(rows);
  const list = (arr) => arr.map(([k, c]) => `<tr><td>${k}</td><td>${c}</td></tr>`).join('');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
  <title>후처리·LLM 프롬프트 개선안</title>
  <style>
  body{font-family:system-ui,Segoe UI,Arial;padding:20px;color:#222;background:#fafafa}
  code{background:#f2f2f2;padding:2px 4px;border-radius:4px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
  th{background:#f4f4f4}
  .kpi{display:flex;gap:12px;flex-wrap:wrap}
  .kpi>div{border:1px solid #eee;border-radius:10px;padding:10px 12px;background:#fff;min-width:220px}
  .ok{color:#0a7}
  .bad{color:#c33}
  .muted{color:#666}
  .card{border:1px solid #eee;border-radius:10px;padding:12px;background:#fff;margin-top:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  </style></head><body>
  <h1>후처리·LLM 프롬프트 개선안</h1>
  <div class="kpi">
    <div><div class="muted">생성 시각</div><div>${new Date().toISOString()}</div></div>
    <div><div class="muted">출력 디렉토리</div><div><code>${outDir}</code></div></div>
  </div>
  <div class="card">
    <div class="muted">누락 Top 10</div>
    <div class="grid">
      <div class="card">
        <div class="muted">날짜</div>
        <table><thead><tr><th>항목</th><th>빈도</th></tr></thead><tbody>${list(agg.topDate)}</tbody></table>
      </div>
      <div class="card">
        <div class="muted">ICD/KCD</div>
        <table><thead><tr><th>항목</th><th>빈도</th></tr></thead><tbody>${list(agg.topICD)}</tbody></table>
      </div>
      <div class="card">
        <div class="muted">병원</div>
        <table><thead><tr><th>항목</th><th>빈도</th></tr></thead><tbody>${list(agg.topHosp)}</tbody></table>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="muted">개선 제안</div>
    <ul>
      <li>날짜 정규화: YYYY-MM-DD→YYYY.MM.DD 표준화와 한국어 형식 변환 강화</li>
      <li>ICD/KCD 중복 억제: Prefix 매칭 반영 및 중복 필터링</li>
      <li>병원명 정규화: 공백·특수문자 제거 및 사전 기반 표준화</li>
      <li>타임라인 강화: 이벤트 단위 병합과 날짜별 경과표 일관성 보장</li>
      <li>프롬프트 조정: 불필요 법령문구 제거, 핵심 항목 9~10개 강제 출력</li>
      <li>검사결과 포함 규칙: 질환별 검사 블록 최소 항목 강제</li>
      <li>좌표기반 근거 연결: bbox 기반 앵커 매칭 가중치 반영</li>
    </ul>
  </div>
  </body></html>`;
  fs.writeFileSync(path.join(outDir, 'prompt_improvement_report.html'), html, 'utf-8');
}

function main() {
  const argOut = process.argv.find(a => a.startsWith('--outDir='))?.slice('--outDir='.length);
  const OUT_DIR = argOut ? (path.isAbsolute(argOut) ? argOut : path.join(ROOT, argOut)) : pickLatestOutDir();
  if (!OUT_DIR) {
    console.error('출력 디렉토리를 찾을 수 없습니다.');
    process.exit(1);
  }
  const pairPath = path.join(OUT_DIR, 'pair_validations.json');
  const subsetPath = path.join(OUT_DIR, 'subset_matches.json');
  const pair = readJsonSafe(pairPath);
  const subset = readJsonSafe(subsetPath);
  if (!pair || !subset) {
    console.error('검증 JSON 파일이 없습니다.');
    process.exit(1);
  }
  buildValidationHTML(OUT_DIR, pair, subset);
  buildPromptImprovementHTML(OUT_DIR, pair, subset);
  console.log('HTML 보고서 생성 완료');
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}
