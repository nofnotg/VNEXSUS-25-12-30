import { describe, it, expect } from "vitest";
import { DateBindingV3 } from "../../src/modules/medical-events/service/dateBindingV3";

describe("DateBindingV3.bindDatesToEvents", () => {
  it("binds evidence around date by proximity and excludes header/footer", () => {
    const input = {
      dates: [
        { text: "2025-12-01", bbox: { page: 1, x: 0.5, y: 0.5, width: 0.05, height: 0.02 }, confidence: 0.9 },
      ],
      blocks: [
        { text: "헤더", bbox: { page: 1, x: 0.5, y: 0.02, width: 0.2, height: 0.02 }, page: 1 },
        { text: "입원 필요 소견", bbox: { page: 1, x: 0.52, y: 0.52, width: 0.2, height: 0.02 }, page: 1 },
        { text: "CT 검사 시행", bbox: { page: 1, x: 0.48, y: 0.49, width: 0.2, height: 0.02 }, page: 1 },
        { text: "푸터", bbox: { page: 1, x: 0.5, y: 0.97, width: 0.2, height: 0.02 }, page: 1 },
      ],
    } as any;
    const out = DateBindingV3.bindDatesToEvents(input, { radius: 0.1, maxEvidence: 3 });
    expect(out.events.length).toBe(1);
    expect(out.events[0].meta?.evidence?.length).toBeGreaterThan(0);
    expect(out.events[0].meta?.tags?.includes("입원")).toBe(true);
  });
});

