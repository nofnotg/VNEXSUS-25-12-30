// CLI: Generate summary contract JSON from comparison results (ESM)
import fs from 'fs';
import path from 'path';
import { logger } from '../shared/logging/logger.js';
import { buildSummaryContract } from './summaryContract.js';

function parseArgs(argv) {
  const args = { input: 'results/outpatient-episodes-case-comparison.json', output: 'reports/outpatient-episodes-summary.json' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') args.input = argv[i + 1];
    if (a === '--output') args.output = argv[i + 1];
  }
  return args;
}

async function run() {
  try {
    const { input, output } = parseArgs(process.argv.slice(2));
    const inputPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
    const outputPath = path.isAbsolute(output) ? output : path.join(process.cwd(), output);

    if (!fs.existsSync(inputPath)) {
      logger.error({ event: 'summary_input_missing', path: inputPath });
      process.exit(1);
    }

    const raw = fs.readFileSync(inputPath, 'utf8');
    const data = JSON.parse(raw);
    const summary = buildSummaryContract(data);

    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
    logger.info({ event: 'summary_contract_written', output: outputPath });
  } catch (err) {
    logger.error({ event: 'summary_contract_error', message: err?.message });
    process.exit(1);
  }
}

run();

