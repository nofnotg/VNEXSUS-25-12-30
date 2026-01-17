import fs from 'fs';
import path from 'path';
import * as pdfProcessor from '../utils/pdfProcessor.js';

const ROOT = process.cwd();
const SAMPLE_BASE = path.join(ROOT, 'reports', 'offline_ocr_samples');

function pickLatestSampleDir() {
  if (!fs.existsSync(SAMPLE_BASE)) return null;
  const dirs = fs.readdirSync(SAMPLE_BASE, { withFileTypes: true }).filter(d => d.isDirectory());
  if (dirs.length === 0) return null;
  const dated = dirs.map(d => {
    const full = path.join(SAMPLE_BASE, d.name);
    const st = fs.statSync(full);
    return { name: d.name, full, mtime: st.mtimeMs };
  });
  dated.sort((a, b) => b.mtime - a.mtime);
  return dated[0].full;
}

async function main() {
  const latest = pickLatestSampleDir();
  if (!latest) {
    console.error('no_offline_samples');
    process.exit(1);
  }
  const cases = fs.readdirSync(latest, { withFileTypes: true }).filter(e => e.isDirectory());
  const first = cases[0]?.name;
  if (!first) {
    console.error('no_case_dirs');
    process.exit(1);
  }
  const jsonPath = path.join(latest, first, `${first}_offline_ocr.json`);
  if (!fs.existsSync(jsonPath)) {
    console.error('no_offline_json');
    process.exit(1);
  }
  const res = await pdfProcessor.processPdf(Buffer.from('%PDF'), { ocrOverride: jsonPath });
  const ok = !!res?.success && typeof res?.text === 'string' && res.text.length > 0 && Array.isArray(res?.blocks) && res.blocks.length > 0;
  console.log(JSON.stringify({ ok, pageCount: res?.pageCount || 0, blocks: Array.isArray(res?.blocks) ? res.blocks.length : 0, textLength: res?.text?.length || 0 }, null, 2));
}

main().catch(err => { console.error(err.message || 'error'); process.exit(1); });
