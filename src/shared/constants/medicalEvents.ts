const pct = (v: string | undefined, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const raw = {
  severity: pct(process.env.WEIGHT_SEVERITY, 35),
  proximityToContract: pct(process.env.WEIGHT_PROXIMITY, 20),
  documentationStrength: pct(process.env.WEIGHT_DOC, 20),
  claimRelevance: pct(process.env.WEIGHT_CLAIM, 15),
  repetitionPattern: pct(process.env.WEIGHT_REPETITION, 5),
  disclosureTrigger: pct(process.env.WEIGHT_DISCLOSURE, 5),
};
const sum = raw.severity + raw.proximityToContract + raw.documentationStrength + raw.claimRelevance + raw.repetitionPattern + raw.disclosureTrigger;
const norm = sum > 0 ? sum : 100;
export const WEIGHTS = {
  severity: raw.severity / norm,
  proximityToContract: raw.proximityToContract / norm,
  documentationStrength: raw.documentationStrength / norm,
  claimRelevance: raw.claimRelevance / norm,
  repetitionPattern: raw.repetitionPattern / norm,
  disclosureTrigger: raw.disclosureTrigger / norm,
};

export const DEFAULT_SIGMOID = {
  k: 1,
};

