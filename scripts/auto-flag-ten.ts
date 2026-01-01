import fs from "fs";
import path from "path";

const readJSON = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));
const safeExists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

const main = () => {
  const metricsPath = path.resolve(process.cwd(), "outputs/ten-report/_metrics.json");
  const diffPath = path.resolve(process.cwd(), "outputs/ten-report/_golden_diff.json");
  const metrics = safeExists(metricsPath) ? readJSON(metricsPath) : {};
  const diff = safeExists(diffPath) ? readJSON(diffPath) : {};
  const avgScorePct = metrics?.totals?.avgScorePercent || 0;
  const dateValid = metrics?.totals?.dateValidRate || 0;
  const okCases = (diff?.cases || []).filter((c: any) => c.ok === true).length;
  const allCases = (diff?.cases || []).length || 1;
  const goldenOkRate = okCases / allCases;
  const recommend = avgScorePct >= 50 && dateValid >= 0.99 && goldenOkRate >= 0.9;
  const lines: string[] = [];
  lines.push(`# Recommendations`);
  lines.push(`- AvgScore%: ${avgScorePct}%`);
  lines.push(`- DateValidRate: ${dateValid}`);
  lines.push(`- GoldenOKRate: ${Number((goldenOkRate * 100).toFixed(1))}%`);
  lines.push(`- Recommend FEAT_TEN_ITEM: ${recommend ? "true" : "false"}`);
  fs.writeFileSync(path.resolve(process.cwd(), "outputs/ten-report/_recommendations.md"), lines.join("\n"), "utf-8");
  console.log("Recommendations written at outputs/ten-report/_recommendations.md");
};

main();

