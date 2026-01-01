import fs from "fs";
import path from "path";

const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));
const safeExists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

const toArr = (rep: any) => (Array.isArray(rep) ? rep : Array.isArray(rep.items) ? rep.items : []);
const tagFreq = (arr: any[]) => {
  const m = new Map<string, number>();
  for (const ev of arr) {
    const tags: string[] = ev.meta?.tags || [];
    for (const t of tags) m.set(t, (m.get(t) || 0) + 1);
  }
  return m;
};
const freqDiff = (a: Map<string, number>, b: Map<string, number>) => {
  const keys = new Set<string>([...a.keys(), ...b.keys()]);
  let sum = 0;
  for (const k of keys) {
    sum += Math.abs((a.get(k) || 0) - (b.get(k) || 0));
  }
  return sum;
};

const main = () => {
  const outRoot = process.argv[2] || "outputs/ten-report";
  const gRoot = path.resolve(process.cwd(), outRoot, "golden");
  if (!safeExists(gRoot)) {
    console.log("No golden directory");
    return;
  }
  const cases = fs.readdirSync(gRoot);
  const results: any[] = [];
  for (const c of cases) {
    const gJson = path.join(gRoot, c, "report.json");
    const curJson = path.join(outRoot, c, "report.json");
    if (!(safeExists(gJson) && safeExists(curJson))) {
      results.push({ caseId: c, status: "missing" });
      continue;
    }
    const a = toArr(read(gJson));
    const b = toArr(read(curJson));
    const aDates = new Set<string>(a.map((x: any) => String(x.date || "")));
    const bDates = new Set<string>(b.map((x: any) => String(x.date || "")));
    const dateUnion = new Set<string>([...aDates, ...bDates]);
    let dateMismatch = 0;
    for (const d of dateUnion) {
      const inA = aDates.has(d);
      const inB = bDates.has(d);
      if (inA !== inB) dateMismatch++;
    }
    const tagDiff = freqDiff(tagFreq(a), tagFreq(b));
    const lengthDiff = Math.abs(a.length - b.length);
    const ok = dateMismatch === 0 && tagDiff === 0 && lengthDiff === 0;
    results.push({ caseId: c, ok, lengthDiff, dateMismatch, tagDiff });
  }
  const out = { cases: results };
  fs.writeFileSync(path.resolve(process.cwd(), outRoot, "_golden_diff.json"), JSON.stringify(out, null, 2), "utf-8");
  const lines = results
    .map(r => `- ${r.caseId}: ok=${r.ok} lengthDiff=${r.lengthDiff} dateMismatch=${r.dateMismatch} tagDiff=${r.tagDiff}`)
    .join("\n");
  fs.writeFileSync(path.resolve(process.cwd(), outRoot, "_golden_diff.md"), `# Golden Diff\n${lines}\n`, "utf-8");
  console.log(`Golden diff written at ${path.resolve(process.cwd(), outRoot)}`);
};

main();

