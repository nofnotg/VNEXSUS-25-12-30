import { describe, it, expect } from "vitest";

describe("weights normalization", async () => {
  it("normalizes env percent weights to sum=1", async () => {
    process.env.WEIGHT_SEVERITY = "35";
    process.env.WEIGHT_PROXIMITY = "20";
    process.env.WEIGHT_DOC = "20";
    process.env.WEIGHT_CLAIM = "15";
    process.env.WEIGHT_REPETITION = "5";
    process.env.WEIGHT_DISCLOSURE = "5";
    const { WEIGHTS } = await import("../../src/shared/constants/medicalEvents");
    const sum = WEIGHTS.severity + WEIGHTS.proximityToContract + WEIGHTS.documentationStrength + WEIGHTS.claimRelevance + WEIGHTS.repetitionPattern + WEIGHTS.disclosureTrigger;
    expect(Number(sum.toFixed(6))).toBe(1);
    expect(WEIGHTS.severity).toBeGreaterThan(WEIGHTS.repetitionPattern);
  });
});

