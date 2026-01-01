import { MedicalEvent } from "../types/index";

const pick = (text: string, re: RegExp) => {
  const m = text.match(re);
  return m ? m[0] : undefined;
};

const collect = (texts: string[], re: RegExp) => {
  const out: string[] = [];
  for (const t of texts) {
    const m = t.match(re);
    if (m) out.push(m[0]);
  }
  return out;
};

export const packEventSlots = (ev: MedicalEvent) => {
  const texts = (ev.meta?.evidence || []).map(e => e.snippet);
  const reason = pick(texts.join(" "), /(의뢰|추적|검진|응급|내원|상담)/);
  const dx = collect(texts, /[A-Z]\d{2,3}(?:\.[0-9A-Z]{1,2})?|암|carcinoma|tumor|neoplasm|진단/);
  const exams = collect(texts, /(CT|MRI|X-ray|Ultrasound|초음파|내시경|조직검사|Pathology|PET)/i);
  const treatments = collect(texts, /(수술|시술|항암|방사선|약물|처치|투약)/);
  const past = collect(texts, /(과거력|기왕력|과거 병력|병력|family history|fhx|가족력)/i);
  let opinion = pick(texts.join(" "), /(계획|추적|재검|입원 필요|수술 필요|소견|의견|추천|impression|assessment|plan|follow\s?up|f\/u)/i);
  const tags = new Set<string>((ev.meta?.tags || []) as string[]);
  const hasPastTag = tags.has("과거력");
  const hasOpinionTag = tags.has("의사소견");
  const pastOut = past.length ? past : hasPastTag ? ["과거력"] : undefined;
  const opinionOut = opinion || (hasOpinionTag ? "의사소견" : "미기재");
  const out = {
    visitDate: ev.slots.visitDate,
    visitReason: reason || "미기재",
    diagnosis: dx.length ? dx : undefined,
    examination: exams.length ? exams : undefined,
    pathology: texts.filter(t => /조직검사|병리|TNM|grade/i.test(t)).slice(0, 3),
    treatment: treatments.length ? treatments : undefined,
    outpatientPeriod: pick(texts.join(" "), /\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\s*~\s*\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/),
    admissionPeriod: pick(texts.join(" "), /\d{4}[.\-]\d{1,2}[.\-]\d{1,2}\s*~\s*\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/),
    pastHistory: pastOut,
    doctorOpinion: opinionOut,
  };
  ev.slots = out;
  return ev;
};

