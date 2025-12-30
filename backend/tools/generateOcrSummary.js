import fs from 'fs';
import path from 'path';

function listDirs(p) {
  try {
    const entries = fs.readdirSync(p, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => ({ name: e.name, full: path.join(p, e.name), mtime: fs.statSync(path.join(p, e.name)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
  } catch {
    return [];
  }
}

function resolveLatestOutDir(base) {
  const dirs = listDirs(base);
  return dirs.length ? dirs[0].full : null;
}

function readJson(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function escCsv(s) {
  return `"${String(s ?? '').replace(/"/g, '""')}"`;
}

function buildSummary(manifest, outDir) {
  const rows = [
    ['caseIndex','caseName','ok','reason','mergedEffectiveLen','vnexsusEffectiveLen','blocksTotal','pagesWithBbox','blocksWithBbox','sampleOut','vnexsusOut','artifactsBlocksCsv','artifactsBlocksJson'].join(',')
  ];
  const items = Array.isArray(manifest?.processed) ? manifest.processed : [];
  for (const p of items) {
    const caseIndex = p?.caseIndex ?? '';
    const artifactsDir = path.join(outDir, 'artifacts');
    const blocksCsv = path.join(artifactsDir, `Case${caseIndex}_blocks.csv`);
    const blocksJson = path.join(artifactsDir, `Case${caseIndex}_blocks.json`);
    const hasCsv = fs.existsSync(blocksCsv) ? blocksCsv : '';
    const hasJson = fs.existsSync(blocksJson) ? blocksJson : '';
    const coord = p?.coverage?.coordinates || {};
    rows.push([
      caseIndex,
      escCsv(p?.caseName ?? ''),
      p?.ok ? 'true' : 'false',
      escCsv(p?.reason ?? ''),
      p?.effectiveLengths?.merged ?? '',
      p?.effectiveLengths?.vnexsus ?? '',
      p?.ocr?.blocks?.total ?? '',
      coord.pagesWithBbox ?? '',
      coord.blocksWithBbox ?? '',
      escCsv(p?.sampleOut ?? ''),
      escCsv(p?.vnexsusOut ?? ''),
      escCsv(hasCsv),
      escCsv(hasJson)
    ].join(','));
  }
  return rows.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const argDir = args.find(a => a.startsWith('--dir='))?.slice('--dir='.length) || '';
  const ROOT = process.cwd();
  const vnexsusBase = path.join(ROOT, 'reports', 'VNEXSUS_Report');
  const pickedOutDir = argDir ? (path.isAbsolute(argDir) ? argDir : path.join(ROOT, argDir)) : resolveLatestOutDir(vnexsusBase);
  if (!pickedOutDir) {
    process.stderr.write('no_output_dir\n');
    process.exit(1);
  }
  const manifestPath = path.join(pickedOutDir, 'manifest.json');
  const manifest = readJson(manifestPath);
  if (!manifest) {
    process.stderr.write('manifest_missing\n');
    process.exit(1);
  }
  const summaryCsv = buildSummary(manifest, pickedOutDir);
  fs.writeFileSync(path.join(pickedOutDir, 'summary.csv'), summaryCsv, 'utf-8');
  fs.writeFileSync(path.join(pickedOutDir, 'summary.json'), JSON.stringify({ ts: manifest.ts, outDir: pickedOutDir, total: Array.isArray(manifest.processed) ? manifest.processed.length : 0 }, null, 2), 'utf-8');
  process.stdout.write(`summary at ${pickedOutDir}\n`);
}

main().catch(err => { process.stderr.write(String(err?.message || 'error')); process.exit(1); });
