import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as pdfProcessor from '../utils/pdfProcessor.js';
import { logService } from '../utils/logger.js';
import * as visionService from '../services/visionService.js';

const ROOT = process.cwd();
const SAMPLE_DIR = path.join(ROOT, 'sample_pdf');
const OUT_ROOT = path.join(ROOT, 'reports', 'offline_ocr_samples');
const CASE_SAMPLE_DIR = path.join(ROOT, 'src', 'rag', 'case_sample');
const DEFAULT_RAW_DIR = path.join(ROOT, 'src', 'rag', 'case_sample_raw');
const parseCliArg = (prefix) => {
  const a = process.argv.find(v => v.startsWith(prefix));
  return a ? a.slice(prefix.length) : null;
};
const cliInput = parseCliArg('--input=');
const envInput = process.env.INPUT_DIR;
const inputCandidate = envInput || cliInput;
const INPUT_DIR = inputCandidate
  ? (path.isAbsolute(inputCandidate) ? inputCandidate : path.join(ROOT, inputCandidate))
  : (fs.existsSync(SAMPLE_DIR) ? SAMPLE_DIR : DEFAULT_RAW_DIR);

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function listCaseDirs() {
  if (!fs.existsSync(INPUT_DIR)) return [];
  const entries = fs.readdirSync(INPUT_DIR, { withFileTypes: true }).filter(e => e.isDirectory());
  return entries.map(e => ({ name: e.name, full: path.join(INPUT_DIR, e.name) }));
}

function listCaseSampleTexts(limit) {
  if (!fs.existsSync(CASE_SAMPLE_DIR)) return [];
  const files = fs.readdirSync(CASE_SAMPLE_DIR, { withFileTypes: true }).filter(e => e.isFile() && /^Case\d+\.txt$/i.test(e.name));
  files.sort((a, b) => {
    const ai = Number((a.name.match(/Case(\d+)/i) || [])[1] || 0);
    const bi = Number((b.name.match(/Case(\d+)/i) || [])[1] || 0);
    return ai - bi;
  });
  const pick = files.slice(0, Math.max(1, Math.min(limit || 3, files.length)));
  return pick.map(e => {
    const id = (e.name.match(/Case(\d+)/i) || [])[1];
    return { id, name: `Case${id}`, full: path.join(CASE_SAMPLE_DIR, e.name) };
  });
}

function listPdfFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile() && /\.pdf$/i.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
    if (e.isFile() && /\.tif$/i.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
    if (e.isFile() && /\.tiff$/i.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
    if (e.isFile() && /\.(png|jpg|jpeg)$/i.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function sanitizeName(s) {
  return String(s || '').replace(/[^\w\-가-힣]/g, '_');
}

function buildPagesFromText(text, pageCount) {
  const len = typeof text === 'string' ? text.length : 0;
  const pc = Number.isFinite(pageCount) && pageCount > 0 ? pageCount : 1;
  const avg = Math.floor(len / pc);
  const pages = [];
  for (let i = 1; i <= pc; i += 1) {
    pages.push({ page: i, textLength: avg });
  }
  return pages;
}

async function processCase(caseDir) {
  const inputs = listPdfFiles(caseDir);
  if (inputs.length === 0) {
    return { ok: false, reason: 'no_pdfs' };
  }
  const useVisionEnabled = process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION !== 'false';
  let mergedText = '';
  let totalPages = 0;
  const pages = [];
  const blocks = [];
  for (const filePath of inputs) {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
      try {
        let res = await pdfProcessor.processPdf(buf, {
          useVision: false,
          skipOcr: true,
          forceOcr: false,
          collectBlocks: true,
          enableVisionImageFallback: false,
          saveTemp: false
        });
        if (!(typeof res?.text === 'string' && res.text.replace(/\s+/g, '').length > 0)) {
          res = await pdfProcessor.processPdf(buf, {
            useVision: false,
            skipOcr: false,
            forceOcr: true,
            collectBlocks: true,
            enableVisionImageFallback: false,
            saveTemp: false,
            useLocalOcr: true,
            maxOcrPages: 20
          });
        }
        const t = typeof res?.text === 'string' ? res.text : '';
        const pc = Number(res?.pageCount || 0);
        const bs = Array.isArray(res?.blocks) ? res.blocks : [];
        mergedText += `${t}\n\n`;
        const offset = totalPages;
        const curPages = buildPagesFromText(t, pc);
        curPages.forEach(p => pages.push({ page: p.page + offset, textLength: p.textLength }));
        bs.forEach(b => blocks.push({
          page: Number(b.page || 1) + offset,
          blockIndex: Number(b.blockIndex || 0),
          text: String(b.text || ''),
          bbox: b.bbox ? {
            xMin: Number(b.bbox.xMin || 0),
            yMin: Number(b.bbox.yMin || 0),
            xMax: Number(b.bbox.xMax || 0),
            yMax: Number(b.bbox.yMax || 0),
            width: Number(b.bbox.width || 0),
            height: Number(b.bbox.height || 0)
          } : { xMin: 0, yMin: 0, xMax: 1, yMax: 1, width: 1, height: 1 },
          vertices: Array.isArray(b.vertices) ? b.vertices : [],
          confidence: typeof b.confidence === 'number' ? b.confidence : undefined,
          synthetic: b.synthetic === true
        }));
        totalPages += pc > 0 ? pc : 0;
      } catch {
      }
    } else {
      try {
        let text = '';
        let conf = undefined;
        try {
          const ocr = await visionService.extractTextFromImage(buf);
          text = typeof ocr?.text === 'string' ? ocr.text : '';
          conf = typeof ocr?.confidence === 'number' ? ocr.confidence : undefined;
        } catch {
        }
        if (!text || text.replace(/\s+/g, '').length === 0) {
          try {
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker();
            try {
              const langRaw = typeof process.env.LOCAL_OCR_LANG === 'string' && process.env.LOCAL_OCR_LANG.trim().length > 0 ? process.env.LOCAL_OCR_LANG.trim() : 'kor+eng';
              await worker.loadLanguage(langRaw);
              await worker.initialize(langRaw);
              const rec = await worker.recognize(buf);
              text = (typeof rec?.data?.text === 'string' ? rec.data.text : '').trim();
            } finally {
              await worker.terminate();
            }
          } catch {
          }
        }
        const t = typeof text === 'string' ? text : '';
        mergedText += `${t}\n\n`;
        const page = totalPages + 1;
        pages.push({ page, textLength: t.length });
        blocks.push({
          page,
          blockIndex: 0,
          text: t.slice(0, 1024),
          bbox: { xMin: 0, yMin: 0, xMax: 1, yMax: 1, width: 1, height: 1 },
          vertices: [],
          confidence: conf,
          synthetic: true
        });
        totalPages += 1;
      } catch {
      }
    }
  }
  mergedText = mergedText.trim();
  const out = {
    text: mergedText,
    pageCount: totalPages > 0 ? totalPages : 1,
    pages,
    blocks,
    rawFiles: [],
    rawPrefix: 'offline_ocr'
  };
  return { ok: mergedText.length > 0, result: out, mergedText };
}

async function main() {
  const args = process.argv.slice(2);
  const argMap = Object.fromEntries(args.map(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) return [m[1], m[2]];
    return [a.replace(/^--/, ''), true];
  }));
  const limit = Number(argMap.limit || 3);
  const namesArg = String(argMap.cases || '').trim();
  const fromCaseSample = String(argMap.fromCaseSample || '').toLowerCase() === 'true';
  const skipCsv = String(argMap.skipCsv || '').toLowerCase() === 'true';
  const skipReport = String(argMap.skipReport || '').toLowerCase() === 'true';
  const pickNames = namesArg ? namesArg.split(',').map(s => s.trim()).filter(Boolean) : null;
  const all = fromCaseSample ? listCaseSampleTexts(limit) : listCaseDirs();
  const targets = pickNames ? all.filter(d => pickNames.includes(d.name)) : all.slice(0, Math.max(1, Math.min(limit, all.length)));
  ensureDir(OUT_ROOT);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(OUT_ROOT, ts);
  ensureDir(outDir);
  const outputs = [];
  for (const t of targets) {
    const name = sanitizeName(t.name);
    const caseOut = path.join(outDir, name);
    ensureDir(caseOut);
    try {
      let r;
      if (fromCaseSample) {
        const raw = fs.readFileSync(t.full, 'utf-8');
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const pc = Math.max(1, Math.ceil(lines.length / 200));
        const perPage = Math.ceil(lines.length / pc);
        const pages = [];
        const blocks = [];
        for (let i = 0; i < pc; i += 1) {
          const slice = lines.slice(i * perPage, (i + 1) * perPage);
          const tl = slice.join('\n').length;
          pages.push({ page: i + 1, textLength: tl });
          for (let j = 0; j < slice.length; j += 1) {
            blocks.push({
              page: i + 1,
              blockIndex: j,
              text: slice[j],
              bbox: { xMin: 0, yMin: j, xMax: 1, yMax: j + 1, width: 1, height: 1 },
              vertices: [],
              confidence: undefined,
              synthetic: true
            });
          }
        }
        const out = {
          text: raw,
          pageCount: pc,
          pages,
          blocks,
          rawFiles: [],
          rawPrefix: 'offline_ocr_case_sample'
        };
        r = { ok: raw.replace(/\s+/g, '').length > 0, result: out, mergedText: raw };
      } else {
        r = await processCase(t.full);
      }
      if (!r.ok) {
        outputs.push({ name, ok: false, reason: r.reason || 'empty_text' });
        continue;
      }
      const jsonPath = path.join(caseOut, `${name}_offline_ocr.json`);
      const txtPath = path.join(caseOut, `${name}_merged.txt`);
      fs.writeFileSync(jsonPath, JSON.stringify(r.result, null, 2), 'utf-8');
      fs.writeFileSync(txtPath, r.mergedText, 'utf-8');
      let reportJsonPath = null;
      let reportTxtPath = null;
      if (!skipReport) {
        reportJsonPath = path.join(caseOut, `${name}_report.json`);
        reportTxtPath = path.join(caseOut, `${name}_report.txt`);
        fs.writeFileSync(reportJsonPath, JSON.stringify({ text: r.result.text, pageCount: r.result.pageCount, pages: r.result.pages, blocks: r.result.blocks }, null, 2), 'utf-8');
        fs.writeFileSync(reportTxtPath, r.mergedText, 'utf-8');
      }
      if (!skipCsv) {
        const csvPath = path.join(caseOut, `${name}_blocks.csv`);
        const toCsv = (blocks) => {
          const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
          const rows = [
            ['page','blockIndex','text','xMin','yMin','xMax','yMax','width','height','confidence','synthetic'].join(',')
          ];
          for (const b of blocks) {
            const bb = b.bbox || {};
            rows.push([
              b.page ?? '',
              b.blockIndex ?? '',
              esc(b.text ?? ''),
              bb.xMin ?? '',
              bb.yMin ?? '',
              bb.xMax ?? '',
              bb.yMax ?? '',
              bb.width ?? '',
              bb.height ?? '',
              typeof b.confidence === 'number' ? b.confidence : '',
              b.synthetic === true ? 'true' : 'false'
            ].join(','));
          }
          return rows.join('\n');
        };
        fs.writeFileSync(csvPath, toCsv(r.result.blocks), 'utf-8');
      }
      outputs.push({ name, ok: true, jsonPath, txtPath, reportJsonPath, reportTxtPath, pageCount: r.result.pageCount, blocks: r.result.blocks.length, textLength: r.mergedText.length });
    } catch (e) {
      outputs.push({ name, ok: false, reason: e.message });
    }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ ts, outputs }, null, 2), 'utf-8');
  logService.info(`[offline-ocr] outputs at ${outDir}`);
}

main().catch(err => { logService.error(`[offline-ocr] failed: ${err.message}`); process.exit(1); });
