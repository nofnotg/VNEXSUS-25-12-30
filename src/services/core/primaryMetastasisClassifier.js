// Primary/Metastasis Classifier — minimal core
const PRIMARY_HINTS = [
  { site: "자궁내막암", keys: ["endometrioid carcinoma", "자궁내막", "c54.1"] },
  { site: "직장암",     keys: ["rectal adenocarcinoma", "직장", "c20"] },
  { site: "유방암",     keys: ["breast carcinoma", "유방", "c50"] },
  { site: "폐암",       keys: ["lung carcinoma", "폐", "c34"] }
];

const METS_HINTS = [
  { site: "림프절", keys: ["pelvic ln","paraaortic ln","lymph node","림프절"] },
  { site: "복막",   keys: ["peritoneal seeding","복막"] },
  { site: "간",     keys: ["liver met","간"] },
  { site: "뼈",     keys: ["bone met","골"] }
];

function detect(items = [], hints) {
  const text = items.join(" ").toLowerCase();
  return hints.filter(h => h.keys.some(k => text.includes(k))).map(h => h.site);
}

export function classifyPrimaryMetastasis({ records = [] }) {
  const corpus = records.map(r => r.text || "");
  const primary = detect(corpus, PRIMARY_HINTS)[0] || "원발부위 미상";
  const metastasisSet = new Set(detect(corpus, METS_HINTS));
  const metastasis = Array.from(metastasisSet);
  const line = `분류: ✅ ${primary} 원발${metastasis.length ? " + " + metastasis.join(" 및 ") + " 전이" : " + 전이 없음"}`;
  return { primary, metastasis, classificationLine: line };
}