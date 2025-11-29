/* Jest unit test: verify comprehensive case progress report generation */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

describe("Comprehensive Case Progress Report", () => {
  const outPath = path.resolve("temp/reports/Comprehensive_Case_Progress_Report.html");

  it("generates HTML report and includes key sections", () => {
    // Run the generator script (Node ESM). Use forward slashes for cross-platform.
    execSync("node backend/postprocess/generate-comprehensive-case-progress-report.js", { stdio: "pipe" });

    // Verify the output file exists
    expect(fs.existsSync(outPath)).toBe(true);

    // Verify content includes key sections
    const html = fs.readFileSync(outPath, "utf-8");
    expect(html).toContain("<h2>요약</h2>");
    expect(html).toContain("<h2>케이스 처리 현황</h2>");
    expect(html).toContain("<h2>진단명 이슈 집계</h2>");
    expect(html).toContain("<h2>개선계획 기준 공정율</h2>");
  });
});

