import { normalizeDiagnosisLine } from "../../src/shared/utils/medicalText.js";

describe("normalizeDiagnosisLine", () => {
  it("dedupes repeated parenthetical tokens", () => {
    const line = "진단명: 상병(Chest pain) (Chest pain) (Chest pain), (ICD: R074) 흉통, 상세불명";
    const norm = normalizeDiagnosisLine(line);
    expect(norm).toContain("(Chest pain)");
    // should not contain multiple repeated tokens
    expect((norm.match(/\(Chest pain\)/g) || []).length).toBe(1);
  });

  it("normalizes misformatted ICD code with stray parenthesis", () => {
    const line = "진단명: 주진단(Stable angina pectoris), (ICD: I20).9 협심증, 상세불명";
    const norm = normalizeDiagnosisLine(line);
    expect(norm).toContain("ICD: I20.9");
  });

  it("normalizes compact ICD code without dot (R074 -> R07.4)", () => {
    const line = "진단명: 상병(Chest pain), ICD R074";
    const norm = normalizeDiagnosisLine(line);
    expect(norm).toContain("ICD: R07.4");
  });

  it("normalizes compact ICD code with two decimals (E1168 -> E11.68)", () => {
    const line = "진단명: 기타진단(Diabetes Mellitus) type 2 with dyslipidemia,(ICD: E1168)";
    const norm = normalizeDiagnosisLine(line);
    expect(norm).toContain("ICD: E11.68");
  });
});

