export const TAG_SYNONYMS = {
  admission: ["입원", "admission", "ward", "micu", "icu"],
  surgery: ["수술", "시술", "수술일", "op", "surgery", "operation", "procedure"],
  imaging: ["영상검사", "영상", "ct", "mri", "x-ray", "초음파", "내시경", "panoramic"],
  exam: ["검사", "조직검사", "lab", "blood test", "pathology", "biopsy", "cbc", "lft"],
  pastHistory: ["과거력", "기왕력", "과거 병력", "병력", "family history", "fhx", "가족력"],
  doctorOpinion: ["계획", "추적", "재검", "입원 필요", "수술 필요", "소견", "의견", "추천", "impression", "assessment", "plan", "follow up", "f/u"],
};

export const detectTags = (text: string) => {
  const t = text.toLowerCase();
  const set = new Set<string>();
  for (const k of TAG_SYNONYMS.admission) if (t.includes(k)) set.add("입원");
  for (const k of TAG_SYNONYMS.surgery) if (t.includes(k)) set.add("수술");
  for (const k of TAG_SYNONYMS.imaging) if (t.includes(k)) set.add("영상검사");
  for (const k of TAG_SYNONYMS.exam) if (t.includes(k)) set.add("검사");
  for (const k of TAG_SYNONYMS.pastHistory) if (t.includes(k)) set.add("과거력");
  for (const k of TAG_SYNONYMS.doctorOpinion) if (t.includes(k)) set.add("의사소견");
  return Array.from(set);
};

