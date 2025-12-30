import fs from 'fs';
import path from 'path';
import url from 'url';
const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports', 'VNEXSUS_Report');
const EXEC_DIR = path.join(ROOT, 'VNEXSUS_A-B-C_Execution_Plan');
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
function pct01(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return '0.0%';
  const clamped = Math.max(0, Math.min(1, x));
  return `${(clamped * 100).toFixed(1)}%`;
}
function p95(arr) {
  const nums = (arr || []).filter(n => typeof n === 'number' && Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const idx = Math.min(nums.length - 1, Math.ceil(nums.length * 0.95) - 1);
  return nums[idx];
}
function parseTasksMd(mdPath) {
  const res = { total: 0, completed: 0, pending: 0, items: [] };
  if (!fs.existsSync(mdPath)) return res;
  const raw = fs.readFileSync(mdPath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/-\s*\[(.| )\]\s*(.+)$/);
    if (!m) continue;
    const checked = m[1].toLowerCase() === 'x';
    const text = m[2].trim();
    res.total += 1;
    if (checked) res.completed += 1; else res.pending += 1;
    res.items.push({ text, done: checked });
  }
  return res;
}
function buildHtml(outDir) {
  const manifest = readJsonSafe(path.join(outDir, 'manifest.json'));
  const pair = readJsonSafe(path.join(outDir, 'pair_validations.json'));
  const subset = readJsonSafe(path.join(outDir, 'subset_matches.json'));
  const rows = (pair?.rows || []).filter(r => r?.status !== 'SKIPPED');
  const passThreshold = pair?.thresholds?.combinedPass ?? 0.6;
  const weightedPass = rows.length ? rows.filter(r => ((r?.combinedScore ?? 0) >= passThreshold)).length / rows.length : 0;
  const processed = Array.isArray(manifest?.processed) ? manifest.processed : [];
  const processedOk = processed.filter(p => p?.ok);
  const postTimes = processedOk.map(p => p.postprocessMs).filter(n => typeof n === 'number' && Number.isFinite(n));
  const avgPostMs = postTimes.length ? Math.round(postTimes.reduce((a, b) => a + b, 0) / postTimes.length) : null;
  const p95PostMs = p95(postTimes);
  const cover = processedOk.map(p => ({
    s: Number(p?.coverage?.sourceSpan?.rate ?? 0),
    c: Number(p?.coverage?.coordinates?.matchRate ?? 0)
  })).filter(v => Number.isFinite(v.s) && Number.isFinite(v.c));
  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const covAvg = cover.length ? ((avg(cover.map(v => v.s)) * 0.6) + (avg(cover.map(v => v.c)) * 0.4)) : 0;
  const pairSummary = pair?.summary || {};
  const subsetSummary = subset?.summary || {};
  const tasks = parseTasksMd(path.join(ROOT, 'VNEXSUS_Improvement_Tasks.md'));
  const reasonCounts = processed.reduce((acc, p) => {
    const key = p?.ok ? 'ok' : (p?.reason || 'unknown');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const warningCounts = processed.reduce((acc, p) => {
    const warns = Array.isArray(p?.warnings) ? p.warnings : [];
    for (const w of warns) {
      const key = typeof w === 'string' && w.length > 0 ? w : 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, {});
  const ts = new Date().toISOString();
  const card = (title, value, hint='') => `<div class="metric"><div class="metric-title">${title}</div><div class="metric-value">${value}</div><div class="metric-hint">${hint}</div></div>`;
  const bar = (v) => `<div class="bar"><span style="width:${pct01(v)}"></span></div>`;
  const rowsHtml = processed.map(p => {
    const ok = !!p?.ok;
    const cov = Number(p?.coverage?.sourceSpan?.rate ?? 0);
    const coord = Number(p?.coverage?.coordinates?.matchRate ?? 0);
    const perf = typeof p?.postprocessMs === 'number' && Number.isFinite(p.postprocessMs) ? p.postprocessMs : null;
    const len = Number(p?.effectiveLengths?.merged ?? 0);
    const blocks = Number(p?.ocr?.blocks?.total ?? 0);
    return `<tr>
      <td>Case${p?.caseIndex ?? '-'}</td>
      <td>${ok ? '<span class="ok">OK</span>' : `<span class="bad">FAIL</span> <span class="muted">${p?.reason ?? ''}</span>`}</td>
      <td>${pct01(cov)}</td>
      <td>${pct01(coord)}</td>
      <td>${blocks}</td>
      <td>${perf === null ? '-' : `${perf}ms`}</td>
      <td>${len.toLocaleString()}</td>
    </tr>`;
  }).join('');
  const reasonList = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="chip">${k}:${v}</div>`).join('');
  const warnList = Object.entries(warningCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="chip">${k}:${v}</div>`).join('');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8" />
  <meta http-equiv="refresh" content="15" />
  <title>VNEXSUS 실시간 개선·개발 현황</title>
  <style>
  :root{--bg:#0f172a;--fg:#111827;--card:#ffffff;--muted:#6b7280;--accent:#2563eb;--ok:#10b981;--bad:#ef4444}
  body{font-family:system-ui,Segoe UI,Arial;margin:0;background:linear-gradient(135deg,#0ea5e9,#6366f1)}
  .wrap{max-width:1200px;margin:24px auto;background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.25);overflow:hidden}
  .hd{background:linear-gradient(135deg,#0ea5e9,#22c55e);color:#fff;padding:20px}
  .hd h1{margin:0;font-size:22px}
  .meta{font-size:12px;opacity:.95;margin-top:6px}
  .ct{padding:18px}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .metric{border:1px solid #e5e7eb;border-radius:12px;padding:12px;background:#fff}
  .metric-title{font-size:12px;color:#374151}
  .metric-value{font-size:22px;font-weight:700;color:#111827;margin-top:4px}
  .metric-hint{font-size:12px;color:#6b7280;margin-top:4px}
  .section{margin-top:16px}
  .section h2{font-size:16px;margin:0 0 8px 0;color:#111827}
  .chips{display:flex;gap:8px;flex-wrap:wrap}
  .chip{background:#f9fafb;border:1px solid #e5e7eb;color:#374151;padding:6px 10px;border-radius:999px;font-size:12px}
  .bar{height:8px;background:#e5e7eb;border-radius:6px;overflow:hidden}
  .bar>span{display:block;height:100%;background:linear-gradient(90deg,#2563eb,#22c55e);width:0%}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px;vertical-align:top}
  .muted{color:#6b7280}
  .ok{color:#10b981}
  .bad{color:#ef4444}
  .footer{padding:12px;color:#374151;font-size:12px}
  </style></head><body>
  <div class="wrap">
    <div class="hd">
      <h1>VNEXSUS 실시간 개선·개발 현황</h1>
      <div class="meta">생성 시각: ${ts} · 출력 디렉토리: ${outDir}</div>
    </div>
    <div class="ct">
      <div class="grid">
        ${card('총 케이스', String(processed.length), '')}
        ${card('성공 케이스', String(processedOk.length), '')}
        ${card('가중 통과율', pct01(weightedPass), 'combinedScore 기반')}
      </div>
      <div class="grid" style="margin-top:12px">
        ${card('정확도(평균)', pct01(pairSummary.avgCombinedScore ?? 0), '')}
        ${card('커버리지(평균)', pct01(covAvg), '')}
        ${card('베이스라인 통과율', pct01(subsetSummary.passRate ?? 0), '')}
      </div>
      <div class="grid" style="margin-top:12px">
        ${card('후처리 평균', avgPostMs === null ? '-' : `${avgPostMs}ms`, '')}
        ${card('후처리 P95', p95PostMs === null ? '-' : `${p95PostMs}ms`, '')}
        ${card('검증 쌍', String(pairSummary.matched ?? 0), '')}
      </div>
      <div class="section">
        <h2>실패·경고 원인</h2>
        <div class="chips">${reasonList || '<div class="chip">-</div>'}</div>
        <div class="chips" style="margin-top:8px">${warnList || ''}</div>
      </div>
      <div class="section">
        <h2>개발 태스크 진행</h2>
        <div class="grid">
          ${card('전체 태스크', String(tasks.total), '')}
          ${card('완료', String(tasks.completed), '')}
          ${card('대기', String(tasks.pending), '')}
        </div>
      </div>
      <div class="section">
        <h2>케이스별 상태</h2>
        <table><thead><tr><th>Case</th><th>상태</th><th>SourceSpan</th><th>좌표매칭</th><th>블록</th><th>후처리</th><th>원문길이</th></tr></thead><tbody>
          ${rowsHtml}
        </tbody></table>
      </div>
      <div class="section">
        <h2>디자인 가이드</h2>
        <div class="muted">그라디언트 헤더·카드 그리드·칩·프로그레스 바를 적용해 가독성과 시인성을 강화</div>
      </div>
    </div>
    <div class="footer">이 문서는 변경 시 15초 간격으로 자동 새로고침되며, 최신 결과로 재생성하여 반영</div>
  </div>
  </body></html>`;
  return html;
}
function writeDoc(outDir) {
  if (!fs.existsSync(EXEC_DIR)) fs.mkdirSync(EXEC_DIR, { recursive: true });
  const html = buildHtml(outDir);
  const target = path.join(EXEC_DIR, 'index.html');
  fs.writeFileSync(target, html, 'utf-8');
  return target;
}
function watchAndGenerate(outDir) {
  const target = writeDoc(outDir);
  const files = [
    path.join(outDir, 'manifest.json'),
    path.join(outDir, 'pair_validations.json'),
    path.join(outDir, 'subset_matches.json')
  ];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    fs.watch(f, { persistent: true }, () => {
      try { writeDoc(outDir); } catch {}
    });
  }
  return target;
}
function main() {
  const argOut = process.argv.find(a => a.startsWith('--outDir='))?.slice('--outDir='.length);
  const OUT_DIR = argOut ? (path.isAbsolute(argOut) ? argOut : path.join(ROOT, argOut)) : pickLatestOutDir();
  if (!OUT_DIR) {
    console.error('출력 디렉토리를 찾을 수 없습니다.');
    process.exit(1);
  }
  const watch = process.argv.includes('--watch');
  const out = watch ? watchAndGenerate(OUT_DIR) : writeDoc(OUT_DIR);
  console.log(`HTML 문서 생성: ${out}`);
}
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}
