import fs from "fs";
import path from "path";

type CaseSummary = { caseId: string; events?: number; avgScore?: number; blocks?: number; dates?: number; dateCandidateSample?: number; preview?: Array<{ date: string; tags: string[]; score: number }>; error?: string };

const readJSON = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));
const safeExists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};
const listCaseDirs = (root: string) => {
  const dirs: string[] = [];
  if (!safeExists(root)) return dirs;
  const entries = fs.readdirSync(root);
  for (const e of entries) {
    const full = path.join(root, e);
    try {
      const st = fs.statSync(full);
      if (st.isDirectory()) dirs.push(full);
    } catch {}
  }
  return dirs;
};

const slotKeys = ["visitDate", "visitReason", "diagnosis", "examination", "pathology", "treatment", "outpatientPeriod", "admissionPeriod", "pastHistory", "doctorOpinion"] as const;

const main = () => {
  const outRoot = process.argv[2] || "outputs/ten-report";
  const summaryPath = path.resolve(process.cwd(), outRoot, "_summary.json");
  const summary = safeExists(summaryPath) ? readJSON(summaryPath) : { cases: [] };
  const cases: CaseSummary[] = summary.cases || [];
  const caseDirs = listCaseDirs(path.resolve(process.cwd(), outRoot));
  const metrics: any = { totals: { cases: cases.length, ok: 0, errors: 0, events: 0, avgScore: 0, avgScorePercent: 0, dateValidRate: 0, tagFrequency: {} }, byCase: [] };
  let totalScore = 0;
  let totalValidDates = 0;
  let totalDates = 0;
  const tagTotals = new Map<string, number>();
  for (const c of cases) {
    const dir = path.resolve(process.cwd(), outRoot, c.caseId);
    const jsonPath = path.join(dir, "report.json");
    const mdPath = path.join(dir, "report.md");
    const htmlPath = path.join(dir, "report.html");
    const formatOk = safeExists(jsonPath) && safeExists(mdPath) && safeExists(htmlPath);
    const item: any = { caseId: c.caseId, events: c.events || 0, avgScore: c.avgScore || 0, formatOk };
    if (formatOk) {
      try {
        const rep = readJSON(jsonPath);
        const arr = Array.isArray(rep) ? rep : Array.isArray(rep.items) ? rep.items : [];
        let slotFill = 0;
        let slotTotal = 0;
        let caseValidDates = 0;
        let caseDates = 0;
        const tagFreqMap = new Map<string, number>();
        for (const ev of arr) {
          const d = String(ev.date || "");
          caseDates += 1;
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) caseValidDates += 1;
          for (const k of slotKeys) {
            slotTotal += 1;
            const v = ev.items?.[k as any];
            const filled = Array.isArray(v) ? v.length > 0 : !!v;
            if (filled) slotFill += 1;
          }
          const tags: string[] = ev.meta?.tags || [];
          for (const t of tags) {
            tagFreqMap.set(t, (tagFreqMap.get(t) || 0) + 1);
            tagTotals.set(t, (tagTotals.get(t) || 0) + 1);
          }
        }
        item.slotFillRate = slotTotal ? Number((slotFill / slotTotal).toFixed(3)) : 0;
        item.dateValidRate = caseDates ? Number((caseValidDates / caseDates).toFixed(3)) : 0;
        item.tagFrequency = Object.fromEntries(tagFreqMap.entries());
        totalValidDates += caseValidDates;
        totalDates += caseDates;
      } catch {}
    } else {
      item.slotFillRate = 0;
      item.dateValidRate = 0;
    }
    metrics.byCase.push(item);
    if (c.error) metrics.totals.errors += 1;
    else metrics.totals.ok += 1;
    metrics.totals.events += c.events || 0;
    totalScore += c.avgScore || 0;
  }
  metrics.totals.avgScore = cases.length ? Number((totalScore / cases.length).toFixed(3)) : 0;
  metrics.totals.avgScorePercent = Number((metrics.totals.avgScore * 100).toFixed(1));
  metrics.totals.dateValidRate = totalDates ? Number((totalValidDates / totalDates).toFixed(3)) : 0;
  metrics.totals.tagFrequency = Object.fromEntries(tagTotals.entries());
  const mdLines: string[] = [];
  mdLines.push(`# Ten-Report Metrics`);
  mdLines.push(`- Cases: ${metrics.totals.cases}`);
  mdLines.push(`- OK: ${metrics.totals.ok}`);
  mdLines.push(`- Errors: ${metrics.totals.errors}`);
  mdLines.push(`- Events: ${metrics.totals.events}`);
  mdLines.push(`- AvgScore: ${metrics.totals.avgScore}`);
  mdLines.push(`- AvgScore%: ${metrics.totals.avgScorePercent}%`);
  mdLines.push(`- DateValidRate: ${metrics.totals.dateValidRate}`);
  const topTags = Object.entries(metrics.totals.tagFrequency).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10);
  mdLines.push(`\n## Top Tags`);
  for (const [tag, cnt] of topTags) mdLines.push(`- ${tag}: ${cnt}`);
  const top = [...metrics.byCase].sort((a, b) => (b.events || 0) - (a.events || 0)).slice(0, 10);
  mdLines.push(`\n## Top 10 by events`);
  for (const t of top) {
    mdLines.push(`- ${t.caseId}: events=${t.events}, score=${t.avgScore}, slotFillRate=${t.slotFillRate}, formatOk=${t.formatOk}`);
  }
  fs.writeFileSync(path.resolve(process.cwd(), outRoot, "_metrics.json"), JSON.stringify(metrics, null, 2), "utf-8");
  fs.writeFileSync(path.resolve(process.cwd(), outRoot, "_metrics.md"), mdLines.join("\n"), "utf-8");
  console.log(`Metrics written at ${path.resolve(process.cwd(), outRoot)}`);
};

main();

