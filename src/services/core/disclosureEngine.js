// Disclosure Engine — minimal core
// contractDate (YYYY-MM-DD), disclosureWindows: ["3m","2y","5y"], records: [{date, text, source}], claimDiagnosis
export function computeDisclosure({ contractDate, disclosureWindows = ["3m","2y","5y"], records = [], claimDiagnosis = "" }) {
  const dContract = new Date(contractDate);
  const daysOf = w => ({ "3m": 90, "1y": 365, "2y": 730, "5y": 1825 }[w] ?? 90);

  const KW_3M = ["의심", "확정", "진단", "재검", "추가검사", "수술 필요", "입원 필요"];
  const KW_2Y = ["입원", "수술"];
  const KW_5Y = ["암", "협심증", "심근경색", "간경화"];

  const norm = s => (s || "").toLowerCase();
  const hasAny = (text, kws) => kws.some(k => norm(text).includes(norm(k)));
  const linkedToClaim = (text) => norm(text).includes(norm(claimDiagnosis));

  const taggedRecords = records.map(r => {
    const dRec = new Date(r.date);
    const diffDays = Math.floor((dContract - dRec) / (1000 * 60 * 60 * 24));
    const tags = disclosureWindows.filter(w => diffDays >= 0 && diffDays <= daysOf(w));
    return { ...r, diffDays, windows: tags };
  });

  const windowReport = disclosureWindows.map(w => {
    const windowRecords = taggedRecords.filter(r => r.windows.includes(w));
    let status = "해당없음";
    const evidence = [];

    for (const r of windowRecords) {
      const t = `${r.text || ""} ${r.source || ""}`;
      const evi = { date: r.date, text: r.text, linkage_to_claim: linkedToClaim(t) };
      if (w === "3m" && hasAny(t, KW_3M)) { evidence.push(evi); status = "해당"; }
      if (w === "2y" && hasAny(t, KW_2Y)) { evidence.push(evi); status = "해당"; }
      if (w === "5y" && hasAny(t, KW_5Y)) { evidence.push(evi); status = "해당"; }
    }

    if (status === "해당" && evidence.some(e => e.linkage_to_claim)) status = "위반의심";
    return { window: w, status, evidence };
  });

  return { windows: windowReport, taggedRecords };
}