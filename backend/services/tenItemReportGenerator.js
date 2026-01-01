import fs from "fs";

const fmtDate = (s) => {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  const m2 = s.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
  if (m2) return `${m2[1]}.${String(m2[2]).padStart(2, "0")}.${String(m2[3]).padStart(2, "0")}`;
  return s;
};

const toJSON = (events) => {
  return events.map(ev => ({
    date: ev.date,
    items: {
      visitDate: ev.slots.visitDate || "미기재",
      visitReason: ev.slots.visitReason || "미기재",
      diagnosis: ev.slots.diagnosis || [],
      examination: ev.slots.examination || [],
      pathology: ev.slots.pathology || [],
      treatment: ev.slots.treatment || [],
      outpatientPeriod: ev.slots.outpatientPeriod || "미기재",
      admissionPeriod: ev.slots.admissionPeriod || "미기재",
      pastHistory: ev.slots.pastHistory || [],
      doctorOpinion: ev.slots.doctorOpinion || "미기재",
    },
    meta: ev.meta || {},
  }));
};

const toMarkdown = (events) => {
  const lines = [];
  for (const ev of events) {
    lines.push(`### ${fmtDate(ev.date)}`);
    lines.push(`1. 내원일시: ${fmtDate(ev.slots.visitDate || "미기재")}`);
    lines.push(`2. 내원경위: ${ev.slots.visitReason || "미기재"}`);
    lines.push(`3. 진단병명: ${(ev.slots.diagnosis || []).join(", ") || "미기재"}`);
    lines.push(`4. 검사결과: ${(ev.slots.examination || []).join(", ") || "미기재"}`);
    lines.push(`5. 수술 후 조직검사: ${(ev.slots.pathology || []).join(", ") || "미기재"}`);
    lines.push(`6. 치료내용: ${(ev.slots.treatment || []).join(", ") || "미기재"}`);
    lines.push(`7. 통원기간: ${ev.slots.outpatientPeriod || "미기재"}`);
    lines.push(`8. 입원기간: ${ev.slots.admissionPeriod || "미기재"}`);
    lines.push(`9. 과거병력: ${(ev.slots.pastHistory || []).join(", ") || "미기재"}`);
    lines.push(`10. 의사소견: ${ev.slots.doctorOpinion || "미기재"}`);
    lines.push(`---`);
  }
  return lines.join("\n");
};

const toHTML = (events) => {
  const blocks = events
    .map(
      ev => `<section><h3>${fmtDate(ev.date)}</h3>
<ol>
<li>내원일시: ${fmtDate(ev.slots.visitDate || "미기재")}</li>
<li>내원경위: ${ev.slots.visitReason || "미기재"}</li>
<li>진단병명: ${(ev.slots.diagnosis || []).join(", ") || "미기재"}</li>
<li>검사결과: ${(ev.slots.examination || []).join(", ") || "미기재"}</li>
<li>수술 후 조직검사: ${(ev.slots.pathology || []).join(", ") || "미기재"}</li>
<li>치료내용: ${(ev.slots.treatment || []).join(", ") || "미기재"}</li>
<li>통원기간: ${ev.slots.outpatientPeriod || "미기재"}</li>
<li>입원기간: ${ev.slots.admissionPeriod || "미기재"}</li>
<li>과거병력: ${(ev.slots.pastHistory || []).join(", ") || "미기재"}</li>
<li>의사소견: ${ev.slots.doctorOpinion || "미기재"}</li>
</ol></section>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>10-item Report</title></head><body>${blocks}</body></html>`;
};

export const TenItemReportGenerator = {
  build(events, opts = {}) {
    const json = toJSON(events);
    const markdown = toMarkdown(events);
    const html = toHTML(events);
    if (opts.outputPath) {
      try {
        fs.mkdirSync(opts.outputPath, { recursive: true });
        if (opts.writeJson !== false) fs.writeFileSync(`${opts.outputPath}/report.json`, JSON.stringify(json, null, 2), "utf-8");
        if (opts.writeMarkdown !== false) fs.writeFileSync(`${opts.outputPath}/report.md`, markdown, "utf-8");
        if (opts.writeHtml !== false) fs.writeFileSync(`${opts.outputPath}/report.html`, html, "utf-8");
      } catch {}
    }
    return { json, markdown, html };
  },
};

