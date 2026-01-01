import { describe, it, expect } from "vitest";
import { scoreEvent, computeRelations } from "../../src/modules/medical-events/service/scoring";

describe("scoring", () => {
  it("computes score with contract proximity and severity", () => {
    const ev = {
      date: "2025-12-01",
      slots: { visitDate: "2025-12-01", diagnosis: ["C50.9"] },
      meta: { tags: ["입원", "영상검사"], evidence: [] },
    } as any;
    const s = scoreEvent(ev, [ev], { contractDate: "2025-11-15", claimKeywords: ["c50"] });
    expect(s).toBeGreaterThan(0.5);
  });
  it("adds relations for close dates and same diagnosis", () => {
    const a = { date: "2025-12-01", slots: { diagnosis: ["C50.9"], examination: ["CT"] } } as any;
    const b = { date: "2025-12-10", slots: { diagnosis: ["C50.9"], examination: ["MRI"] } } as any;
    const out = computeRelations([a, b]);
    expect(out[0].meta?.relEdges?.length).toBeGreaterThan(0);
  });
});

