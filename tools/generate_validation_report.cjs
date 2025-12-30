const fs = require('fs');
const path = require('path');

function arg(k, d) {
  const a = process.argv.find(v => v.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=') : d;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readTextFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (ext === '.txt' || ext === '.md' || ext === '.html') {
        const full = path.join(dir, e.name);
        let text = '';
        try {
          text = fs.readFileSync(full, 'utf-8');
        } catch {
          text = '';
        }
        files.push({ name: e.name, path: full, text });
      }
    }
  }
  return files;
}

function extractCaseIndex(name) {
  const m = name.match(/Case(\d+)/i);
  return m ? Number(m[1]) : null;
}

function normDate(d) {
  if (!d) return null;
  const s = String(d).trim();
  let m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
  if (m) {
    const y = m[1], mm = String(m[2]).padStart(2, '0'), dd = String(m[3]).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  m = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (m) {
    const y = m[1], mm = String(m[2]).padStart(2, '0'), dd = String(m[3]).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
  if (m) {
    const y = m[3], mm = String(m[1]).padStart(2, '0'), dd = String(m[2]).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

function extractDates(t) {
  if (!t) return [];
  const out = new Set();
  const re1 = /\b(19|20)\d{2}[.\-\/]\d{1,2}[.\-\/]\d{1,2}\b/g;
  const re2 = /\b(19|20)\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일?\b/g;
  const re3 = /\b\d{1,2}[.\-\/]\d{1,2}[.\-\/](19|20)\d{2}\b/g;
  const m1 = t.match(re1) || [];
  const m2 = t.match(re2) || [];
  const m3 = t.match(re3) || [];
  for (const s of [...m1, ...m2, ...m3]) {
    const n = normDate(s);
    if (n) out.add(n);
  }
  return [...out];
}

function parseISO(d) {
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return isNaN(dt.getTime()) ? null : dt;
}

function daysBetween(a, b) {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!da || !db) return Infinity;
  const diff = Math.abs(db.getTime() - da.getTime());
  return Math.round(diff / 86400000);
}

function matchDates(a, b) {
  const matched = [];
  const missing = [];
  const setB = new Set(b);
  for (const d of a) {
    let ok = false;
    for (const e of setB) {
      const dd = daysBetween(d, e);
      if (dd <= 3) {
        matched.push([d, e, dd]);
        setB.delete(e);
        ok = true;
        break;
      }
    }
    if (!ok) missing.push(d);
  }
  const rate = a.length === 0 ? (b.length === 0 ? 1 : 0) : matched.length / a.length;
  return { matched, missing, matchRate: rate };
}

function extractICD(t) {
  if (!t) return [];
  const out = new Set();
  const re = /\b[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?\b/g;
  const m = t.match(re) || [];
  for (const s of m) out.add(s.toUpperCase());
  return [...out];
}

function matchICD(a, b) {
  const matched = [];
  const missing = [];
  const nb = b.map(s => s.toUpperCase());
  for (const d of a) {
    const base = d.split('.')[0];
    const hit = nb.find(x => x === d || x.split('.')[0] === base);
    if (hit) matched.push([d, hit]);
    else missing.push(d);
  }
  const rate = a.length === 0 ? (b.length === 0 ? 1 : 0) : matched.length / a.length;
  return { matched, missing, matchRate: rate };
}

function extractHospitals(t) {
  if (!t) return [];
  const out = new Set();
  const re = /([가-힣A-Za-z0-9\s]{1,30})(병원|의원|의료원|센터)\b/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const name = `${m[1]}${m[2]}`.replace(/\s+/g, '').trim();
    if (name.length >= 2) out.add(name);
  }
  return [...out];
}

function normHospital(s) {
  return String(s).replace(/\s+/g, '').replace(/(병원|의원|의료원|센터)$/,'').toLowerCase();
}

function matchHospitals(a, b) {
  const matched = [];
  const missing = [];
  const nb = b.map(normHospital);
  for (const d of a) {
    const nd = normHospital(d);
    const hit = nb.find(x => x === nd);
    if (hit) matched.push([d, hit]);
    else missing.push(d);
  }
  const rate = a.length === 0 ? (b.length === 0 ? 1 : 0) : matched.length / a.length;
  return { matched, missing, matchRate: rate };
}

function tokenize(t) {
  if (!t) return [];
  const cleaned = t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const raw = cleaned.split(/\s+/g).filter(Boolean);
  const stop = new Set(['및','와','과','의','등','로','으로','에','에서','다','함','고','됨','같음','있음','인','것','수','후','전','로써','그리고','또한','또','더','초기','최종','검사','진단','치료','보고서']);
  return raw.filter(w => w.length > 1 && !stop.has(w) && !/^\d+$/.test(w));
}

function jaccard(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter += 1;
  const uni = new Set([...sa, ...sb]).size;
  if (uni === 0) return 1;
  return inter / uni;
}

function labelScore(a, b) {
  const sa = new Set(a);
  let hit = 0;
  for (const w of sa) if (b.includes(w)) hit += 1;
  return sa.size === 0 ? (b.length === 0 ? 1 : 0) : hit / sa.size;
}

function pickBestMatch(idx, vnFiles) {
  const cand = vnFiles.filter(f => {
    const j = extractCaseIndex(f.name);
    if (j !== null) return j === idx;
    return new RegExp(`Case\\s*${idx}`, 'i').test(f.name);
  });
  if (cand.length <= 1) return cand[0] || null;
  let best = cand[0];
  let bestScore = 0;
  for (const f of cand) {
    const s = Math.min(f.text.length, 50000);
    const tt = f.text.slice(0, s);
    const sc = tokenize(tt).length;
    if (sc > bestScore) {
      bestScore = sc;
      best = f;
    }
  }
  return best;
}

function pct(n) {
  const v = Math.max(0, Math.min(1, n));
  return `${Math.round(v * 100)}%`;
}

function bar(p) {
  const v = Math.max(0, Math.min(100, Number(String(p).replace('%',''))));
  return `<div class="bar"><span style="width:${v}%"></span></div>`;
}

function buildHTML(outDir, rows, summary, subsetSummary) {
  const tableRows = rows.map(r => {
    const pass = !r.hasMissing && r.inputOk;
    return `<tr>
      <td>Case${r.caseIndex}</td>
      <td>${pass ? '<span class="ok">PASS</span>' : '<span class="bad">REVIEW</span>'}</td>
      <td>${bar(pct(r.matching.dates.matchRate))}<div>${pct(r.matching.dates.matchRate)}</div></td>
      <td>${bar(pct(r.matching.icds.matchRate))}<div>${pct(r.matching.icds.matchRate)}</div></td>
      <td>${bar(pct(r.matching.hospitals.matchRate))}<div>${pct(r.matching.hospitals.matchRate)}</div></td>
      <td>${bar(pct(r.labelScore))}<div>${pct(r.labelScore)}</div></td>
      <td>${bar(pct(r.jaccard))}<div>${pct(r.jaccard)}</div></td>
      <td>${bar(pct(r.combinedScore))}<div>${pct(r.combinedScore)}</div></td>
      <td class="muted">${path.basename(r.reportPath || '')}</td>
      <td class="muted">${path.basename(r.vnexsusPath || '')}</td>
    </tr>`;
  }).join('');
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
    <div><div class="muted">검증 쌍 수</div><div>${summary.matched}</div></div>
    <div><div class="muted">통과율</div><div>${pct(summary.passRate)}</div></div>
  </div>
  <div class="card">
    <div class="grid">
      <div class="card">
        <div class="muted">평균 날짜 매칭률</div>
        ${bar(pct(summary.avgDateMatchRate))}
        <div>${pct(summary.avgDateMatchRate)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 ICD 매칭률</div>
        ${bar(pct(summary.avgIcdMatchRate))}
        <div>${pct(summary.avgIcdMatchRate)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 병원 매칭률</div>
        ${bar(pct(summary.avgHospitalMatchRate))}
        <div>${pct(summary.avgHospitalMatchRate)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 LabelScore</div>
        ${bar(pct(summary.avgLabelScore))}
        <div>${pct(summary.avgLabelScore)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 Jaccard</div>
        ${bar(pct(summary.avgJaccard))}
        <div>${pct(summary.avgJaccard)}</div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="muted">베이스라인 46개 매칭</div>
    <div>매칭 수: ${subsetSummary.matched} / ${subsetSummary.baselineReports}</div>
    <div>통과율: ${pct(subsetSummary.passRate)}</div>
    <div class="grid" style="margin-top:8px">
      <div class="card">
        <div class="muted">평균 날짜</div>
        ${bar(pct(subsetSummary.avgDateMatchRate))}
        <div>${pct(subsetSummary.avgDateMatchRate)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 ICD</div>
        ${bar(pct(subsetSummary.avgIcdMatchRate))}
        <div>${pct(subsetSummary.avgIcdMatchRate)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 병원</div>
        ${bar(pct(subsetSummary.avgHospitalMatchRate))}
        <div>${pct(subsetSummary.avgHospitalMatchRate)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 LabelScore</div>
        ${bar(pct(subsetSummary.avgLabelScore))}
        <div>${pct(subsetSummary.avgLabelScore)}</div>
      </div>
      <div class="card">
        <div class="muted">평균 Jaccard</div>
        ${bar(pct(subsetSummary.avgJaccard))}
        <div>${pct(subsetSummary.avgJaccard)}</div>
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
  return html;
}

function run() {
  const outDir = path.resolve(arg('outDir', path.join(process.cwd(), 'VNEXSUS_A-B-C_Execution_Plan')));
  const baselineDir = path.resolve(arg('baselineDir', path.join(process.cwd(), 'src', 'rag', 'case_sample')));
  const vnexsusDir = path.resolve(arg('vnexsusDir', path.join(process.cwd(), 'VNEXSUS_Report')));
  ensureDir(outDir);
  const baseline = readTextFiles(baselineDir);
  const vnexsus = readTextFiles(vnexsusDir);
  const rows = [];
  const seen = new Set();
  for (const b of baseline) {
    const idx = extractCaseIndex(b.name);
    if (idx === null) continue;
    if (seen.has(idx)) continue;
    const vfile = pickBestMatch(idx, vnexsus);
    const brep = b.text || '';
    const vrep = vfile ? (vfile.text || '') : '';
    const bd = extractDates(brep);
    const vd = extractDates(vrep);
    const bi = extractICD(brep);
    const vi = extractICD(vrep);
    const bh = extractHospitals(brep);
    const vh = extractHospitals(vrep);
    const dm = matchDates(bd, vd);
    const im = matchICD(bi, vi);
    const hm = matchHospitals(bh, vh);
    const ta = tokenize(brep);
    const tb = tokenize(vrep);
    const ls = labelScore(ta, tb);
    const jc = jaccard(ta, tb);
    const cs = (dm.matchRate + im.matchRate + hm.matchRate + ls + jc) / 5;
    const missing = dm.missing.length > 0 || im.missing.length > 0 || hm.missing.length > 0;
    rows.push({
      caseIndex: idx,
      reportPath: b.path,
      vnexsusPath: vfile ? vfile.path : null,
      matching: { dates: dm, icds: im, hospitals: hm },
      labelScore: ls,
      jaccard: jc,
      combinedScore: cs,
      hasMissing: missing,
      inputOk: brep.length > 0 && (vrep.length > 0)
    });
    seen.add(idx);
  }
  const total = rows.length;
  const passCount = rows.filter(r => !r.hasMissing && r.inputOk).length;
  const avg = (key) => rows.length === 0 ? 0 : rows.reduce((s, r) => s + r[key], 0) / rows.length;
  const avgDate = rows.length === 0 ? 0 : rows.reduce((s, r) => s + r.matching.dates.matchRate, 0) / rows.length;
  const avgIcd = rows.length === 0 ? 0 : rows.reduce((s, r) => s + r.matching.icds.matchRate, 0) / rows.length;
  const avgHospital = rows.length === 0 ? 0 : rows.reduce((s, r) => s + r.matching.hospitals.matchRate, 0) / rows.length;
  const summary = {
    matched: total,
    passRate: total === 0 ? 0 : passCount / total,
    avgDateMatchRate: avgDate,
    avgIcdMatchRate: avgIcd,
    avgHospitalMatchRate: avgHospital,
    avgLabelScore: avg('labelScore'),
    avgJaccard: avg('jaccard')
  };
  const subsetSummary = {
    baselineReports: total,
    matched: total,
    passRate: summary.passRate,
    avgDateMatchRate: summary.avgDateMatchRate,
    avgIcdMatchRate: summary.avgIcdMatchRate,
    avgHospitalMatchRate: summary.avgHospitalMatchRate,
    avgLabelScore: summary.avgLabelScore,
    avgJaccard: summary.avgJaccard
  };
  const html = buildHTML(outDir, rows, summary, subsetSummary);
  fs.writeFileSync(path.join(outDir, 'validation_report.html'), html, 'utf-8');
}

run();
