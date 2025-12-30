import fs from 'fs';
import path from 'path';
import url from 'url';
import ReportSubsetValidator from '../eval/report_subset_validator.js';

const ROOT = process.cwd();
const OFFLINE_BASE = path.join(ROOT, 'reports', 'offline_ocr_samples');
const CASE_SAMPLE_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');

function pickLatestDir() {
  if (!fs.existsSync(OFFLINE_BASE)) return null;
  const dirs = fs.readdirSync(OFFLINE_BASE, { withFileTypes: true }).filter(d => d.isDirectory());
  if (dirs.length === 0) return null;
  const dated = dirs.map(d => {
    const full = path.join(OFFLINE_BASE, d.name);
    const st = fs.statSync(full);
    return { name: d.name, full, mtime: st.mtimeMs };
  });
  dated.sort((a, b) => b.mtime - a.mtime);
  return dated[0].full;
}

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

function bar(w) {
  return `<div class="bar"><span style="width:${w}"></span></div>`;
}

async function main() {
  const base = pickLatestDir();
  if (!base) {
    console.error('no_offline_dir');
    process.exit(1);
  }
  const cases = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const validator = new ReportSubsetValidator();
  const rows = [];
  for (const name of cases) {
    const idm = name.match(/^Case(\d+)/i);
    const id = idm ? idm[1] : null;
    const txtPath = path.join(base, name, `${name}_merged.txt`);
    const reportPath = id ? path.join(CASE_SAMPLE_DIR, `Case${id}_report.txt`) : null;
    if (!fs.existsSync(txtPath) || !reportPath || !fs.existsSync(reportPath)) continue;
    const vnexsusText = fs.readFileSync(txtPath, 'utf-8');
    const reportText = fs.readFileSync(reportPath, 'utf-8');
    const result = validator.validateCase(`Case${id}`, reportText, vnexsusText);
    const labelScore = ((result.matching.dates.matchRate + result.matching.icds.matchRate + result.matching.hospitals.matchRate) / 3);
    const combinedScore = labelScore;
    rows.push({
      caseId: `Case${id}`,
      labelScore,
      combinedScore,
      matching: result.matching,
      hasMissing: result.hasMissing,
      reportPath,
      vnexsusPath: txtPath
    });
  }
  const summary = {
    matched: rows.length,
    passRate: rows.length ? rows.filter(r => !r.hasMissing).length / rows.length : 0,
    avgDateMatchRate: rows.length ? rows.reduce((s, r) => s + r.matching.dates.matchRate, 0) / rows.length : 0,
    avgIcdMatchRate: rows.length ? rows.reduce((s, r) => s + r.matching.icds.matchRate, 0) / rows.length : 0,
    avgHospitalMatchRate: rows.length ? rows.reduce((s, r) => s + r.matching.hospitals.matchRate, 0) / rows.length : 0,
    avgLabelScore: rows.length ? rows.reduce((s, r) => s + r.labelScore, 0) / rows.length : 0
  };
  const tableRows = rows.map(r => {
    const d = pct(r.matching.dates.matchRate);
    const i = pct(r.matching.icds.matchRate);
    const h = pct(r.matching.hospitals.matchRate);
    const ls = pct(r.labelScore);
    const c = pct(r.combinedScore);
    const pass = !r.hasMissing ? '<span class=\"ok\">PASS</span>' : '<span class=\"bad\">REVIEW</span>';
    return `<tr><td>${r.caseId}</td><td>${pass}</td><td>${bar(d)}<div>${d}</div></td><td>${bar(i)}<div>${i}</div></td><td>${bar(h)}<div>${h}</div></td><td>${bar(ls)}<div>${ls}</div></td><td>${bar(c)}<div>${c}</div></td><td class=\"muted\">${path.basename(r.reportPath)}</td><td class=\"muted\">${path.basename(r.vnexsusPath)}</td></tr>`;
  }).join('');
  const html = `<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\" /><title>오프라인 검증 보고서</title><style>
  body{font-family:system-ui,Segoe UI,Arial;padding:20px;color:#222;background:#fafafa}
  table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;vertical-align:top}th{background:#f4f4f4}
  .kpi{display:flex;gap:12px;flex-wrap:wrap}.kpi>div{border:1px solid #eee;border-radius:10px;padding:10px 12px;background:#fff;min-width:220px}
  .ok{color:#0a7}.bad{color:#c33}.muted{color:#666}.bar{height:8px;border-radius:6px;background:#eee;overflow:hidden}.bar>span{display:block;height:100%;background:#2563eb}
  </style></head><body>
  <h1>오프라인 검증 보고서</h1>
  <div class=\"kpi\">
    <div><div class=\"muted\">생성 시각</div><div>${new Date().toISOString()}</div></div>
    <div><div class=\"muted\">검증 케이스</div><div>${rows.length}</div></div>
    <div><div class=\"muted\">통과율</div><div>${pct(summary.passRate)}</div></div>
  </div>
  <table><thead><tr><th>Case</th><th>상태</th><th>날짜</th><th>ICD</th><th>병원</th><th>Label</th><th>Combined</th><th>Report</th><th>Offline</th></tr></thead><tbody>${tableRows}</tbody></table>
  </body></html>`;
  fs.writeFileSync(path.join(base, 'offline_validation_report.html'), html, 'utf-8');
  console.log(JSON.stringify({ base, cases: rows.length }, null, 2));
}

main().catch(err => { console.error(err.message || 'error'); process.exit(1); });
