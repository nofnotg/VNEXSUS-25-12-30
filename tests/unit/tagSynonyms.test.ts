import { describe, it, expect } from "vitest";
import { detectTags } from "../../src/shared/constants/tagSynonyms";

describe("tagSynonyms", () => {
  it("detects admission and imaging tags", () => {
    const txt = "2025-03-24 입원 MICU CT 검사 시행";
    const tags = detectTags(txt);
    expect(tags.includes("입원")).toBe(true);
    expect(tags.includes("영상검사")).toBe(true);
  });
  it("detects surgery", () => {
    const txt = "수술 OP operation 완료";
    const t = detectTags(txt);
    expect(t.includes("수술")).toBe(true);
  });
  it("detects exam", () => {
    const txt = "조직검사 biopsy LFT CBC 결과";
    const t = detectTags(txt);
    expect(t.includes("검사")).toBe(true);
  });
});

