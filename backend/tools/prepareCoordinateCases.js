import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

function ts() {
  const d = new Date();
  const iso = d.toISOString();
  return iso.replace(/[:.]/g, '-');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listDirs(p) {
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => path.join(p, d.name));
}

function pickLatestReportWithArtifacts(base) {
  if (!fs.existsSync(base)) return null;
  const dirs = listDirs(base);
  const scored = dirs.map(full => {
    const art = path.join(full, 'artifacts');
    const ok = fs.existsSync(art) && fs.readdirSync(art).some(f => /^Case\d+_blocks\.json$/i.test(f));
    const st = fs.statSync(full);
    return { full, ok, mtime: st.mtimeMs };
  }).filter(x => x.ok);
  if (!scored.length) return null;
  scored.sort((a, b) => b.mtime - a.mtime);
  return scored[0].full;
}

function readJson(fp) {
  try {
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), 'utf-8');
}

function copyFile(src, dst) {
  const buf = fs.readFileSync(src);
  fs.writeFileSync(dst, buf);
}

function uniqByLatest(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    const prev = m.get(k);
    if (!prev || (it.mtime || 0) > (prev.mtime || 0)) m.set(k, it);
  }
  return [...m.values()];
}

function collectOfflineCoordinateCases(root) {
  const out = [];
  const stampDirs = listDirs(root);
  for (const sd of stampDirs) {
    const caseDirs = listDirs(sd);
    for (const cd of caseDirs) {
      const files = fs.readdirSync(cd);
      const offlineJson = files.find(f => f.endsWith('_offline_ocr.json'));
      if (!offlineJson) continue;
      const mergedTxt = files.find(f => f.endsWith('_merged.txt'));
      const caseId = path.basename(cd);
      const offlinePath = path.join(cd, offlineJson);
      const mergedPath = mergedTxt ? path.join(cd, mergedTxt) : null;
      const st = fs.statSync(offlinePath);
      out.push({
        caseId,
        sourceDir: cd,
        offlinePath,
        mergedPath,
        mtime: st.mtimeMs,
        sourceType: 'offline_samples'
      });
    }
  }
  return uniqByLatest(out, x => x.caseId);
}

function collectBatchCoordinateBlocks(reportDir) {
  const artifacts = path.join(reportDir, 'artifacts');
  if (!fs.existsSync(artifacts)) return [];
  const files = fs.readdirSync(artifacts);
  const blocksFiles = files.filter(f => /^Case\d+_blocks\.json$/i.test(f));
  const out = [];
  for (const bf of blocksFiles) {
    const caseId = bf.replace(/^Case(\d+)_blocks\.json$/i, 'Case$1');
    const blocksPath = path.join(artifacts, bf);
    const js = readJson(blocksPath);
    const arr = Array.isArray(js?.blocks) ? js.blocks : [];
    if (!arr.length) continue;
    const txtPath = path.join(reportDir, `${caseId}_vnexsus.txt`);
    const txtExists = fs.existsSync(txtPath);
    const st = fs.statSync(blocksPath);
    out.push({
      caseId,
      sourceDir: artifacts,
      blocksPath,
      textPath: txtExists ? txtPath : null,
      mtime: st.mtimeMs,
      sourceType: 'batch_artifacts'
    });
  }
  return out;
}

function buildOfflineShapeFromBlocks(blocksJson, textStr) {
  const blocks = Array.isArray(blocksJson?.blocks) ? blocksJson.blocks : [];
  let maxPage = 0;
  for (const b of blocks) {
    const p = Number(b?.page);
    if (Number.isFinite(p) && p > maxPage) maxPage = p;
  }
  const pages = [];
  for (let i = 1; i <= maxPage; i++) pages.push({ page: i, textLength: 0 });
  return {
    text: typeof textStr === 'string' ? textStr : '',
    pageCount: maxPage,
    pages,
    blocks
  };
}

function writeCaseCoords(outRoot, item) {
  const dir = path.join(outRoot, 'coords', item.caseId);
  ensureDir(dir);
  if (item.sourceType === 'offline_samples') {
    const offlineJson = readJson(item.offlinePath);
    const offlineOut = path.join(dir, `${item.caseId}_offline_ocr.json`);
    writeJson(offlineOut, offlineJson || {});
    const txtOut = path.join(dir, `${item.caseId}_merged.txt`);
    if (item.mergedPath && fs.existsSync(item.mergedPath)) {
      copyFile(item.mergedPath, txtOut);
    } else {
      const textStr = typeof offlineJson?.text === 'string' ? offlineJson.text : '';
      fs.writeFileSync(txtOut, textStr || '', 'utf-8');
    }
    return { caseId: item.caseId, offlineJson: offlineOut, textPath: txtOut, sourceType: item.sourceType, sourceDir: item.sourceDir };
  }
  if (item.sourceType === 'batch_artifacts') {
    const blocksJson = readJson(item.blocksPath);
    const textStr = item.textPath && fs.existsSync(item.textPath) ? fs.readFileSync(item.textPath, 'utf-8') : '';
    const offlineShape = buildOfflineShapeFromBlocks(blocksJson || {}, textStr);
    const offlineOut = path.join(dir, `${item.caseId}_offline_ocr.json`);
    const txtOut = path.join(dir, `${item.caseId}_merged.txt`);
    writeJson(offlineOut, offlineShape);
    fs.writeFileSync(txtOut, offlineShape.text || '', 'utf-8');
    return { caseId: item.caseId, offlineJson: offlineOut, textPath: txtOut, sourceType: item.sourceType, sourceDir: item.sourceDir };
  }
  return null;
}

function collectBatchTextOnly(reportDir) {
  const artifacts = path.join(reportDir, 'artifacts');
  const files = fs.existsSync(artifacts) ? fs.readdirSync(artifacts) : [];
  const txtDirFiles = fs.readdirSync(reportDir);
  const cases = txtDirFiles.filter(f => /^Case\d+_vnexsus\.txt$/i.test(f)).map(f => f.replace(/^Case(\d+)_vnexsus\.txt$/i, 'Case$1'));
  const hasBlocks = new Set(files.filter(f => /^Case\d+_blocks\.json$/i.test(f)).map(f => f.replace(/^Case(\d+)_blocks\.json$/i, 'Case$1')));
  const out = [];
  for (const c of cases) {
    if (hasBlocks.has(c)) continue;
    const textPath = path.join(reportDir, `${c}_vnexsus.txt`);
    if (!fs.existsSync(textPath)) continue;
    out.push({ caseId: c, textPath, sourceDir: reportDir, sourceType: 'batch_text_only' });
  }
  return out;
}

function writeCaseTextOnly(outRoot, item) {
  const dir = path.join(outRoot, 'text_only', item.caseId);
  ensureDir(dir);
  const dst = path.join(dir, `${item.caseId}_merged.txt`);
  copyFile(item.textPath, dst);
  return { caseId: item.caseId, textPath: dst, sourceType: item.sourceType, sourceDir: item.sourceDir };
}

function main() {
  const ROOT = process.cwd();
  const offlineRoot = path.join(ROOT, 'reports', 'offline_ocr_samples');
  const batchBase = path.join(ROOT, 'backend', 'reports', 'VNEXSUS_Report');
  const outRoot = path.join(ROOT, 'reports', 'prepared_coordinate_cases', ts());
  ensureDir(path.join(outRoot, 'coords'));
  ensureDir(path.join(outRoot, 'text_only'));

  const offlineCoords = collectOfflineCoordinateCases(offlineRoot);
  const latestReport = pickLatestReportWithArtifacts(batchBase);
  const batchCoords = latestReport ? collectBatchCoordinateBlocks(latestReport) : [];
  const batchTextOnly = latestReport ? collectBatchTextOnly(latestReport) : [];

  const mergedMap = new Map();
  for (const it of offlineCoords.concat(batchCoords)) {
    const key = it.caseId;
    const prev = mergedMap.get(key);
    if (!prev || (it.mtime || 0) > (prev.mtime || 0)) mergedMap.set(key, it);
  }
  const coordsWritten = [];
  for (const it of mergedMap.values()) {
    const w = writeCaseCoords(outRoot, it);
    if (w) coordsWritten.push(w);
  }
  const textWritten = [];
  for (const it of batchTextOnly) {
    const w = writeCaseTextOnly(outRoot, it);
    if (w) textWritten.push(w);
  }
  const manifest = {
    createdAt: new Date().toISOString(),
    outputDir: outRoot,
    totals: { coords: coordsWritten.length, textOnly: textWritten.length },
    coords: coordsWritten,
    textOnly: textWritten
  };
  writeJson(path.join(outRoot, 'manifest.json'), manifest);
  console.log(JSON.stringify(manifest, null, 2));
}

try {
  const mainHref = pathToFileURL(process.argv[1] || '').href;
  if (import.meta.url === mainHref) {
    main();
  }
} catch {}
