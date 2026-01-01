import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const run = (cmdline: string) => {
  const r = spawnSync(cmdline, { stdio: "inherit", shell: true });
  if (r.status !== 0) throw new Error(`${cmdline} failed`);
};
const readJSON = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));
const safeExists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

const main = () => {
  run("npm run ten:all");
  run("npm run ten:sweep");
  const metricsPath = path.resolve(process.cwd(), "outputs/ten-report/_metrics.json");
  const diffPath = path.resolve(process.cwd(), "outputs/ten-report/_golden_diff.json");
  const sweepPath = path.resolve(process.cwd(), "outputs/sweep/_sweep.json");
  const metrics = safeExists(metricsPath) ? readJSON(metricsPath) : {};
  const diff = safeExists(diffPath) ? readJSON(diffPath) : {};
  const sweep = safeExists(sweepPath) ? readJSON(sweepPath) : {};
  const lines: string[] = [];
  lines.push(`# Dashboard`);
  lines.push(`- Cases: ${metrics?.totals?.cases}`);
  lines.push(`- Events: ${metrics?.totals?.events}`);
  lines.push(`- AvgScore: ${metrics?.totals?.avgScore}`);
  lines.push(`- AvgScore%: ${metrics?.totals?.avgScorePercent}%`);
  lines.push(`- DateValidRate: ${metrics?.totals?.dateValidRate}`);
  lines.push(`\n## Golden Diff Status`);
  const okCases = (diff?.cases || []).filter((c: any) => c.ok === true).length;
  const allCases = (diff?.cases || []).length;
  lines.push(`- OK: ${okCases}/${allCases}`);
  lines.push(`\n## Sweep Summary`);
  for (const r of sweep?.sweep || []) {
    lines.push(`- ${r.dir}: events=${r.events} avgScore=${r.avgScore} avgScore%=${r.avgScorePercent}%`);
  }
  fs.writeFileSync(path.resolve(process.cwd(), "outputs/_dashboard.md"), lines.join("\n"), "utf-8");
  console.log("Dashboard written at outputs/_dashboard.md");
};

main();

