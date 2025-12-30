import fs from 'fs';
import path from 'path';
import sourceSpanManager from '../postprocess/sourceSpanManager.js';

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
  const base = pickLatestSampleDir();
  if (!base) {
    console.error('no_offline_samples');
    process.exit(1);
  }
  const dirs = fs.readdirSync(base, { withFileTypes: true }).filter(e => e.isDirectory());
  let picked = null;
  for (const d of dirs) {
    const dir = path.join(base, d.name);
    const files = fs.readdirSync(dir).filter(n => /_offline_ocr\.json$/i.test(n));
    if (files.length > 0) { picked = { name: d.name, dir, json: path.join(dir, files[0]) }; break; }
  }
  if (!picked) {
    console.error('no_offline_json');
    process.exit(1);
  }
  const txtPath = path.join(picked.dir, `${picked.name}_merged.txt`);
  const inject = JSON.parse(fs.readFileSync(picked.json, 'utf-8'));
  const rawText = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf-8') : String(inject?.text || '');
  const b0 = Array.isArray(inject?.blocks) && inject.blocks.length > 0 ? inject.blocks[0] : null;
  const allBlocks = Array.isArray(inject?.blocks) ? inject.blocks : [];
  const block = b0 ? { ...b0, rawText: String(b0.text || '') } : null;
  const event = { id: 'temp', date: '날짜미상', hospital: '병원명 미상', diagnosis: { name: '', code: null }, procedures: [] };
  const span = sourceSpanManager.attachSourceSpan(event, rawText, block, allBlocks);
  const ok = !!span?.textPreview && span.textPreview.length > 0;
  console.log(JSON.stringify({ ok, previewLen: span?.textPreview?.length || 0, confidence: span?.confidence || 0, missingReason: span?.missingReason || null }, null, 2));
}

main().catch(err => { console.error(err.message || 'error'); process.exit(1); });
