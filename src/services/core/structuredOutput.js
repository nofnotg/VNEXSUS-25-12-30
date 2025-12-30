// Structured Output — minimal core
export const FullReportSchema = {
  required: ["patient", "visit", "diagnosis", "exams", "treatments", "periods", "history", "doctor_note"],
  types: {
    patient: "object", visit: "object", diagnosis: "array", exams: "array",
    treatments: "array", periods: "object", history: "array", doctor_note: "string"
  }
};

export const SummarySchema = {
  required: ["visit_date", "visit_reason", "diagnosis", "exam_summary", "postop_pathology", "treatment", "opd_period", "adm_period", "history", "doctor_note"],
  types: {
    visit_date: "string", visit_reason: "string", diagnosis: "string", exam_summary: "string",
    postop_pathology: "string", treatment: "string", opd_period: "string", adm_period: "string",
    history: "string", doctor_note: "string"
  }
};

export const DisclosureSchema = {
  required: ["windows", "taggedRecords"],
  types: { windows: "array", taggedRecords: "array" }
};

export const MedicalEventSchema = {
  required: ["date", "type", "content", "source"],
  types: { date: "string", type: "string", content: "object", source: "string" }
};

export function validateStructure(obj, schema) {
  if (!obj || typeof obj !== "object") return { ok: false, error: "not-an-object" };
  for (const k of schema.required) {
    if (!(k in obj)) return { ok: false, error: `missing:${k}` };
    const t = schema.types[k];
    if (!t) continue;
    if (t === "array") {
      if (!Array.isArray(obj[k])) return { ok: false, error: `type:${k}` };
      continue;
    }
    if (t === "object") {
      if (obj[k] === null || typeof obj[k] !== "object" || Array.isArray(obj[k])) {
        return { ok: false, error: `type:${k}` };
      }
      continue;
    }
    if (typeof obj[k] !== t) return { ok: false, error: `type:${k}` };
  }
  return { ok: true };
}
