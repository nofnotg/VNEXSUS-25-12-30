import fs from "fs";
import path from "path";
import { runMedicalEventReport } from "../src/modules/medical-events/service/pipelineAdapter";

const main = () => {
  const inputPath = process.argv[2] || "samples/bind-input.json";
  const outDir = process.argv[3] || "outputs/ten-report";
  const raw = fs.readFileSync(path.resolve(process.cwd(), inputPath), "utf-8");
  const input = JSON.parse(raw);
  const res = runMedicalEventReport(input, { outputPath: path.resolve(process.cwd(), outDir) });
  console.log(`Events: ${res.events.length}`);
  console.log(`Wrote: ${path.resolve(process.cwd(), outDir)}`);
};

main();

