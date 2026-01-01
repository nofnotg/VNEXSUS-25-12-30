import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const safeExists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};
const readJSON = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));

const run = (cmd: string, args: string[], env: NodeJS.ProcessEnv, cwd: string) => {
  const r = spawnSync(cmd, args, { env, cwd, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} failed`);
};

const main = () => {
  const inputRoot = process.argv[2] || "C:\\VNEXSUS_reports_pdf";
  const outRoot = process.argv[3] || "outputs/sweep";
  fs.mkdirSync(path.resolve(process.cwd(), outRoot), { recursive: true });
  const combos = [
    { radius: "0.06", tol: "0.012" },
    { radius: "0.07", tol: "0.012" },
    { radius: "0.06", tol: "0.015" },
  ];
  const results: any[] = [];
  for (const c of combos) {
    const dir = `r${c.radius}_t${c.tol}`;
    const target = path.resolve(process.cwd(), outRoot, dir);
    const env = { ...process.env, BIND_RADIUS: c.radius, BIND_TABLE_TOL: c.tol };
    run("node", ["--loader", "ts-node/esm", "scripts/batch-run-ten-report.ts", inputRoot, target], env, process.cwd());
    run("node", ["--loader", "ts-node/esm", "scripts/compute-metrics.ts", target], env, process.cwd());
    const metricsPath = path.resolve(process.cwd(), target, "_metrics.json");
    const metrics = safeExists(metricsPath) ? readJSON(metricsPath) : {};
    results.push({ dir, radius: c.radius, tol: c.tol, avgScore: metrics?.totals?.avgScore, avgScorePercent: metrics?.totals?.avgScorePercent, events: metrics?.totals?.events });
  }
  const out = { sweep: results };
  fs.writeFileSync(path.resolve(process.cwd(), outRoot, "_sweep.json"), JSON.stringify(out, null, 2), "utf-8");
  const lines = ["# Param Sweep"];
  for (const r of results) lines.push(`- ${r.dir}: radius=${r.radius} tol=${r.tol} events=${r.events} avgScore=${r.avgScore} avgScore%=${r.avgScorePercent}%`);
  fs.writeFileSync(path.resolve(process.cwd(), outRoot, "_sweep.md"), lines.join("\n"), "utf-8");
  console.log(`Sweep written at ${path.resolve(process.cwd(), outRoot)}`);
};

main();

