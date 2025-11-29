import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { generateHtmlFromFile } from "../../src/scripts/generateComparisonHtml.js";

describe("generateHtmlFromFile CLI", () => {
  const inputPath = resolve(process.cwd(), "results/outpatient-episodes-case-comparison.json");
  const outputPath = resolve(process.cwd(), "reports/outpatient-episodes-case-comparison.test.html");

  afterAll(() => {
    if (existsSync(outputPath)) unlinkSync(outputPath);
  });

  it("generates HTML from comparison JSON and writes file", async () => {
    const html = await generateHtmlFromFile(inputPath, outputPath, { title: "Test Summary" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Test Summary");
    expect(html).toContain("Summary by File/Config");
    expect(existsSync(outputPath)).toBe(true);
    const written = readFileSync(outputPath, "utf-8");
    expect(written.length).toBeGreaterThan(500);
  });
});

