import fs from 'fs';
import path from 'path';
import url from 'url';

const ROOT = process.cwd();
const CASE_SAMPLE_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');
const OUT_BASE = path.join(ROOT, 'reports', 'offline_ocr_samples');
const TS = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_DIR = path.join(OUT_BASE, TS);

function parseCasesArg() {
  const raw = process.argv.find(a => a.startsWith('--cases='))?.slice('--cases='.length) || '';
  if (!raw) return Array.from({ length: 46 }, (_, i) => i + 1);
  return raw.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
}

function safeRead(p) {
  try {
    if (!p || !fs.existsSync(p)) return '';
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

function buildBlocks(text, pageCount) {
  const raw = typeof text === 'string' ? text : '';
  const pc = Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 1;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const perPage = Math.ceil(lines.length / pc);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const page = Math.floor(i / perPage) + 1;
    const li = i % perPage;
    const len = lines[i].length;
    const width = Math.min(1, Math.max(0.1, len / 120));
    const height = 1;
    blocks.push({
      page,
      blockIndex: li,
      text: lines[i],
      bbox: { xMin: 0, yMin: li, xMax: width, yMax: li + height, width, height },
      vertices: [],
      confidence: undefined,
      synthetic: true
    });
  }
  return blocks;
}

function estimatePages(text) {
  const len = (text || '').length;
  if (!len) return 1;
  const approxPages = Math.max(1, Math.ceil(len / 4000));
  return approxPages;
}

function buildPages(text, pageCount) {
  const raw = typeof text === 'string' ? text : '';
  const pc = Number.isFinite(pageCount) && pageCount > 0 ? Math.floor(pageCount) : 1;
  if (pc === 1) return [{ page: 1, textLength: raw.length }];
  const per = Math.ceil(raw.length / pc);
  const out = [];
  for (let p = 1; p <= pc; p += 1) {
    const start = (p - 1) * per;
    const end = Math.min(raw.length, p * per);
    out.push({ page: p, textLength: raw.slice(start, end).length });
  }
  return out;
}

function pickMergedText(caseNum) {
  const candidates = [
    path.join(CASE_SAMPLE_DIR, `Case${caseNum}.txt`),
    path.join(CASE_SAMPLE_DIR, `Case${caseNum}_vnexsus.txt`)
  ];
  for (const p of candidates) {
    const t = safeRead(p).trim();
    if (t.length > 0) return t;
  }
  return '';
}

function main() {
  const cases = parseCasesArg();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const created = [];
  for (const n of cases) {
    const merged = pickMergedText(n);
    const dir = path.join(OUT_DIR, `Case${n}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `Case${n}_merged.txt`), merged, 'utf-8');
    const pages = estimatePages(merged);
    const json = {
      text: merged,
      pageCount: pages,
      pages: buildPages(merged, pages),
      blocks: buildBlocks(merged, pages)
    };
    fs.writeFileSync(path.join(dir, `Case${n}_offline_ocr.json`), JSON.stringify(json, null, 2), 'utf-8');
    created.push({ case: n, dir });
  }
  console.log(JSON.stringify({ outDir: OUT_DIR, created }, null, 2));
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}
