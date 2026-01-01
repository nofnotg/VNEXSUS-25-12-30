import { describe, it, expect } from "vitest";
import { loadBindInputFromFile } from "../../src/modules/medical-events/service/preparedOcrLoader";
import fs from "fs";
import path from "path";

describe("preparedOcrLoader", () => {
  it("parses JSON format to BindInput", () => {
    const tmpDir = path.resolve(process.cwd(), "temp-tests");
    fs.mkdirSync(tmpDir, { recursive: true });
    const p = path.join(tmpDir, "case.json");
    const data = {
      dates: [{ text: "2025-12-01", bbox: { page: 1, x: 0.5, y: 0.5, width: 0.1, height: 0.02 }, confidence: 0.9 }],
      blocks: [{ text: "응급 내원 CT 검사", bbox: { page: 1, x: 0.52, y: 0.52, width: 0.2, height: 0.02 }, page: 1, confidence: 0.6 }]
    };
    fs.writeFileSync(p, JSON.stringify(data), "utf-8");
    const out = loadBindInputFromFile(p);
    expect(Array.isArray(out.dates)).toBe(true);
    expect(Array.isArray(out.blocks)).toBe(true);
    expect(out.dates[0].text).toContain("2025-12-01");
  });
});

