import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, 'reports', 'VNEXSUS_Report');
const OFFLINE_SAMPLES_DIR = path.join(ROOT, 'reports', 'offline_ocr_samples');
function readJson(fp) {
  try {
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function listLatestReportDir() {
  const pickLatestWithArtifacts = (base) => {
    if (!fs.existsSync(base)) return null;
    const dirs = fs.readdirSync(base, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort((a, b) => a.localeCompare(b))
      .reverse();
    for (const name of dirs) {
      const candidate = path.join(base, name);
      const artifacts = path.join(candidate, 'artifacts');
      if (fs.existsSync(artifacts)) {
        const files = fs.readdirSync(artifacts);
        if (Array.isArray(files) && files.some(f => /^Case\d+_blocks\.json$/i.test(f))) {
          return candidate;
        }
      }
    }
    return null;
  };
  const backendReports = path.join(ROOT, 'backend', 'reports', 'VNEXSUS_Report');
  const backendOffline = path.join(ROOT, 'backend', 'reports', 'offline_ocr_samples');
  const rootOffline = path.join(ROOT, 'reports', 'offline_ocr_samples');
  return (
    pickLatestWithArtifacts(REPORTS_DIR) ||
    pickLatestWithArtifacts(backendReports) ||
    pickLatestWithArtifacts(rootOffline) ||
    pickLatestWithArtifacts(backendOffline)
  );
}
function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function analyzeBlocks(blocks) {
  const byPage = new Map();
  const anomalies = { missingText: 0, zeroArea: 0, negativeDims: 0, missingPage: 0, missingBbox: 0 };
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const text = typeof b?.text === 'string' ? b.text : '';
    const bb = b?.bbox || {};
    const page = Number(b?.page);
    const width = Number(bb?.width);
    const height = Number(bb?.height);
    if (!text || text.trim().length === 0) anomalies.missingText += 1;
    if (!Number.isFinite(page) || page <= 0) anomalies.missingPage += 1;
    if (!bb || (!Number.isFinite(bb.xMin) && !Number.isFinite(bb.yMin))) anomalies.missingBbox += 1;
    if (Number.isFinite(width) && Number.isFinite(height)) {
      if (width === 0 || height === 0) anomalies.zeroArea += 1;
      if (width < 0 || height < 0) anomalies.negativeDims += 1;
    } else {
      anomalies.missingBbox += 1;
    }
    if (Number.isFinite(page) && page > 0) {
      const cur = byPage.get(page) || { page, widthMax: 0, heightMax: 0, blocks: [] };
      const xMax = Number(bb?.xMax);
      const yMax = Number(bb?.yMax);
      if (Number.isFinite(xMax) && xMax > cur.widthMax) cur.widthMax = xMax;
      if (Number.isFinite(yMax) && yMax > cur.heightMax) cur.heightMax = yMax;
      cur.blocks.push(b);
      byPage.set(page, cur);
    }
  }
  const pages = [...byPage.values()].sort((a, b) => a.page - b.page);
  const normalized = [];
  for (const p of pages) {
    const w = p.widthMax > 0 ? p.widthMax : 1;
    const h = p.heightMax > 0 ? p.heightMax : 1;
    for (const b of p.blocks) {
      const bb = b?.bbox || {};
      const nxMin = clamp01(bb.xMin / w);
      const nyMin = clamp01(bb.yMin / h);
      const nxMax = clamp01(bb.xMax / w);
      const nyMax = clamp01(bb.yMax / h);
      const nwidth = clamp01((bb.xMax - bb.xMin) / w);
      const nheight = clamp01((bb.yMax - bb.yMin) / h);
      normalized.push({
        page: Number(b.page),
        blockIndex: Number(b.blockIndex),
        textLength: typeof b.text === 'string' ? b.text.length : 0,
        bboxNorm: { xMin: nxMin, yMin: nyMin, xMax: nxMax, yMax: nyMax, width: nwidth, height: nheight },
        confidence: typeof b.confidence === 'number' ? b.confidence : null
      });
    }
  }
  const stats = {
    blocksTotal: Array.isArray(blocks) ? blocks.length : 0,
    pagesTotal: pages.length,
    anomalies,
    zeroAreaRate: statsRate(anomalies.zeroArea, Array.isArray(blocks) ? blocks.length : 0),
    missingTextRate: statsRate(anomalies.missingText, Array.isArray(blocks) ? blocks.length : 0),
    negativeDimsRate: statsRate(anomalies.negativeDims, Array.isArray(blocks) ? blocks.length : 0),
    missingBboxRate: statsRate(anomalies.missingBbox, Array.isArray(blocks) ? blocks.length : 0)
  };
  return { pages, normalized, stats };
}
function statsRate(n, total) {
  const t = Number(total);
  const x = Number(n);
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (!Number.isFinite(x) || x < 0) return 0;
  return x / t;
}
function buildHtml(summary) {
  const s = summary;
  const head = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>오프라인 좌표 품질 분석</title><style>:root{color-scheme:light dark;--bg:#0f172a;--card:#111827;--text:#e5e7eb;--muted:#9ca3af;--accent:#60a5fa;--ok:#34d399;--warn:#f59e0b;--bad:#f87171;--border:#1f2937}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text)}.wrap{max-width:1120px;margin:0 auto;padding:28px}.hd{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap}.hd h1{font-size:24px;margin:0;letter-spacing:.2px}.meta{color:var(--muted);font-size:13px}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px;margin-top:18px}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px}.card h2{margin:0 0 12px;font-size:16px}.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi .item{padding:12px;border:1px solid var(--border);border-radius:10px;background:#0b1220}.kpi .label{color:var(--muted);font-size:12px}.kpi .val{margin-top:6px;font-size:20px;font-weight:600}.bar{height:10px;background:#0b1220;border:1px solid var(--border);border-radius:999px;overflow:hidden}.bar>span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#22d3ee)}.list{display:grid;gap:8px}.list .row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:10px}.list .row .title{font-size:14px}.list .row .stat{display:flex;gap:8px;align-items:center}.pill{font-size:12px;padding:4px 8px;border-radius:999px}.pill.ok{background:#052d20;border:1px solid #115e38;color:#22c55e}.pill.warn{background:#2a1905;border:1px solid #8a6112;color:#f59e0b}.pill.bad{background:#2a0b0b;border:1px solid #7f1d1d;color:#ef4444}.cols-6{grid-column:span 6}.cols-12{grid-column:span 12}.note{margin-top:8px;color:var(--muted);font-size:12px}.table{width:100%;border-collapse:collapse}.table th,.table td{border:1px solid var(--border);padding:8px;vertical-align:top}.table th{background:#0b1220;color:var(--muted)}@media(max-width:860px){.grid{grid-template-columns:repeat(1,1fr)}.kpi{grid-template-columns:repeat(2,1fr)}.cols-6,.cols-12{grid-column:span 1}}</style></head><body><div class="wrap"><div class="hd"><h1>오프라인 좌표 품질 분석 리포트</h1><div class="meta">기준: ${s.baseDir}</div></div>`;
  const kpi = `<div class="grid"><div class="card cols-12"><div class="kpi"><div class="item"><div class="label">케이스 수</div><div class="val">${s.caseCount}</div></div><div class="item"><div class="label">블록 총합</div><div class="val">${s.blocksTotal}</div></div><div class="item"><div class="label">페이지 총합</div><div class="val">${s.pagesTotal}</div></div><div class="item"><div class="label">좌표 시스템</div><div class="val">document_pixel(Vision)</div></div></div></div>`;
  const agg = `<div class="card cols-12"><h2>집계 지표</h2><table class="table"><thead><tr><th>지표</th><th>값</th></tr></thead><tbody><tr><td>누락 텍스트 비율</td><td>${(s.missingTextRateAvg * 100).toFixed(1)}%</td></tr><tr><td>영역 0 비율</td><td>${(s.zeroAreaRateAvg * 100).toFixed(1)}%</td></tr><tr><td>음수 차원 비율</td><td>${(s.negativeDimsRateAvg * 100).toFixed(1)}%</td></tr><tr><td>bbox 누락 비율</td><td>${(s.missingBboxRateAvg * 100).toFixed(1)}%</td></tr><tr><td>평균 셀 span</td><td>${Number.isFinite(s.avgSpanAvg) ? s.avgSpanAvg.toFixed(2) : '—'}</td></tr></tbody></table></div>`;
  const rows = s.perCase.map(c => {
    const cov = `${(c.pageCoverage * 100).toFixed(1)}%`;
    const qual = `${(c.qualityScore * 100).toFixed(1)}%`;
    const barCov = `<div class="bar"><span style="width:${(c.pageCoverage * 100).toFixed(1)}%"></span></div>`;
    const barQual = `<div class="bar"><span style="width:${(c.qualityScore * 100).toFixed(1)}%"></span></div>`;
    const avgSpanCell = Number.isFinite(c.avgSpan) ? c.avgSpan.toFixed(2) : '—';
    const status = (c.blocks>0 && (c.tableCount||0)>0) ? '<span class="pill ok">좌표 있음</span>' : (c.blocks>0 ? '<span class="pill warn">좌표 미생성</span>' : '<span class="pill bad">데이터 없음</span>');
    return `<tr><td>Case${c.caseIndex}</td><td>${c.blocks}</td><td>${c.pages}</td><td>${barCov}<div class="muted">${cov}</div></td><td>${barQual}<div class="muted">${qual}</div></td><td>${(c.zeroAreaRate * 100).toFixed(1)}%</td><td>${(c.missingTextRate * 100).toFixed(1)}%</td><td>${(c.negativeDimsRate * 100).toFixed(1)}%</td><td>${(c.missingBboxRate * 100).toFixed(1)}%</td><td>${c.tableCount||0}</td><td>${avgSpanCell}</td><td>${((c.headerRate||0)*100).toFixed(1)}%</td><td>${((c.footerRate||0)*100).toFixed(1)}%</td><td>${status}</td></tr>`;
  }).join('');
  const emptyNote = s.caseCount === 0 ? `<div class="card cols-12"><div class="note">데이터 없음 · 분석 디렉터리에 artifacts/CaseX_blocks.json 파일이 없습니다. 최신 리포트 디렉터리 선택 로직을 보강했습니다.</div></div>` : '';
  const table = `<div class="card cols-12"><h2>케이스별 품질 지표</h2><table class="table"><thead><tr><th>Case</th><th>블록수</th><th>페이지수</th><th>페이지 커버리지</th><th>품질 점수</th><th>0영역</th><th>텍스트누락</th><th>음수차원</th><th>bbox누락</th><th>테이블수</th><th>평균 span</th><th>헤더비율</th><th>푸터비율</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const baseRel = (() => {
    const r = typeof s.baseDir === 'string' ? s.baseDir : '';
    const root = typeof process?.cwd === 'function' ? process.cwd() : '';
    const low = r.toLowerCase();
    const lowRoot = root.toLowerCase();
    if (low.startsWith(lowRoot)) {
      const sub = r.slice(root.length).replace(/\\/g, '/');
      return sub.startsWith('/') ? sub : '/' + sub;
    }
    return r.replace(/\\/g, '/');
  })();
  const viewer = `<div class="card cols-12"><h2>케이스 뷰어</h2><div class="list"><div class="row"><div class="title">케이스 선택</div><div class="stat"><select id="case-select"></select><span class="pill warn" id="case-info">대기</span></div></div><div id="case-preview" class="note">테이블 미리보기</div></div></div>`;
  const script = `<script>window.__baseRel=${JSON.stringify(baseRel)};window.__perCase=${JSON.stringify(s.perCase)};function $(i){return document.getElementById(i)}function fillCases(){const sel=$('case-select');sel.innerHTML='';(__perCase||[]).forEach(c=>{const o=document.createElement('option');o.value=String(c.caseIndex);o.textContent='Case'+c.caseIndex;sel.appendChild(o)});$('case-info').textContent=(__perCase||[]).length?'선택':'없음'}async function f(u){try{const r=await fetch(u+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}function drawGrid(t){const box=$('case-preview');box.innerHTML='';if(!t||!Array.isArray(t.tables)||!t.tables.length){box.textContent='테이블 없음';return}const first=t.tables[0];const tbl=document.createElement('table');tbl.className='table';const thead=document.createElement('thead');const trh=document.createElement('tr');for(let i=0;i<Math.max(1,first.columns.length);i++){const th=document.createElement('th');th.textContent='C'+i;trh.appendChild(th)}thead.appendChild(trh);tbl.appendChild(thead);const tbody=document.createElement('tbody');(first.grid||[]).forEach((row)=>{const tr=document.createElement('tr');row.forEach((cell)=>{const td=document.createElement('td');td.textContent=String(cell.text||'');if(Number(cell.span)>1){td.className='pill warn'}tr.appendChild(td)});tbody.appendChild(tr)});tbl.appendChild(tbody);box.appendChild(tbl)}async function onCaseChange(){const ci=$('case-select').value;if(!ci){$('case-info').textContent='대기';$('case-preview').textContent='테이블 미리보기';return}const url=__baseRel+'/artifacts/Case'+ci+'_tables_merged.json';$('case-info').textContent='불러오는 중';const js=await f(url);$('case-info').textContent=js&&js.summary?'테이블 '+(js.summary.hasAnySpan?'병합 포함':'병합 없음'):'없음';if(js&&js.tables){const full={caseIndex:Number(ci),tables:js.tables};drawGrid(full)}else{const alt=await f(__baseRel+'/artifacts/Case'+ci+'_tables.json');drawGrid(alt)} }document.addEventListener('DOMContentLoaded',function(){fillCases();$('case-select').addEventListener('change',onCaseChange);if(($('__baseRel')||'')&&(__perCase||[]).length){$('case-select').value=String((__perCase[0]||{}).caseIndex||'');onCaseChange()}});</script>`;
  const foot = `<style>:root{color-scheme:light;--bg:#fafafa;--card:#fff;--text:#222;--muted:#666;--accent:#2563eb;--ok:#16a34a;--warn:#f59e0b;--bad:#dc2626;--border:#ddd}.kpi .item{background:#fff}.bar{background:#eee;border-color:var(--border)}.bar>span{background:#2563eb}.list .row{background:#fff}.pill{border:1px solid var(--border)}.pill.ok{background:#ecfdf5;border-color:#bbf7d0;color:#16a34a}.pill.warn{background:#fff7ed;border-color:#fed7aa;color:#b45309}.pill.bad{background:#fee2e2;border-color:#fecaca;color:#dc2626}.muted{color:var(--muted);font-size:12px}.table{width:100%;border-collapse:collapse}.table thead th{background:#f4f4f4;border:1px solid var(--border);padding:8px}.table td{border:1px solid var(--border);padding:8px}</style></div>${script}</body></html>`;
  return head + kpi + agg + emptyNote + table + viewer + foot;
}
function cluster(vals, tol) {
  const a = vals.slice().sort((x, y) => x - y);
  const out = [];
  for (const v of a) {
    if (!out.length) { out.push({ sum: v, count: 1 }); continue; }
    const last = out[out.length - 1];
    const center = last.sum / last.count;
    if (Math.abs(v - center) <= tol) { last.sum += v; last.count += 1; }
    else { out.push({ sum: v, count: 1 }); }
  }
  return out.map(c => c.sum / c.count);
}
function extractTables(blocks, options = {}) {
  const rowTol = typeof options.rowTol === 'number' ? options.rowTol : 0.015;
  const colTol = typeof options.colTol === 'number' ? options.colTol : 0.010;
  const minCols = typeof options.minCols === 'number' ? options.minCols : 2;
  const byPage = new Map();
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const page = Number(b?.page);
    if (!Number.isFinite(page) || page <= 0) continue;
    const cur = byPage.get(page) || { page, widthMax: 0, heightMax: 0, blocks: [] };
    const bb = b?.bbox || {};
    const xMax = Number(bb?.xMax);
    const yMax = Number(bb?.yMax);
    if (Number.isFinite(xMax) && xMax > cur.widthMax) cur.widthMax = xMax;
    if (Number.isFinite(yMax) && yMax > cur.heightMax) cur.heightMax = yMax;
    cur.blocks.push(b);
    byPage.set(page, cur);
  }
  const pages = [...byPage.values()].sort((a, b) => a.page - b.page);
  const result = [];
  for (const p of pages) {
    const w = p.widthMax > 0 ? p.widthMax : 1;
    const h = p.heightMax > 0 ? p.heightMax : 1;
    const items = p.blocks.map(b => {
      const bb = b?.bbox || {};
      const nxMin = clamp01(bb.xMin / w);
      const nyMin = clamp01(bb.yMin / h);
      const nxMax = clamp01(bb.xMax / w);
      const nyMax = clamp01(bb.yMax / h);
      const nwidth = clamp01((bb.xMax - bb.xMin) / w);
      const nheight = clamp01((bb.yMax - bb.yMin) / h);
      return { page: Number(b.page), text: typeof b.text === 'string' ? b.text : '', bboxNorm: { xMin: nxMin, yMin: nyMin, xMax: nxMax, yMax: nyMax, width: nwidth, height: nheight } };
    }).filter(x => x.bboxNorm.width > 0.001 && x.bboxNorm.height > 0.001 && (x.text || '').trim().length > 0);
    items.sort((a, b) => a.bboxNorm.yMin - b.bboxNorm.yMin || a.bboxNorm.xMin - b.bboxNorm.xMin);
    const rows = [];
    for (const it of items) {
      const cy = (it.bboxNorm.yMin + it.bboxNorm.yMax) / 2;
      if (!rows.length) { rows.push({ y: cy, items: [it] }); continue; }
      const last = rows[rows.length - 1];
      if (Math.abs(cy - last.y) <= rowTol) { last.items.push(it); last.y = (last.y + cy) / 2; }
      else { rows.push({ y: cy, items: [it] }); }
    }
    const xs = [];
    for (const r of rows) for (const it of r.items) xs.push(it.bboxNorm.xMin);
    const cols = cluster(xs, colTol);
    const bounds = cols.map((c, i) => {
      const left = i === 0 ? 0 : (cols[i - 1] + c) / 2;
      const right = i === cols.length - 1 ? 1 : (c + cols[i + 1]) / 2;
      return { left, right };
    });
    const rowCells = rows.map(r => {
      const cells = r.items.map(it => {
        const start = it.bboxNorm.xMin;
        const end = it.bboxNorm.xMax;
        const cover = [];
        for (let i = 0; i < bounds.length; i++) {
          if (end > bounds[i].left && start < bounds[i].right) cover.push(i);
        }
        let idx = cover.length ? cover[0] : 0;
        if (!cover.length) {
          let best = Number.POSITIVE_INFINITY;
          for (let i = 0; i < cols.length; i++) {
            const d = Math.abs(start - cols[i]);
            if (d < best) { best = d; idx = i; }
          }
        }
        const span = Math.max(1, cover.length);
        return { colIndex: idx, span, text: it.text, bboxNorm: it.bboxNorm };
      }).sort((a, b) => a.colIndex - b.colIndex);
      return { y: r.y, cells };
    });
    const tables = [];
    let cur = null;
    for (let i = 0; i < rowCells.length; i++) {
      const rc = rowCells[i];
      if (rc.cells.length >= minCols) {
        if (!cur) cur = { start: i, end: i, rows: [rc] };
        else { cur.end = i; cur.rows.push(rc); }
      } else {
        if (cur) {
          const allCols = new Set();
          for (const rr of cur.rows) for (const c of rr.cells) allCols.add(c.colIndex);
          tables.push({ page: p.page, columns: cols, rows: cur.rows, colCount: allCols.size, rowCount: cur.rows.length });
          cur = null;
        }
      }
    }
    if (cur) {
      const allCols = new Set();
      for (const rr of cur.rows) {
        for (const c of rr.cells) {
          for (let k = 0; k < c.span; k++) {
            const idx = Math.min(cols.length - 1, c.colIndex + k);
            allCols.add(idx);
          }
        }
      }
      const hasSpan = cur.rows.some(rr => rr.cells.some(c => c.span > 1));
      const avgSpan = (() => {
        let s = 0, n = 0;
        for (const rr of cur.rows) for (const c of rr.cells) { s += c.span; n += 1; }
        return n ? s / n : 1;
      })();
      tables.push({ page: p.page, columns: cols, rows: cur.rows, colCount: allCols.size, rowCount: cur.rows.length, hasSpan, avgSpan });
      cur = null;
    }
    for (const t of tables) {
      const colLen = t.columns.length;
      const grid = t.rows.map(r => {
        const rowArr = Array.from({ length: colLen }, () => ({ text: '', span: 0 }));
        for (const c of r.cells) {
          const start = Math.max(0, Math.min(colLen - 1, c.colIndex));
          const span = Math.max(1, Math.min(colLen - start, c.span));
          rowArr[start] = { text: c.text, span };
          for (let k = 1; k < span; k++) {
            const idx = start + k;
            if (idx < colLen) rowArr[idx] = { text: '', span: 0 };
          }
        }
        return rowArr;
      });
      result.push({ ...t, grid });
    }
  }
  return result;
}
function labelSections(normalized, options = {}) {
  const top = typeof options.top === 'number' ? options.top : 0.05;
  const bottom = typeof options.bottom === 'number' ? options.bottom : 0.95;
  const arr = Array.isArray(normalized) ? normalized : [];
  const total = arr.length;
  const header = [];
  const footer = [];
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    const yMin = Number(b?.bboxNorm?.yMin);
    const yMax = Number(b?.bboxNorm?.yMax);
    if (Number.isFinite(yMin) && yMin < top) header.push(b.blockIndex ?? i);
    if (Number.isFinite(yMax) && yMax > bottom) footer.push(b.blockIndex ?? i);
  }
  const headerCount = header.length;
  const footerCount = footer.length;
  const headerRatio = total > 0 ? headerCount / total : 0;
  const footerRatio = total > 0 ? footerCount / total : 0;
  return { headerCount, footerCount, headerRatio, footerRatio, header, footer, total };
}
async function run() {
  const targetDirArg = process.argv.find(a => a.startsWith('--dir='));
  const targetDir = targetDirArg ? targetDirArg.slice('--dir='.length) : null;
  const baseDir = targetDir ? (path.isAbsolute(targetDir) ? targetDir : path.join(ROOT, targetDir)) : listLatestReportDir();
  if (!baseDir) {
    console.error('분석 디렉터리를 찾을 수 없습니다.');
    process.exit(1);
  }
  const artifacts = path.join(baseDir, 'artifacts');
  const entries = fs.existsSync(artifacts) ? fs.readdirSync(artifacts) : [];
  const blockFiles = entries.filter(f => /^Case\d+_blocks\.json$/i.test(f));
  const inputFiles = entries.filter(f => /^Case\d+_inputs\.json$/i.test(f));
  const perCase = [];
  let blocksTotal = 0;
  let pagesTotal = 0;
  const rates = { missingText: [], zeroArea: [], negativeDims: [], missingBbox: [] };
  const avgSpans = [];
  const processed = new Set();
  for (const f of blockFiles) {
    const m = f.match(/^Case(\d+)_blocks\.json$/i);
    const caseIndex = m ? Number(m[1]) : null;
    const json = readJson(path.join(artifacts, f));
    const blocks = Array.isArray(json?.blocks) ? json.blocks : [];
    const res = analyzeBlocks(blocks);
    const tableStructures = extractTables(blocks);
    const sections = labelSections(res.normalized);
    const caseAvgSpan = Array.isArray(tableStructures) && tableStructures.length
      ? tableStructures.reduce((a, b) => a + (typeof b.avgSpan === 'number' ? b.avgSpan : 1), 0) / tableStructures.length
      : 0;
    const caseHasSpan = Array.isArray(tableStructures) ? tableStructures.some(t => !!t.hasSpan) : false;
    blocksTotal += res.stats.blocksTotal;
    pagesTotal += res.stats.pagesTotal;
    rates.missingText.push(res.stats.missingTextRate);
    rates.zeroArea.push(res.stats.zeroAreaRate);
    rates.negativeDims.push(res.stats.negativeDimsRate);
    rates.missingBbox.push(res.stats.missingBboxRate);
    const pageCoverage = res.stats.pagesTotal > 0 ? 1 : 0;
    const qualityScore = clamp01(1 - ((res.stats.missingTextRate + res.stats.zeroAreaRate + res.stats.negativeDimsRate + res.stats.missingBboxRate) / 4));
    perCase.push({
      caseIndex,
      blocks: res.stats.blocksTotal,
      pages: res.stats.pagesTotal,
      pageCoverage,
      qualityScore,
      zeroAreaRate: res.stats.zeroAreaRate,
      missingTextRate: res.stats.missingTextRate,
      negativeDimsRate: res.stats.negativeDimsRate,
      missingBboxRate: res.stats.missingBboxRate,
      tableCount: Array.isArray(tableStructures) ? tableStructures.length : 0,
      headerRate: sections.headerRatio,
      footerRate: sections.footerRatio,
      avgSpan: caseAvgSpan,
      hasSpan: caseHasSpan
    });
    avgSpans.push(caseAvgSpan);
    processed.add(caseIndex);
    const normOut = path.join(artifacts, `Case${caseIndex}_blocks_normalized.json`);
    fs.writeFileSync(normOut, JSON.stringify({ caseIndex, blocksNormalized: res.normalized }, null, 2), 'utf-8');
    const tablesOut = path.join(artifacts, `Case${caseIndex}_tables.json`);
    fs.writeFileSync(tablesOut, JSON.stringify({ caseIndex, tables: tableStructures }, null, 2), 'utf-8');
    const tablesMergedOut = path.join(artifacts, `Case${caseIndex}_tables_merged.json`);
    const mergedSummary = Array.isArray(tableStructures) ? {
      avgSpan: tableStructures.length ? tableStructures.reduce((a, b) => a + (typeof b.avgSpan === 'number' ? b.avgSpan : 1), 0) / tableStructures.length : 0,
      hasAnySpan: tableStructures.some(t => !!t.hasSpan)
    } : { avgSpan: 0, hasAnySpan: false };
    fs.writeFileSync(tablesMergedOut, JSON.stringify({ caseIndex, tables: tableStructures, summary: mergedSummary }, null, 2), 'utf-8');
    const sectionsOut = path.join(artifacts, `Case${caseIndex}_sections.json`);
    fs.writeFileSync(sectionsOut, JSON.stringify({ caseIndex, sections }, null, 2), 'utf-8');
  }
  for (const f of inputFiles) {
    const m = f.match(/^Case(\d+)_inputs\.json$/i);
    const caseIndex = m ? Number(m[1]) : null;
    if (processed.has(caseIndex)) continue;
    const js = readJson(path.join(artifacts, f));
    const files = Array.isArray(js?.files) ? js.files : [];
    const pagesSum = files.reduce((a, b) => a + (Number(b?.ocr?.pageCount) || 0), 0);
    const blocksSum = files.reduce((a, b) => a + (Number(b?.blocks) || 0), 0);
    blocksTotal += blocksSum;
    pagesTotal += pagesSum;
    rates.missingText.push(0);
    rates.zeroArea.push(0);
    rates.negativeDims.push(0);
    rates.missingBbox.push(0);
    perCase.push({
      caseIndex,
      blocks: blocksSum,
      pages: pagesSum,
      pageCoverage: 0,
      qualityScore: 0,
      zeroAreaRate: 0,
      missingTextRate: 0,
      negativeDimsRate: 0,
      missingBboxRate: 0,
      tableCount: 0,
      headerRate: 0,
      footerRate: 0,
      avgSpan: 0,
      hasSpan: false
    });
  }
  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const summary = {
    baseDir,
    caseCount: perCase.length,
    blocksTotal,
    pagesTotal,
    missingTextRateAvg: avg(rates.missingText),
    zeroAreaRateAvg: avg(rates.zeroArea),
    negativeDimsRateAvg: avg(rates.negativeDims),
    missingBboxRateAvg: avg(rates.missingBbox),
    avgSpanAvg: avg(avgSpans),
    perCase
  };
  const html = buildHtml(summary);
  const outPath = path.join(baseDir, 'offline_coord_analysis.html');
  fs.writeFileSync(outPath, html, 'utf-8');
  const stableOut = path.join(ROOT, 'reports', 'offline_coord_analysis.html');
  try {
    fs.writeFileSync(stableOut, html, 'utf-8');
  } catch {}
  console.log(outPath);
}
export { clamp01, analyzeBlocks, statsRate, buildHtml, cluster, extractTables, labelSections, listLatestReportDir };
try {
  const mainHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
  if (import.meta.url === mainHref) {
    run().catch(e => {
      console.error(e && e.message ? e.message : String(e));
      process.exit(1);
    });
  }
} catch {}
