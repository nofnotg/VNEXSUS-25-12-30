import { generateHtmlFromFile } from "./generateComparisonHtml.js";
import { logger } from "../shared/logging/logger.js";

function parseArgs(argv) {
  const args = { input: undefined, output: undefined, title: undefined, locale: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = argv[++i];
    else if (a === "--output") args.output = argv[++i];
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--locale") args.locale = argv[++i];
  }
  return args;
}

const { input = "results/outpatient-episodes-case-comparison.json", output = "reports/outpatient-episodes-case-comparison.html", title, locale } = parseArgs(process.argv.slice(2));

generateHtmlFromFile(input, output, { title, locale }).catch(err => {
  logger.error({ event: "generate_html_error", message: err?.message, stack: err?.stack });
  process.exit(1);
});
