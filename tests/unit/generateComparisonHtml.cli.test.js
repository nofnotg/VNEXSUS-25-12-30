import { writeFileSync, unlinkSync, existsSync, readFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { generateHtmlFromFile } from "../../src/scripts/generateComparisonHtml.js";

describe("generateHtmlFromFile CLI", () => {
  const inputPath = resolve(process.cwd(), "temp/reports/outpatient-episodes-case-comparison.test.json");
  const outputPath = resolve(process.cwd(), "temp/reports/outpatient-episodes-case-comparison.test.html");

  afterAll(() => {
    if (existsSync(inputPath)) unlinkSync(inputPath);
    if (existsSync(outputPath)) unlinkSync(outputPath);
  });

  it("generates HTML from comparison JSON and writes file", async () => {
    mkdirSync(resolve(process.cwd(), "temp/reports"), { recursive: true });
    const fixture = {
      generatedAt: "2025-01-01T00:00:00.000Z",
      results: [
        {
          name: "baseline",
          summary: [
            {
              file: "a.txt",
              records: 2,
              episodes: 1,
              diagnosticGroups: [],
              hospitals: ["서울대병원"],
              claimWithinWindowRecords: 0,
              claimTotalRecords: 0,
              diseaseAnchors: 1,
              diseaseTestsWithinTimeframe: 0,
            },
          ],
          aggregate: { cases: 1, totals: { records: 2, episodes: 1 }, topGroups: [] },
        },
      ],
    };
    writeFileSync(inputPath, JSON.stringify(fixture, null, 2), "utf-8");
    const html = await generateHtmlFromFile(inputPath, outputPath, { title: "Test Summary" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Test Summary");
    expect(html).toContain("Summary by File/Config");
    expect(existsSync(outputPath)).toBe(true);
    const written = readFileSync(outputPath, "utf-8");
    expect(written.length).toBeGreaterThan(500);
  });
});
