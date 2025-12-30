// Disease Rule Mapper — minimal core
const DATE_RX = /\b(20\d{2}[-./](0?[1-9]|1[0-2])[-./](0?[1-9]|[12]\d|3[01]))\b/;
const groupMatchers = [
  { group: "협심증",  keys: ["angina", "협심증", "흉통", "coronary"] },
  { group: "AMI",    keys: ["acute myocardial infarction", "심근경색", "troponin", "ck-mb", "pci", "stent"] },
  { group: "부정맥", keys: ["arrhythmia", "부정맥", "holter", "ekg", "qt", "af", "vt"] },
  { group: "뇌혈관", keys: ["brain ct", "mra", "mri", "angiography", "뇌경색", "lt mca", "ica", "cta"] },
  { group: "암",     keys: ["carcinoma", "adenocarcinoma", "암", "biopsy", "tnm", "pathology"] },
];

function inferGroup(text) {
  const t = (text || "").toLowerCase();
  const hit = groupMatchers.find(m => m.keys.some(k => t.includes(k)));
  return hit ? hit.group : "기타";
}

function pickExam(text) {
  const t = (text || "").toLowerCase();
  const exams = [
    "chest ct","cardiac mri","coronary ct-angio","mra","angiography","brain ct","cta","mri","trus","biopsy","ekg","holter","bone scan","pet-ct"
  ];
  const hit = exams.find(e => t.includes(e));
  return hit || "unspecified";
}

export function mapDiseaseRules(records = []) {
  return records.map(r => {
    const grp = inferGroup(r.text);
    const matchTextDate = DATE_RX.exec(r.text || "");
    const d = r.date || (matchTextDate ? matchTextDate[0] : "");
    const exam = pickExam(r.text);
    const result = r.text || "";

    const normalized = { group: grp, exam, date: d, result, site: undefined, metrics: {} };

    if (grp === "협심증") normalized.metrics = { stenosis: /(\d{2,3})\s*%/.exec(result)?.[1], timi: /timi\s*([0-3])/i.exec(result)?.[1] };
    if (grp === "AMI") normalized.metrics = { troponin: /troponin[^\d]*([\d.]+)/i.exec(result)?.[1], ckmb: /ck-?mb[^\d]*([\d.]+)/i.exec(result)?.[1], ekg_st: /(st\s*(elevation|depression))/i.test(result) };
    if (grp === "부정맥") {
      const rhythm = /(sinus|af|vt|svt|avblock)/i.exec(result)?.[1];
      normalized.metrics = { rhythm: typeof rhythm === "string" ? rhythm.toLowerCase() : rhythm, holter_freq: /(\d+)\s*episodes?/i.exec(result)?.[1] };
    }
    if (grp === "뇌혈관") normalized.site = /(lt|rt)?\s*(mca|ica|aca|pca)/i.exec(result)?.[0];
    if (grp === "암") normalized.metrics = { tnm: /(t\d+[a-b]?n\d+[a-b]?m[0-1x])\b/i.exec(result)?.[1] };

    return { ...r, normalized };
  });
}
