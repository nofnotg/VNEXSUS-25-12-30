import { describe, it, expect } from "vitest";
import { TenItemReportGenerator } from "../../backend/services/tenItemReportGenerator";

describe("TenItemReportGenerator", () => {
  it("builds JSON/Markdown/HTML from events", () => {
    const events = [
      {
        date: "2025-12-01",
        slots: {
          visitDate: "2025-12-01",
          visitReason: "응급",
          diagnosis: ["C50.9"],
          examination: ["CT"],
          pathology: [],
          treatment: ["수술"],
          outpatientPeriod: "2025-12-02 ~ 2025-12-10",
          admissionPeriod: "2025-12-01 ~ 2025-12-05",
          pastHistory: ["고혈압"],
          doctorOpinion: "추적",
        },
        meta: {},
      },
    ] as any;
    const res = TenItemReportGenerator.build(events);
    expect(Array.isArray(res.json)).toBe(true);
    expect(typeof res.markdown).toBe("string");
    expect(typeof res.html).toBe("string");
  });
});

