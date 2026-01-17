import fs from "fs";
import path from "path";
import { loadBindInputFromFile } from "../src/modules/medical-events/service/preparedOcrLoader";
import { runMedicalEventReport } from "../src/modules/medical-events/service/pipelineAdapter";
import { TAG_SYNONYMS } from "../src/shared/constants/tagSynonyms";

const safeExists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};
const listFiles = (dir: string) => {
  const exts = [".json", ".ndjson", ".csv"];
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(d).map(n => path.join(d, n));
    } catch {
      return;
    }
    for (const e of entries) {
      try {
        const st = fs.statSync(e);
        if (st.isDirectory()) walk(e);
        else {
          const ext = path.extname(e).toLowerCase();
          const bn = path.basename(e).toLowerCase();
          if (exts.includes(ext) && !bn.startsWith("manifest")) {
            if (bn.includes("offline_ocr") || bn.includes("_blocks") || bn.includes("core_engine_report")) {
              out.push(e);
            }
          }
        }
      } catch {}
    }
  };
  walk(dir);
  return out;
};
const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });
const readText = (p: string) => fs.readFileSync(p, "utf-8");
const writeText = (p: string, s: string) => fs.writeFileSync(p, s, "utf-8");
const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const sanitizeLLMContent = (s: string) => {
  let out = String(s || "");
  out = out.replace(/(^|\n)[^\n]*?(청구금액|보험료|납입|지급액|지급금|산출|원가|수익|KRW|₩|금액)\s*[:：]?[^\n]*\n/gi, "\n");
  out = out.replace(/\b(\d{1,3}(?:,\d{3})+)\s*원\b/g, "");
  out = out.replace(/\bKRW\s*\d[\d,]*\b/gi, "");
  out = out.replace(/₩\s*\d[\d,]*/g, "");
  return out;
};

const continuousPreprocessPrompt = (patientInfo: any, ocrText: string) => {
  const sys = `의료 문서 전처리 전문가 (연속 세션 모드)
역할: OCR 텍스트를 구조화하고 다음 단계에서 보고서 생성 시 원본 정보를 참조할 수 있도록 준비한다.
원칙: 정보 보존, 컨텍스트 준비, 품질 보장, 연속성 유지`;
  const usr = `환자 정보:
${JSON.stringify(patientInfo ?? {}, null, 2)}

OCR 추출 텍스트:
${ocrText}

출력: 구조화된 JSON과 contextNotes를 포함해 다음 단계에서 보고서 생성 시 원본을 참조할 수 있도록 준비한다.`;
  return { sys, usr };
};
const continuousReportPrompt = () => {
  const usr = `이제 위에서 추출한 구조화된 의료 데이터를 바탕으로 보험 손해사정용 의료 보고서를 생성한다.
요구사항:
1) 마크다운 형식
2) 피보험자 기본 정보 포함
3) 병력 시간순 정리
4) 가입일 기준 3개월/5년 이내 이벤트 표시
5) 보험 심사 핵심 정보 강조
구조:
- 제목 및 기본 정보
- 요약 통계
- 상세 병력 테이블
- 특이사항 및 주의점`;
  return { usr };
};
const generateLLMContinuous = async (caseId: string, ocrText: string, structuredEvents: any[], patientInfo?: any) => {
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const useGemini = process.env.USE_GEMINI === "true";
  const prep = continuousPreprocessPrompt(patientInfo ?? {}, ocrText);

  if (useGemini && googleKey) {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(googleKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prepPrompt = `${prep.sys}\n\n${prep.usr}`;
    const prepRes = await model.generateContent(prepPrompt);
    const preprocessed = prepRes.response.text() || "";

    const rep = continuousReportPrompt();
    const repPrompt = `손해사정 보고서 전문가. 일관된 형식의 고품질 보고서를 생성한다.\n\n구조화 데이터:\n${JSON.stringify(structuredEvents).slice(0, 10000)}\n\n전처리 응답:\n${preprocessed.slice(0, 6000)}\n\n${rep.usr}`;
    const final = await model.generateContent(repPrompt);
    const out = sanitizeLLMContent(final.response.text() || "");
    return out;
  }

  if (openaiKey) {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: openaiKey });
    const prepMsgs = [
      { role: "system", content: prep.sys },
      { role: "user", content: prep.usr },
    ] as any[];
    const prepRes = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: prepMsgs,
      temperature: 0.1,
    });
    const preprocessed = prepRes.choices?.[0]?.message?.content || "";
    const rep = continuousReportPrompt();
    const repMsgs = [
      { role: "system", content: "손해사정 보고서 전문가. 일관된 형식의 고품질 보고서를 생성한다." },
      { role: "user", content: `구조화 데이터:\n${JSON.stringify(structuredEvents).slice(0, 10000)}\n\n전처리 응답:\n${preprocessed.slice(0, 6000)}` },
      { role: "user", content: rep.usr },
    ] as any[];
    const final = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: repMsgs,
      temperature: 0.2,
    });
    const out = sanitizeLLMContent(final.choices?.[0]?.message?.content || "");
    return out;
  }
  return `LLM 비활성화: OPENAI_API_KEY/GOOGLE_API_KEY 미설정\n\n사전 요약:\n- 이벤트 수: ${structuredEvents.length}\n- 샘플 텍스트: ${ocrText.slice(0, 400)}...`;
};

const findBaseline = (caseId: string) => {
  const digits = (() => {
    const m = caseId.match(/^Case(\d+)/i);
    return m ? m[1] : undefined;
  })();
  const canon = digits ? `Case${digits}_report.txt` : `${caseId}_report.txt`;
  const candidates = [
    path.resolve(process.cwd(), "baseline_reports", `${caseId}_report.txt`),
    path.resolve(process.cwd(), "outputs/ten-report", caseId, `${caseId}_report.txt`),
    path.resolve(process.cwd(), "src/rag/case_sample", canon)
  ];
  for (const p of candidates) if (safeExists(p)) return p;
  return undefined;
};

const tokenize = (s: string) => {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(x => x.length >= 2);
};
const jaccard = (a: string, b: string) => {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  const inter = [...sa].filter(x => sb.has(x)).length;
  const uni = new Set<string>([...sa, ...sb]).size;
  return uni > 0 ? inter / uni : 0;
};
const normalizeDateISO = (s: string) => {
  const m1 = s.match(/(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
  if (m1) return `${m1[1]}-${String(m1[2]).padStart(2, "0")}-${String(m1[3]).padStart(2, "0")}`;
  const m2 = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m2) return `${m2[1]}-${String(m2[2]).padStart(2, "0")}-${String(m2[3]).padStart(2, "0")}`;
  return s;
};
const datesFromText = (s: string) => {
  const re = /(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})|(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  const out = new Set<string>();
  for (const m of String(s || "").matchAll(re)) {
    out.add(normalizeDateISO(m[0]));
  }
  return out;
};
const dateJaccard = (a: string, b: string) => {
  const sa = datesFromText(a);
  const sb = datesFromText(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  const inter = [...sa].filter(x => sb.has(x)).length;
  const uni = new Set<string>([...sa, ...sb]).size;
  return uni > 0 ? inter / uni : 0;
};
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EVENT_SYNS = [
  ...TAG_SYNONYMS.admission,
  ...TAG_SYNONYMS.surgery,
  ...TAG_SYNONYMS.imaging,
  ...TAG_SYNONYMS.exam
];
const eventDatesFromText = (s: string) => {
  const out = new Set<string>();
  const txt = String(s || "");
  if (!txt) return out;
  const reKw = new RegExp(EVENT_SYNS.map(escapeRegex).join("|"), "gi");
  let m: RegExpExecArray | null;
  while ((m = reKw.exec(txt)) !== null) {
    const i = m.index;
    const w = txt.slice(i - 160 < 0 ? 0 : i - 160, i + 160);
    const ds = datesFromText(w);
    for (const d of ds) out.add(d);
  }
  return out;
};
const jaccardSets = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter(x => b.has(x)).length;
  const uni = new Set<string>([...a, ...b]).size;
  return uni > 0 ? inter / uni : 0;
};
const isISODate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const appEventDatesFromEvents = (events: any[]) => {
  const out = new Set<string>();
  for (const e of events || []) {
    const t = e?.meta?.tags || [];
    const ok = t.includes("입원") || t.includes("수술") || t.includes("영상검사") || t.includes("검사");
    if (ok && isISODate(String(e?.date || ""))) out.add(String(e.date));
  }
  return out;
};
const isoDateRate = (events: any[]) => {
  const isISO = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
  const dates = events.map(e => e.date).filter(Boolean);
  const valid = dates.filter(isISO).length;
  return dates.length ? Number(((valid / dates.length) * 100).toFixed(1)) : 0;
};
const tagTop = (events: any[], n = 5) => {
  const m = new Map<string, number>();
  for (const e of events) for (const t of (e.meta?.tags || [])) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, n);
};

const clamp01n = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const weights = () => {
  const num = (v: any, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  let wDate = num(process.env.QW_DATE, 0.7);
  let wContent = num(process.env.QW_CONTENT, 0.2);
  let wMeta = num(process.env.QW_META, 0.1);
  const s = wDate + wContent + wMeta;
  if (!(s > 0)) return { wDate: 0.7, wContent: 0.2, wMeta: 0.1 };
  return { wDate: wDate / s, wContent: wContent / s, wMeta: wMeta / s };
};
const compositeQuality = (r: any) => {
  const { wDate, wContent, wMeta } = weights();
  const dateMatch = clamp01n((Number(r.dateMatchAPPvsBase || 0)) / 100); // App↔Baseline 날짜 일치율
  const content = clamp01n((Number(r.simAPPvsBase || 0)) / 100); // App↔Baseline 내용 유사도
  const meta = clamp01n(Number(r.quality || 0)); // 이벤트 메타 점수
  const c = wDate * dateMatch + wContent * content + wMeta * meta;
  return Number(c.toFixed(3));
};
const bandOf = (q: number) => {
  if (q >= 0.75 && q <= 1.0) return "top";
  if (q >= 0.5 && q < 0.75) return "mid";
  return "bottom";
};

const caseQuality = (events: any[]) => {
  if (!Array.isArray(events) || events.length === 0) return 0;
  const s = events.reduce((acc, e) => acc + (typeof e.meta?.score === "number" ? e.meta.score : 0), 0);
  return Number((s / events.length).toFixed(3));
};

const main = async () => {
  const inDir = path.resolve(process.cwd(), process.argv[2] || "realtime_ocr");
  const outDir = path.resolve(process.cwd(), process.argv[3] || "outputs/realtime-llm");
  const offlineDir = path.resolve(process.cwd(), "offline/reports");
  const baseDateStr = String(process.env.REPORT_BASE_DATE || "2026-01-01");
  const dateStr = baseDateStr;
  const outFile = path.resolve(offlineDir, `${dateStr}-realtime-llm-comparison.html`);
  let iterationLabel = "";
  let iterIndex = 1;
  if (safeExists(outFile)) {
    const prev = readText(outFile);
    const reOld = new RegExp(`data-tab-id="iter_${dateStr}"`, "g");
    const reNew = new RegExp(`data-tab-id="iter_${dateStr}_[0-9]+"`, "g");
    const nOld = (prev.match(reOld) || []).length;
    const nNew = (prev.match(reNew) || []).length;
    iterIndex = nOld + nNew + 1;
  }
  iterationLabel = `검증 ${iterIndex}차`;
  ensureDir(outDir);
  ensureDir(offlineDir);
  let files = listFiles(inDir);
  if (files.length === 0) {
    const fallback = "C:\\VNEXSUS_reports_pdf";
    files = listFiles(fallback);
  }
  files = files.slice(0, 31);
  const results: any[] = [];
  const caseCache: Record<string, { outCase: string; events: any[]; blocksSample: string }> = {};
  for (const f of files) {
    const caseId = path.basename(f).replace(path.extname(f), "");
    try {
      const input = loadBindInputFromFile(f);
      const outCase = path.resolve(outDir, caseId);
      ensureDir(outCase);
      const { events, report } = runMedicalEventReport(input, { outputPath: outCase });
      if (report?.html) writeText(path.join(outCase, "app_report.html"), String(report.html));
      if (report?.markdown) writeText(path.join(outCase, "app_report.md"), String(report.markdown));
      const blocksSample = (input.blocks || []).slice(0, 60).map(b => b.text).join("\n");
      caseCache[caseId] = { outCase, events, blocksSample };
      const llm = `LLM 지연 실행: 상·중·하 품질 케이스에만 호출 예정`;
      writeText(path.join(outCase, "llm_report.txt"), llm);
      writeText(path.join(outCase, "llm_report.md"), llm);
      const baselinePath = findBaseline(caseId);
      const baseline = baselinePath ? readText(baselinePath) : "";
      const appMdPath = path.join(outCase, "app_report.md");
      const appMd = safeExists(appMdPath) ? readText(appMdPath) : "";
      const lengthDiff = Math.abs((baseline || "").length - llm.length);
      const simLLMvsBase = Number((jaccard(llm, baseline) * 100).toFixed(1));
      const simAPPvsBase = Number((jaccard(appMd, baseline) * 100).toFixed(1));
      const dateMatchAPPvsBase = (() => {
        const appDates = appEventDatesFromEvents(events || []);
        const baseEventDates = eventDatesFromText(baseline);
        const baseSet = baseEventDates.size ? baseEventDates : datesFromText(baseline);
        const d = appDates.size ? jaccardSets(appDates, baseSet) : dateJaccard(appMd, baseline);
        return Number((d * 100).toFixed(1));
      })();
      const dateRate = isoDateRate(events || []);
      const tags = tagTop(events || [], 5);
      const missingPastCount = (events || []).filter(e => !(Array.isArray(e.slots?.pastHistory) && e.slots!.pastHistory!.length > 0)).length;
      const missingOpinionCount = (events || []).filter(e => !e.slots?.doctorOpinion || e.slots!.doctorOpinion === "미기재").length;
      const missingPastPct = (events || []).length ? Number(((missingPastCount / events.length) * 100).toFixed(1)) : 0;
      const missingOpinionPct = (events || []).length ? Number(((missingOpinionCount / events.length) * 100).toFixed(1)) : 0;
      results.push({
        caseId,
        events: (events || []).length,
        quality: caseQuality(events || []),
        dateValidPct: dateRate,
        tags,
        llmLen: llm.length,
        baselineLen: baseline.length,
        lengthDiff,
        simLLMvsBase,
        simAPPvsBase,
        dateMatchAPPvsBase,
        missingPastPct,
        missingOpinionPct,
        baselinePath: baselinePath || "N/A",
        appMdPath: safeExists(appMdPath) ? appMdPath : "N/A",
        llmMdPath: "N/A",
        llmSnippet: llm.slice(0, 2000),
        appSnippet: appMd.slice(0, 2000),
        baseSnippet: baseline.slice(0, 2000)
      });
    } catch (e: any) {
      results.push({
        caseId,
        events: 0,
        quality: 0,
        dateValidPct: 0,
        tags: [],
        llmLen: 0,
        baselineLen: 0,
        lengthDiff: 0,
        simLLMvsBase: 0,
        simAPPvsBase: 0,
        missingPastPct: 0,
        missingOpinionPct: 0,
        baselinePath: "N/A",
        appMdPath: "N/A",
        llmSnippet: `처리 중 오류 발생: ${String(e?.message || e || "unknown")}`,
        appSnippet: "",
        baseSnippet: ""
      });
    }
  }
  const avgDateIso = results.length ? Number((results.reduce((s, r) => s + (r.dateValidPct || 0), 0) / results.length).toFixed(1)) : 0;
  const avgMissingPast = results.length ? Number((results.reduce((s, r) => s + (r.missingPastPct || 0), 0) / results.length).toFixed(1)) : 0;
  const avgMissingOpinion = results.length ? Number((results.reduce((s, r) => s + (r.missingOpinionPct || 0), 0) / results.length).toFixed(1)) : 0;
  // Composite 점수와 밴드 할당
  for (const r of results) {
    r.qualityComposite = compositeQuality(r);
    r.qualityBand = bandOf(r.qualityComposite);
  }
  const sorted = results.slice().sort((a, b) => (b.qualityComposite || 0) - (a.qualityComposite || 0));
  const top = sorted.slice(0, Math.min(3, sorted.length));
  const bottom = sorted.slice(Math.max(0, sorted.length - 3));
  const midStart = Math.max(0, Math.floor(sorted.length / 2) - 1);
  const mid = sorted.slice(midStart, Math.min(midStart + 3, sorted.length));
  const makeCard = (r: any) => `<div class="card">
<div class="metric"><div class="label">Case</div><div class="v">${r.caseId}</div></div>
<div class="metric"><div class="label">품질 점수 (Quality Score)</div><div class="v">${r.quality}</div></div>
<div class="metric"><div class="label">복합 품질 (Composite)</div><div class="v">${r.qualityComposite}</div></div>
<div class="metric"><div class="label">이벤트 수 (Event Count)</div><div class="v">${r.events}</div></div>
<div class="metric"><div class="label">표준 날짜 형식 비율 (Date ISO%)</div><div class="v">${r.dateValidPct}%</div></div>
<div class="metric"><div class="label">상위 태그 (Top Tags)</div><div class="v">${r.tags.map((t: any) => `${t[0]}:${t[1]}`).join(", ")}</div></div>
<div class="metric"><div class="label">내용 유사도 (Content Jaccard) LLM↔Baseline</div><div class="v">${r.simLLMvsBase}%</div></div>
<div class="metric"><div class="label">내용 유사도 (Content Jaccard) App↔Baseline</div><div class="v">${r.simAPPvsBase}%</div></div>
<div class="metric"><div class="label">날짜 일치율 (Date Match) LLM↔Baseline</div><div class="v">${r.dateMatchLLMvsBase}%</div></div>
<div class="metric"><div class="label">날짜 일치율 (Date Match) App↔Baseline</div><div class="v">${r.dateMatchAPPvsBase}%</div></div>
<div class="metric"><div class="label">길이 차이 (Length Diff)</div><div class="v">${r.lengthDiff}</div></div>
<div class="metric"><div class="label">과거력 미기재율 (Past History Missing%)</div><div class="v">${r.missingPastPct}%</div></div>
<div class="metric"><div class="label">의사소견 미기재율 (Doctor Opinion Missing%)</div><div class="v">${r.missingOpinionPct}%</div></div>
<div class="metric"><div class="label">LLM Report</div><div class="v"><a href="file:///${String(r.llmMdPath || "N/A").replace(/\\/g,"/")}">llm_report.md</a></div></div>
<div class="metric"><div class="label">App Report</div><div class="v"><a href="file:///${r.appMdPath.replace(/\\/g,"/")}">app_report.md</a></div></div>
<div class="metric"><div class="label">Baseline</div><div class="v"><a href="file:///${String(r.baselinePath).replace(/\\/g,"/")}">baseline</a></div></div>
<div class="pill">LLM 요약</div>
<div class="mono">${r.llmSnippet}</div>
<div class="pill">App 보고서(MD) 일부</div>
<div class="mono">${r.appSnippet}</div>
<div class="pill">Baseline 일부</div>
<div class="mono">${r.baseSnippet}</div>
</div>`;
  const selectedForLLM = [...top, ...mid, ...bottom];
  for (const r of selectedForLLM) {
    const cached = caseCache[r.caseId];
    if (!cached) continue;
    try {
      const llm = await generateLLMContinuous(r.caseId, cached.blocksSample, cached.events, {});
      const outCase = cached.outCase;
      writeText(path.join(outCase, "llm_report.txt"), llm);
      writeText(path.join(outCase, "llm_report.md"), llm);
      r.llmMdPath = path.join(outCase, "llm_report.md");
      const baselinePath = findBaseline(r.caseId);
      const baseline = baselinePath ? readText(baselinePath) : "";
      r.llmLen = llm.length;
      r.simLLMvsBase = Number((jaccard(llm, baseline) * 100).toFixed(1));
      {
        const llmDates = eventDatesFromText(llm);
        const baseEventDates = eventDatesFromText(baseline);
        const baseSet = baseEventDates.size ? baseEventDates : datesFromText(baseline);
        const d = llmDates.size ? jaccardSets(llmDates, baseSet) : dateJaccard(llm, baseline);
        r.dateMatchLLMvsBase = Number((d * 100).toFixed(1));
      }
      r.llmSnippet = llm.slice(0, 2000);
    } catch (err: any) {
      const outCase = cached.outCase;
      const llm = `LLM 오류 또는 비활성화: ${String(err?.message || err || "unknown")}\n\n사전 요약:\n- 이벤트 수: ${cached.events.length}\n- 샘플 텍스트: ${cached.blocksSample.slice(0, 400)}...`;
      writeText(path.join(outCase, "llm_report.txt"), llm);
      writeText(path.join(outCase, "llm_report.md"), llm);
      r.llmMdPath = path.join(outCase, "llm_report.md");
      r.llmLen = llm.length;
      r.llmSnippet = llm.slice(0, 2000);
      const baselinePath = findBaseline(r.caseId);
      const baseline = baselinePath ? readText(baselinePath) : "";
      {
        const llmDates = eventDatesFromText(llm);
        const baseEventDates = eventDatesFromText(baseline);
        const baseSet = baseEventDates.size ? baseEventDates : datesFromText(baseline);
        const d = llmDates.size ? jaccardSets(llmDates, baseSet) : dateJaccard(llm, baseline);
        r.dateMatchLLMvsBase = Number((d * 100).toFixed(1));
      }
    }
  }
  const tabKey = `iter_${dateStr}_${iterIndex}`;
  const tabNavBtn = `<button class="tab-btn active" data-tab-id="${tabKey}">${iterationLabel}</button>`;
  const tabPane = `<div class="tab-pane active" id="${tabKey}">
<div class="sub">
  <h2>분석 요약 및 원인</h2>
  <div class="metrics">
    <div class="m"><div class="k">평균 표준 날짜 형식 비율 (Date ISO%)</div><div class="v">${avgDateIso}%</div></div>
    <div class="m"><div class="k">평균 과거력 미기재율 (Past History Missing%)</div><div class="v">${avgMissingPast}%</div></div>
    <div class="m"><div class="k">평균 의사소견 미기재율 (Doctor Opinion Missing%)</div><div class="v">${avgMissingOpinion}%</div></div>
  </div>
  <div style="margin-top:10px;font-size:13px;color:#a8b6c6">
    - 날짜 중심 바인딩 반경(radius=${String(process.env.BIND_RADIUS || "0.08")})과 최대 증거(maxEvidence=${String(process.env.BIND_MAX_EVIDENCE || "5")}) 설정 영향으로 서술 섹션 누락 가능성이 있습니다.<br/>
    - 유의어/태그 기반 슬롯 보강 적용 상태에서 품질 점수별 케이스 검증을 수행합니다.
  </div>
  <div style="margin-top:10px;font-size:13px;color:#8ec9f0">
    - 상대평가 기반 선정: 상·중·하 각 3개 케이스를 선정하여 검증함<br/>
    - 복합 품질(Composite) = wDate*날짜일치(App↔Baseline) + wContent*내용유사도(App↔Baseline) + wMeta*메타점수<br/>
    - 가중치 기본값: wDate=0.7, wContent=0.2, wMeta=0.1 (환경변수 QW_DATE/QW_CONTENT/QW_META로 조정 가능)
  </div>
</div>
<div class="sub" style="padding-top:8px">
  <div class="tabs" data-scope="quality">
    <button class="tab-btn active" data-quality-id="top_${dateStr}_${iterIndex}">상(Top)</button>
    <button class="tab-btn" data-quality-id="mid_${dateStr}_${iterIndex}">중(Mid)</button>
    <button class="tab-btn" data-quality-id="bottom_${dateStr}_${iterIndex}">하(Bottom)</button>
  </div>
  <div class="quality-pane active" id="quality_top_${dateStr}_${iterIndex}">
    <div class="section"><h2>품질 점수 높은 케이스(3)</h2><div class="grid">${top.map(makeCard).join("")}</div></div>
  </div>
  <div class="quality-pane" id="quality_mid_${dateStr}_${iterIndex}">
    <div class="section"><h2>품질 점수 중간 케이스(3)</h2><div class="grid">${mid.map(makeCard).join("")}</div></div>
  </div>
  <div class="quality-pane" id="quality_bottom_${dateStr}_${iterIndex}">
    <div class="section"><h2>품질 점수 낮은 케이스(3)</h2><div class="grid">${bottom.map(makeCard).join("")}</div></div>
  </div>
</div>
</div>`;
  let html: string;
  if (safeExists(outFile)) {
    const prev = readText(outFile);
    const hasMarkers = prev.includes("<!-- tabs:nav:start -->") && prev.includes("<!-- tabs:nav:end -->") && prev.includes("<!-- tabs:content:start -->") && prev.includes("<!-- tabs:content:end -->");
    if (hasMarkers) {
      const extract = (s: string) => {
        const out: string[] = [];
        const startMarker = "<!-- tabs:content:start -->";
        const endMarker = "<!-- tabs:content:end -->";
        const iStart = s.indexOf(startMarker);
        const iEnd = s.indexOf(endMarker);
        if (iStart < 0 || iEnd < 0 || iEnd <= iStart) return out;
        const block = s.slice(iStart + startMarker.length, iEnd);
        const re = /<div class="tab-pane(?:\s+active)?"[^>]*\bid="([^"]+)"[^>]*>/g;
        const matches = Array.from(block.matchAll(re)).map(m => ({ idx: m.index ?? 0, raw: m[0] }));
        for (let i = 0; i < matches.length; i++) {
          const a = matches[i];
          const b = matches[i + 1];
          const start = a.idx;
          const end = b ? b.idx : block.length;
          let pane = block.slice(start, end).trim();
          if (pane.length === 0) continue;
          if (!pane.endsWith("</div>")) pane += "\n</div>";
          out.push(pane);
        }
        return out;
      };
      const normalizePaneHtml = (s: string) => {
        let x = s;
        x = x.replace(/id="iter_\d{4}-\d{2}-\d{2}_[0-9]+"/g, 'id="iter_DATE_IDX"');
        x = x.replace(/id="iter_\d{4}-\d{2}-\d{2}"/g, 'id="iter_DATE_IDX"');
        x = x.replace(/data-quality-id="(top|mid|bottom)_\d{4}-\d{2}-\d{2}_[0-9]+"/g, (_m, g1) => `data-quality-id="${g1}_DATE_IDX"`);
        x = x.replace(/id="quality_(top|mid|bottom)_\d{4}-\d{2}-\d{2}_[0-9]+"/g, (_m, g1) => `id="quality_${g1}_DATE_IDX"`);
        x = x.replace(/class="tab-pane\s+active"/g, 'class="tab-pane"');
        x = x.replace(/class="quality-pane\s+active"/g, 'class="quality-pane"');
        return x;
      };
      const retarget = (s: string, idx: number, active: boolean) => {
        let x = s;
        x = x.replace(/id="iter_\d{4}-\d{2}-\d{2}_[0-9]+"/g, `id="iter_${dateStr}_${idx}"`);
        x = x.replace(/id="iter_\d{4}-\d{2}-\d{2}"/g, `id="iter_${dateStr}_${idx}"`);
        x = x.replace(/data-quality-id="(top|mid|bottom)_\d{4}-\d{2}-\d{2}_[0-9]+"/g, (_m, g1) => `data-quality-id="${g1}_${dateStr}_${idx}"`);
        x = x.replace(/id="quality_(top|mid|bottom)_\d{4}-\d{2}-\d{2}_[0-9]+"/g, (_m, g1) => `id="quality_${g1}_${dateStr}_${idx}"`);
        x = x.replace(/class="tab-pane\s+active"/g, 'class="tab-pane"');
        if (active) x = x.replace(/class="tab-pane"/, 'class="tab-pane active"');
        return x;
      };
      const prevPanes = extract(prev);
      const panes: string[] = [];
      const seen = new Set<string>();
      for (const p of prevPanes) {
        const k = normalizePaneHtml(p);
        if (!seen.has(k)) {
          seen.add(k);
          panes.push(p);
        }
      }
      const firstOnly = panes.length ? [panes[0]] : [];
      {
        const kNew = normalizePaneHtml(tabPane);
        if (!seen.has(kNew)) {
          seen.add(kNew);
          panes.push(tabPane);
        }
      }
      const combined = [...firstOnly, panes[panes.length - 1]];
      const navBuilt: string[] = [];
      const paneBuilt: string[] = [];
      for (let i = 0; i < combined.length; i++) {
        const idx = i + 1;
        const active = i === combined.length - 1;
        navBuilt.push(`<button class="tab-btn${active ? " active" : ""}" data-tab-id="iter_${dateStr}_${idx}">검증 ${idx}차</button>`);
        paneBuilt.push(retarget(combined[i], idx, active));
      }
      const navAll = navBuilt.join("");
      const paneAll = paneBuilt.join("");
      html = prev.replace(/<!-- tabs:nav:start -->[\s\S]*?<!-- tabs:nav:end -->/g, `<!-- tabs:nav:start -->${navAll}<!-- tabs:nav:end -->`).replace(/<!-- tabs:content:start -->[\s\S]*?<!-- tabs:content:end -->/g, `<!-- tabs:content:start -->${paneAll}<!-- tabs:content:end -->`);
    } else {
      html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>실시간 OCR LLM 보고서 비교 - ${dateStr}</title>
<style>:root{--deep:#0b1f3a;--c1:#14355f;--c2:#215e9b;--acc:#18a0fb;--txt:#e6eef7;--mut:#a8b6c6}
html,body{background:var(--deep);color:var(--txt);margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",Arial,sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:24px}
.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:12px;margin-bottom:18px}
.title{font-size:24px;font-weight:700}.date{font-size:13px;color:#8ec9f0}
.sub{margin:14px 0 22px 0;padding:12px;border-radius:10px;background:linear-gradient(180deg,#0f2646,#133558)}
.sub h2{margin:0 0 8px 0;font-size:16px}
.sub .metrics{display:flex;gap:18px;flex-wrap:wrap}
.sub .m{display:flex;gap:8px;align-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:6px 10px;border-radius:999px}
.sub .m .k{color:#8ec9f0;font-size:12px}
.sub .m .v{font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{background:linear-gradient(180deg,#102a4a,var(--c1));border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.4);padding:14px}
.metric{display:flex;justify-content:space-between;margin:4px 0}.metric .label{color:#a8b6c6;font-size:12px}.metric .v{font-size:16px}
.mono{background:rgba(255,255,255,.06);border-radius:8px;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;white-space:pre-wrap;max-height:320px;overflow:auto}
.pill{display:inline-block;padding:3px 8px;border-radius:999px;background:rgba(24,160,251,.18);border:1px solid rgba(24,160,251,.35);font-size:12px}
a{color:#8ec9f0;text-decoration:none}
.tabs{display:flex;gap:8px;margin-bottom:12px}
.tab-btn{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#e6eef7;cursor:pointer}
.tab-btn.active{background:rgba(24,160,251,.25);border-color:rgba(24,160,251,.45)}
.tab-pane{display:none}
.tab-pane.active{display:block}
.quality-pane{display:none}
.quality-pane.active{display:block}
</style>
<script>
document.addEventListener('DOMContentLoaded', function(){
  var nav = document.getElementById('tab-nav');
  var panes = document.querySelectorAll('.tab-pane');
  nav.addEventListener('click', function(e){
    var btn = e.target;
    if (!btn || !(btn instanceof HTMLElement) || !btn.classList.contains('tab-btn')) return;
    var id = btn.getAttribute('data-tab-id');
    document.querySelectorAll('#tab-nav .tab-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    panes.forEach(function(p){ p.classList.remove('active'); });
    var pane = document.getElementById(String(id));
    if (pane) pane.classList.add('active');
  });
  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t || !(t instanceof HTMLElement)) return;
    var parent = t.parentElement;
    if (t.classList.contains('tab-btn') && parent && parent.getAttribute('data-scope') === 'quality') {
      var container = t.closest('.tab-pane');
      parent.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
      t.classList.add('active');
      if (container) {
        container.querySelectorAll('.quality-pane').forEach(function(p){ p.classList.remove('active'); });
        var qid = t.getAttribute('data-quality-id');
        var target = container.querySelector('#quality_' + qid);
        if (target) target.classList.add('active');
      }
    }
  });
});
</script>
</head><body><div class="wrap">
<div class="hdr"><div class="title">실시간 OCR LLM 보고서 비교</div><div class="date">작성일: ${dateStr}</div></div>
<div id="tab-nav" class="tabs"><!-- tabs:nav:start -->${tabNavBtn}<!-- tabs:nav:end --></div>
<div id="tab-container"><!-- tabs:content:start -->${tabPane}<!-- tabs:content:end --></div>
</div></body></html>`;
    }
  } else {
    html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>실시간 OCR LLM 보고서 비교 - ${dateStr}</title>
<style>:root{--deep:#0b1f3a;--c1:#14355f;--c2:#215e9b;--acc:#18a0fb;--txt:#e6eef7;--mut:#a8b6c6}
html,body{background:var(--deep);color:var(--txt);margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",Arial,sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:24px}
.hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:12px;margin-bottom:18px}
.title{font-size:24px;font-weight:700}.date{font-size:13px;color:#8ec9f0}
.sub{margin:14px 0 22px 0;padding:12px;border-radius:10px;background:linear-gradient(180deg,#0f2646,#133558)}
.sub h2{margin:0 0 8px 0;font-size:16px}
.sub .metrics{display:flex;gap:18px;flex-wrap:wrap}
.sub .m{display:flex;gap:8px;align-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:6px 10px;border-radius:999px}
.sub .m .k{color:#8ec9f0;font-size:12px}
.sub .m .v{font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{background:linear-gradient(180deg,#102a4a,var(--c1));border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.4);padding:14px}
.metric{display:flex;justify-content:space-between;margin:4px 0}.metric .label{color:#a8b6c6;font-size:12px}.metric .v{font-size:16px}
.mono{background:rgba(255,255,255,.06);border-radius:8px;padding:10px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;white-space:pre-wrap;max-height:320px;overflow:auto}
.pill{display:inline-block;padding:3px 8px;border-radius:999px;background:rgba(24,160,251,.18);border:1px solid rgba(24,160,251,.35);font-size:12px}
a{color:#8ec9f0;text-decoration:none}
.tabs{display:flex;gap:8px;margin-bottom:12px}
.tab-btn{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#e6eef7;cursor:pointer}
.tab-btn.active{background:rgba(24,160,251,.25);border-color:rgba(24,160,251,.45)}
.tab-pane{display:none}
.tab-pane.active{display:block}
.quality-pane{display:none}
.quality-pane.active{display:block}
</style>
<script>
document.addEventListener('DOMContentLoaded', function(){
  var nav = document.getElementById('tab-nav');
  var panes = document.querySelectorAll('.tab-pane');
  nav.addEventListener('click', function(e){
    var btn = e.target;
    if (!btn || !(btn instanceof HTMLElement) || !btn.classList.contains('tab-btn')) return;
    var id = btn.getAttribute('data-tab-id');
    document.querySelectorAll('#tab-nav .tab-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    panes.forEach(function(p){ p.classList.remove('active'); });
    var pane = document.getElementById(String(id));
    if (pane) pane.classList.add('active');
  });
  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t || !(t instanceof HTMLElement)) return;
    var parent = t.parentElement;
    if (t.classList.contains('tab-btn') && parent && parent.getAttribute('data-scope') === 'quality') {
      var container = t.closest('.tab-pane');
      parent.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
      t.classList.add('active');
      if (container) {
        container.querySelectorAll('.quality-pane').forEach(function(p){ p.classList.remove('active'); });
        var qid = t.getAttribute('data-quality-id');
        var target = container.querySelector('#quality_' + qid);
        if (target) target.classList.add('active');
      }
    }
  });
});
</script>
</head><body><div class="wrap">
<div class="hdr"><div class="title">실시간 OCR LLM 보고서 비교</div><div class="date">작성일: ${dateStr}</div></div>
<div id="tab-nav" class="tabs"><!-- tabs:nav:start -->${tabNavBtn}<!-- tabs:nav:end --></div>
<div id="tab-container"><!-- tabs:content:start -->${tabPane}<!-- tabs:content:end --></div>
</div></body></html>`;
  }
  writeText(outFile, html);
  // 별도 요약 문서 생성 중단
  console.log(outFile);
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});

