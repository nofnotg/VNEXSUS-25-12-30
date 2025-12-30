import fs from 'fs';
import path from 'path';

function normalizeDateKR(s) {
  const str = String(s || '').trim();
  if (!str) return '';
  const m1 = str.match(/^(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})/);
  if (m1) return `${m1[1]}.${String(m1[2]).padStart(2, '0')}.${String(m1[3]).padStart(2, '0')}`;
  const m2 = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m2) return `${m2[1]}.${m2[2]}.${m2[3]}`;
  return str;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = `${String(it.name || '').toLowerCase().replace(/\s+/g, ' ').trim()}|${normalizeDateKR(it.date || '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...it, date: normalizeDateKR(it.date || '') });
  }
  return out;
}

function pickLatestOfflineDir(base) {
  const dirs = fs.readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
  if (dirs.length === 0) return null;
  const dated = dirs.map(d => {
    const full = path.join(base, d.name);
    const st = fs.statSync(full);
    return { name: d.name, full, mtime: st.mtimeMs };
  });
  dated.sort((a, b) => b.mtime - a.mtime);
  return dated[0].full;
}

async function main() {
  const base = path.join(process.cwd(), 'reports', 'offline_ocr_samples');
  const latest = pickLatestOfflineDir(base);
  if (!latest) {
    console.error('no_offline_dir');
    process.exit(1);
  }
  const cases = fs.readdirSync(latest, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
  const name = cases[0];
  const jsonPath = path.join(latest, name, `${name}_offline_ocr.json`);
  const inject = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const blocks = Array.isArray(inject?.blocks) ? inject.blocks : [];
  const tests = blocks.slice(0, 100).map(b => {
    const m = String(b.text || '').match(/([가-힣A-Za-z ]+)(?:,?\\s*)(\\d{4}[.\\-\\/]\\d{1,2}[.\\-\\/]\\d{1,2}|\\d{8})?/);
    return { name: m ? m[1] : String(b.text || '').slice(0, 20), date: m ? m[2] : '' };
  });
  const deduped = dedupe(tests);
  const html = `<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\" /><title>날짜 정규화·중복 제거 테스트</title></head><body>
  <h1>원본 ${tests.length} → 정규화 후 ${deduped.length}</h1>
  <ul>${deduped.map(t => `<li>${t.name} — ${t.date}</li>`).join('')}</ul>
  </body></html>`;
  fs.writeFileSync(path.join(latest, 'date_normalize_dedupe_test.html'), html, 'utf-8');
  console.log(JSON.stringify({ case: name, before: tests.length, after: deduped.length }, null, 2));
}

main().catch(err => { console.error(err.message || 'error'); process.exit(1); });
