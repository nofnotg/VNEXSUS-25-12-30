import fs from "fs";
import path from "path";
import { loadBindInputFromFile } from "../src/modules/medical-events/service/preparedOcrLoader";
import { runMedicalEventReport } from "../src/modules/medical-events/service/pipelineAdapter";

const root = process.argv[2] || "C:\\VNEXSUS_reports_pdf";
const outRoot = process.argv[3] || "outputs/ten-report";

const listFiles = (dir: string) => {
  const exts = [".json", ".ndjson", ".csv"];
  const entries = fs.readdirSync(dir).map(n => path.join(dir, n));
  const files: string[] = [];
  for (const e of entries) {
    const stat = fs.statSync(e);
    if (stat.isDirectory()) files.push(...listFiles(e));
    else if (exts.includes(path.extname(e).toLowerCase())) {
      const bn = path.basename(e).toLowerCase();
      if (bn.includes("offline_ocr") || bn.includes("_blocks") || bn.includes("core_engine_report")) {
        if (!bn.startsWith("manifest")) files.push(e);
      }
    }
  }
  return files;
};

const countDateCandidates = (text: string) => {
  const re = /(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})|(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  return Array.from(text.matchAll(re)).length;
};

const main = () => {
  const files = listFiles(root);
  const summary: any = { cases: [], totals: { count: 0, events: 0, avgScore: 0 } };
  for (const f of files) {
    const caseId = path.basename(f).replace(path.extname(f), "");
    try {
      const input = loadBindInputFromFile(f);
      const res = runMedicalEventReport(input, { outputPath: path.resolve(process.cwd(), outRoot, caseId) });
      const avgScore =
        res.events.length > 0
          ? res.events.reduce((a, b) => a + Number(b.meta?.score ?? 0), 0) / res.events.length
          : 0;
      const blocksCount = (input.blocks || []).length;
      const datesCount = (input.dates || []).length;
      const textSample = (input.blocks || []).slice(0, 5).map(b => b.text).join(" ");
      const candidateCount = countDateCandidates(textSample);
      const preview = res.events
        .slice(0, 5)
        .map(e => ({ date: e.date, tags: e.meta?.tags || [], score: e.meta?.score || 0 }));
      summary.cases.push({
        caseId,
        events: res.events.length,
        avgScore: Number(avgScore.toFixed(3)),
        avgScorePercent: Number((avgScore * 100).toFixed(1)),
        blocks: blocksCount,
        dates: datesCount,
        dateCandidateSample: candidateCount,
        preview,
      });
    } catch (e: any) {
      summary.cases.push({ caseId, error: e?.message || String(e) });
    }
  }
  summary.totals.count = summary.cases.filter((c: any) => !c.error).length;
  const allEvents = summary.cases.filter((c: any) => c.events).reduce((a: number, c: any) => a + c.events, 0);
  summary.totals.events = allEvents;
  const scores = summary.cases.filter((c: any) => typeof c.avgScore === "number").map((c: any) => c.avgScore);
  summary.totals.avgScore = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3)) : 0;
  fs.mkdirSync(path.resolve(process.cwd(), outRoot), { recursive: true });
  fs.writeFileSync(path.resolve(process.cwd(), outRoot, "_summary.json"), JSON.stringify(summary, null, 2), "utf-8");
  console.log(`Processed ${summary.totals.count} cases. Summary at ${path.resolve(process.cwd(), outRoot, "_summary.json")}`);
};

main();

