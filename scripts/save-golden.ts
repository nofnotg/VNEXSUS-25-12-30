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
const copy = (src: string, dest: string) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
};

const main = () => {
  const outRoot = process.argv[2] || "outputs/ten-report";
  const summaryPath = path.resolve(process.cwd(), outRoot, "_summary.json");
  if (!safeExists(summaryPath)) {
    console.log("No summary found");
    return;
  }
  const summary = readJSON(summaryPath);
  const cases = (summary.cases || []).filter((c: any) => !c.error);
  const pick = [...cases].sort((a, b) => (b.events || 0) - (a.events || 0)).slice(0, 10);
  for (const c of pick) {
    const dir = path.resolve(process.cwd(), outRoot, c.caseId);
    const gdir = path.resolve(process.cwd(), outRoot, "golden", c.caseId);
    const files = ["report.json", "report.md", "report.html"];
    for (const f of files) {
      const src = path.join(dir, f);
      const dest = path.join(gdir, f);
      if (safeExists(src)) copy(src, dest);
    }
  }
  console.log(`Saved ${pick.length} golden cases to ${path.resolve(process.cwd(), outRoot, "golden")}`);
};

main();

