import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { generateComparisonHTML } from "../shared/utils/htmlReport.js";
import { logger } from "../shared/logging/logger.js";

function parseArgs(argv) {
  const args = { input: undefined, output: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = argv[++i];
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--title") args.title = argv[++i];
  }
  return args;
}

export async function generateHtmlFromFile(inputPath, outputPath, options = {}) {
  const absIn = resolve(process.cwd(), inputPath);
  const absOut = resolve(process.cwd(), outputPath);
  logger.info({ event: "generate_html_start", inputPath: absIn, outputPath: absOut });
  const json = readFileSync(absIn, "utf-8");
  const html = generateComparisonHTML(JSON.parse(json), options);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, html, "utf-8");
  logger.info({ event: "generate_html_done", inputPath: absIn, outputPath: absOut, bytes: Buffer.byteLength(html) });
  return html;
}

