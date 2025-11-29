// CLI: Generate CSV from comparison JSON
// Usage:
//   node src/scripts/generateComparisonCsv.js --input results/outpatient-episodes-case-comparison.json --output reports/outpatient-episodes-case-comparison.csv [--no-hospitals-normalized]

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateComparisonCSV } from '../shared/utils/csvReport.js';
import { logger } from '../shared/logging/logger.js';

function parseArgs(argv) {
  const out = { input: '', output: '', includeHospitalsNormalized: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [keyRaw, valRaw] = a.split('=');
      const key = keyRaw.replace(/^--/, '');
      if (key === 'input') {
        out.input = valRaw ?? argv[++i] ?? '';
      } else if (key === 'output') {
        out.output = valRaw ?? argv[++i] ?? '';
      } else if (key === 'no-hospitals-normalized') {
        out.includeHospitalsNormalized = false;
      }
    }
  }
  return out;
}

export async function generateCsvFromFile(inputPath, outputPath, options = {}) {
  try {
    logger.info({ event: 'generate_csv_start', inputPath, outputPath });
    const jsonText = await readFile(inputPath, 'utf-8');
    const data = JSON.parse(jsonText);
    const csv = generateComparisonCSV(data, options);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, csv, 'utf-8');
    logger.info({ event: 'generate_csv_done', inputPath, outputPath, bytes: csv.length });
    return { bytes: csv.length };
  } catch (err) {
    logger.error({ event: 'generate_csv_error', message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input || 'results/outpatient-episodes-case-comparison.json';
  const output = args.output || 'reports/outpatient-episodes-case-comparison.csv';
  const opts = { includeHospitalsNormalized: args.includeHospitalsNormalized };
  await generateCsvFromFile(input, output, opts);
}

// Execute only if run directly
const isMain = process.argv[1] && process.argv[1].endsWith('generateComparisonCsv.js');
if (isMain) {
  main().catch(() => process.exit(1));
}

