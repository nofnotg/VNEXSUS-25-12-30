import { describe, it, expect } from "vitest";
import { runMedicalEventReport } from "../../src/modules/medical-events/service/pipelineAdapter";

describe("pipelineAdapter", () => {
  it("produces events and 3-format report", () => {
    const input = {
      dates: [{ text: "2025-12-01", bbox: { page: 1, x: 0.5, y: 0.5, width: 0.05, height: 0.02 }, confidence: 0.9 }],
      blocks: [
        { text: "응급 내원, CT 검사 시행, 입원 필요", bbox: { page: 1, x: 0.52, y: 0.52, width: 0.2, height: 0.02 }, page: 1 },
      ],
      contractDate: "2025-11-15",
      claimKeywords: ["c50"],
    } as any;
    const res = runMedicalEventReport(input);
    expect(res.events.length).toBe(1);
    expect(typeof res.report.markdown).toBe("string");
    expect(typeof res.report.html).toBe("string");
    expect(Array.isArray(res.report.json)).toBe(true);
  });
});

