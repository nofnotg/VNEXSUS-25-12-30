// Node ESM script: Generate Comprehensive Case Progress Report (HTML)
// - Processes normalized CaseX outputs (fallback: run MedicalDocumentNormalizer)
// - Maps current features to initial improvement plan and computes completion rate
// - Produces an HTML report with tables, improvement suggestions, and validation summary

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Helper: convert absolute path to file URL for dynamic imports
const pathToFileURL = (p) => new URL(`file://${path.resolve(p)}`);

// Structured logger (avoids console.* per team rules)
// Fallback to a minimal shim if shared logger is unavailable
let logger;
try {
  // Prefer TS build if available; otherwise use JS version
  // Both paths are attempted to maximize compatibility
  const tsLoggerPath = path.resolve("src/shared/logging/logger.ts");
  const jsLoggerPath = path.resolve("src/shared/logging/logger.js");
  if (fs.existsSync(tsLoggerPath)) {
    // Dynamic import for ESM .ts if compiled via ts-node/register or transpiled
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import(pathToFileURL(tsLoggerPath).href);
    logger = mod.logger ?? mod.default ?? console;
  } else if (fs.existsSync(jsLoggerPath)) {
    const mod = await import(pathToFileURL(jsLoggerPath).href);
    logger = mod.logger ?? mod.default ?? console;
  } else {
    logger = {
      info: (e) => console.log(JSON.stringify({ level: "info", ...e })),
      warn: (e) => console.warn(JSON.stringify({ level: "warn", ...e })),
      error: (e) => console.error(JSON.stringify({ level: "error", ...e })),
      debug: (e) => console.debug(JSON.stringify({ level: "debug", ...e })),
    };
  }
} catch {
  logger = {
    info: (e) => console.log(JSON.stringify({ level: "info", ...e })),
    warn: (e) => console.warn(JSON.stringify({ level: "warn", ...e })),
    error: (e) => console.error(JSON.stringify({ level: "error", ...e })),
    debug: (e) => console.debug(JSON.stringify({ level: "debug", ...e })),
  };
}

// Normalizer & helpers
let MedicalDocumentNormalizer;
try {
  const normalizerPath = path.resolve("backend/postprocess/medicalDocumentNormalizer.js");
  if (fs.existsSync(normalizerPath)) {
    const mod = await import(pathToFileURL(normalizerPath).href);
    MedicalDocumentNormalizer = mod.MedicalDocumentNormalizer ?? mod.default;
  }
} catch (err) {
  logger.warn({ event: "load_normalizer_failed", message: String(err) });
}

// Improvement strategy (initial plan)
let improvementStrategy;
try {
  const strategyJsonPath = path.resolve("results/improvement_strategy.json");
  if (fs.existsSync(strategyJsonPath)) {
    improvementStrategy = JSON.parse(fs.readFileSync(strategyJsonPath, "utf-8"));
  } else {
    // Fallback: derive from JS generator if available
    const strategyJsPath = path.resolve("quality-improvement-strategy.js");
    if (fs.existsSync(strategyJsPath)) {
      const mod = await import(pathToFileURL(strategyJsPath).href);
      improvementStrategy = mod.generateImprovementPlan
        ? mod.generateImprovementPlan()
        : undefined;
    }
  }
} catch (err) {
  logger.warn({ event: "load_strategy_failed", message: String(err) });
}

// Utils
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Ensure directory exists */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** Find available CaseX_normalized.json files */
function listNormalizedCaseFiles(testOutputsDir) {
  if (!fs.existsSync(testOutputsDir)) return [];
  const files = fs.readdirSync(testOutputsDir);
  return files
    .filter((f) => /^Case\d+_normalized\.json$/.test(f))
    .map((f) => ({ file: f, caseNumber: parseInt(f.replace(/\D/g, ""), 10) }))
    .sort((a, b) => a.caseNumber - b.caseNumber);
}

/** Try to load raw case text (heuristic directories) */
function findCaseText(caseNumber) {
  const candidates = [
    path.resolve(`cases/case${caseNumber}.txt`),
    path.resolve(`backend/cases/case${caseNumber}.txt`),
    path.resolve(`src/cases/case${caseNumber}.txt`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }
  return null;
}

/** Load normalized JSON if present; otherwise run normalizer (if available) */
async function loadOrNormalizeCase({ caseNumber, testOutputsDir }) {
  const normalizedPath = path.resolve(testOutputsDir, `Case${caseNumber}_normalized.json`);
  if (fs.existsSync(normalizedPath)) {
    const json = JSON.parse(fs.readFileSync(normalizedPath, "utf-8"));
    return { source: "normalized", caseNumber, data: json };
  }
  if (!MedicalDocumentNormalizer) {
    return { source: "missing", caseNumber, data: null };
  }
  const rawText = findCaseText(caseNumber);
  if (!rawText) {
    return { source: "raw_missing", caseNumber, data: null };
  }
  try {
    const normalizer = new MedicalDocumentNormalizer();
    const start = Date.now();
    const data = await normalizer.normalize(rawText);
    const elapsedMs = Date.now() - start;
    fs.writeFileSync(normalizedPath, JSON.stringify(data, null, 2), "utf-8");
    logger.info({ event: "normalized_case", caseNumber, elapsedMs });
    return { source: "normalized_from_raw", caseNumber, data };
  } catch (err) {
    logger.warn({ event: "normalize_failed", caseNumber, message: String(err) });
    return { source: "normalize_failed", caseNumber, data: null };
  }
}

/** Safely get medical records from either top-level or nested normalizedData */
function getMedicalRecords(normalized) {
  const nested = normalized?.normalizedData;
  if (Array.isArray(nested?.medicalRecords)) return nested.medicalRecords;
  if (Array.isArray(normalized?.medicalRecords)) return normalized.medicalRecords;
  return [];
}

/** Extract summary metrics from normalized data */
function summarizeCase(normalized) {
  if (!normalized) return { records: 0, hospitals: new Set(), periodText: "", issues: [] };
  const recs = getMedicalRecords(normalized);
  const hospitals = new Set();
  let firstDate = null;
  let lastDate = null;
  for (const r of recs) {
    if (r.hospital) hospitals.add(r.hospital);
    if (r.date) {
      const d = new Date(String(r.date));
      if (!Number.isNaN(d.getTime())) {
        if (!firstDate || d < firstDate) firstDate = d;
        if (!lastDate || d > lastDate) lastDate = d;
      }
    }
  }
  const periodText = firstDate && lastDate
    ? `${firstDate.toISOString().slice(0, 10)} ~ ${lastDate.toISOString().slice(0, 10)}`
    : "";
  return {
    records: recs.length,
    hospitals,
    periodText,
    issues: [],
  };
}

/**
 * Format ICD codes in text for HTML display.
 * - Removes labels like "(ICD: CODE)" and renders bold canonical code
 * - Normalizes dotted variations e.g., (ICD: I20).9 -> I20.9
 */
function formatIcdInText(text) {
  if (typeof text !== "string" || text.length === 0) return text || "";
  let s = text;
  // Fix stray dot outside ICD parentheses: ((ICD: I20).9) -> (ICD: I20.9)
  s = s.replace(/\(\s*ICD\s*:\s*([A-Z])\s*([0-9]{2})\s*\)\s*\.+\s*([0-9A-Z]{1,2})/g,
    (_m, L, M, m) => `(ICD: ${L}${M}.${m})`);
  const toBoldCode = (code) => {
    const raw = String(code).replace(/\s+/g, "");
    if (/^[A-Z][0-9]{2}[0-9A-Z]{1,2}$/.test(raw)) {
      return `<strong class="icd-code">${raw.slice(0, 3)}.${raw.slice(3)}</strong>`;
    }
    return `<strong class="icd-code">${raw}</strong>`;
  };
  // Replace (ICD: CODE) with bold code
  s = s.replace(/\(\s*ICD\s*:\s*([A-Z]\s*[0-9]{2}(?:\s*[0-9A-Z]{1,2})?)\s*\)/g,
    (_m, code) => toBoldCode(code));
  // Replace standalone forms: ICD 코드 R074, ICD: I209, ICD I20 9
  s = s.replace(/ICD\s*코드\s*[:\s]?\s*([A-Z]\s*[0-9]{2}(?:\s*[0-9A-Z]{1,2})?)/g,
    (_m, code) => toBoldCode(code));
  s = s.replace(/ICD\s*[:\s]?\s*([A-Z]\s*[0-9]{2}(?:\s*[0-9A-Z]{1,2})?)/g,
    (_m, code) => toBoldCode(code));
  return s;
}

/** Normalize diagnosis text: trim, collapse spaces, lighten nested parentheses */
function normalizeDiagnosisText(text) {
  if (typeof text !== "string") return "";
  let s = text.trim();
  s = s.replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ");
  // Remove space before/after parentheses
  s = s.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  // Simplify nested parentheses by removing inner pairs once
  s = s.replace(/\([^()]*\([^()]+\)[^()]*\)/g, (m) => m.replace(/\([^()]+\)/g, "").replace(/\s{2,}/g, " ").trim());
  // Canonicalize ICD-like tokens inside free text
  s = s.replace(/\b([A-Z])\s*([0-9]{2})\s*([0-9A-Z]{1,2})\b/g, (_m, L, M, m) => `${L}${M}.${m}`);
  return s;
}

/** Detect ICD pattern presence */
function hasIcdPattern(text) {
  if (typeof text !== "string") return false;
  const s = text;
  return /\bICD\b/.test(s)
    || /\b[A-Z][0-9]{2}\.[0-9A-Z]{1,2}\b/.test(s)
    || /\b[A-Z][0-9]{2}\b/.test(s); // coarse fallback
}

/** Detect important medical keywords (coarse heuristic) */
function hasImportantKeywords(text) {
  if (typeof text !== "string") return false;
  const s = text.toLowerCase();
  const keywords = [
    "angina", // stable/typical angina
    "coronary",
    "coronary artery",
    "cad",
    "협심증",
    "관상동맥",
    "diabetes",
    "당뇨",
  ];
  return keywords.some((k) => s.includes(k));
}

/**
 * Collect diagnosis samples across a case for visual verification.
 */
function collectDiagnosisSamples({ caseNumber, normalized, maxPerCase = 2 }) {
  const recs = getMedicalRecords(normalized);
  // Score records by ICD presence and keyword proximity
  const scored = [];
  for (const r of recs) {
    const rawDx = String(r?.diagnosis ?? "");
    const dxNorm = normalizeDiagnosisText(rawDx);
    if (!dxNorm || /^(미확인|unknown)$/i.test(dxNorm)) continue;
    let score = 0;
    if (hasIcdPattern(dxNorm)) score += 3;
    if (hasImportantKeywords(dxNorm)) score += 2;
    // Prefer records with explicit visit date
    if (r?.date) score += 1;
    scored.push({
      score,
      caseNumber,
      date: r?.date ? String(r.date) : "",
      hospital: r?.hospital ? String(r.hospital) : "",
      diagnosis: dxNorm,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxPerCase);
}

/** Diagnose common formatting issues in diagnosis fields */
function analyzeDiagnosisIssues(records) {
  const issues = {
    spacing: 0,
    englishDuplicate: 0,
    nestedParentheses: 0,
    normalizationDiff: 0,
    icdFormatIssue: 0,
  };
  for (const r of records ?? []) {
    const dx = String(r.diagnosis ?? "");
    if (!dx) continue;
    if (/\(\s/.test(dx) || /\s\)/.test(dx)) issues.spacing++;
    if (/(\b[A-Za-z][A-Za-z\s]+\b).*\(\1\)/.test(dx)) issues.englishDuplicate++;
    if (/\([^()]*\([^()]+\)[^()]*\)/.test(dx)) issues.nestedParentheses++;
    if (/ICD\s*:\s*[A-Z]\d{2}\s*\)\s*\./.test(dx)) issues.icdFormatIssue++;
    // Placeholder for normalization diff detection
    if (/[,，]\s*[^(]+\(/.test(dx)) issues.normalizationDiff++;
  }
  return issues;
}

/** Compute plan progress by checking presence of key modules */
function computePlanProgress() {
  const checks = {
    dateExtractionAdvancement: [
      "backend/postprocess/medicalDocumentNormalizer.js",
      "advancedTextArrayDateClassifier.js",
      "test-date-extraction.js",
    ],
    medicalTerminologyDBExpansion: [
      "src/shared/constants/medical/dictionaries.json",
      "src/shared/constants/medicalDictionaryLoader.js",
    ],
    adaptiveLengthAdjustment: [
      "GatingHybridAIOptimizer.js",
      "textArrayDateControllerOptimized.js",
      "adaptiveProcessor.ts",
    ],
    keywordMatchingEnhancement: [
      "progressiveRAG.js",
      "backend/services/DynamicValidationEngine.js",
    ],
    templateStructuringSystem: [
      "backend/postprocess/medicalDocumentNormalizer.js",
      "EntityNormalizer.js",
    ],
    medicalAIIntegration: [
      "backend/ai-verification/",
      "GatingHybridAIOptimizer.js",
    ],
    contextAwarenessImprovement: [
      "NestedDateResolver.js",
      "hybridMedicalNormalizer.js",
    ],
    expertValidationSystem: [
      "backend/services/DynamicValidationEngine.js",
      "generate-caseX-validation-report.js",
    ],
    ensembleModels: [
      "GatingHybridAIOptimizer.js",
      "streamProcessingOptimizer.js",
    ],
  };

  const statusMap = {};
  const exists = (rel) => fs.existsSync(path.resolve(rel));
  for (const [taskKey, files] of Object.entries(checks)) {
    const foundCount = files.filter((f) => exists(f)).length;
    const status = foundCount >= 2 ? "completed" : foundCount >= 1 ? "in_progress" : "not_started";
    statusMap[taskKey] = { status, foundCount, total: files.length, files };
  }

  const statuses = Object.values(statusMap);
  const total = statuses.length;
  const completed = statuses.filter((s) => s.status === "completed").length;
  const inProgress = statuses.filter((s) => s.status === "in_progress").length;
  const notStarted = statuses.filter((s) => s.status === "not_started").length;
  const completionRate = ((completed + 0.5 * inProgress) / total) * 100;

  return { statusMap, total, completed, inProgress, notStarted, completionRate };
}

/** Try to parse external comprehensive progress HTML report to enrich summary */
function parseExternalProgressReport() {
  const candidates = [
    path.resolve("종합_개발_진행_리포트.html"),
    path.resolve("reports/종합_개발_진행_리포트.html"),
  ];
  let selectedPath = null;
  let html = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      selectedPath = p;
      html = fs.readFileSync(p, "utf-8");
      break;
    }
  }
  if (!html) return { available: false };

  // Heuristic extraction: overall progress and validation score
  // Examples: "overall progress of 82.5%" / "전체 진행률: 82.5%" / "Validation Score: 78.5"
  const percentMatches = html.match(/(?:진행|progress)[^\d%]{0,40}(\d{1,3}(?:\.\d+)?)%/i);
  const validationMatches = html.match(/(?:검증|validation)[^\d]{0,40}(\d{1,3}(?:\.\d+)?)/i);
  const overallProgress = percentMatches ? Number(percentMatches[1]) : null;
  const validationScore = validationMatches ? Number(validationMatches[1]) : null;

  return {
    available: true,
    path: selectedPath,
    overallProgress,
    validationScore,
  };
}

/** Render HTML report */
function renderHTML({ title, overall, caseSummaries, caseIssuesAgg, planProgress, planReference, externalSummary, diagnosisSamples }) {
  const style = `
    body{font-family:Arial,Apple SD Gothic Neo,Malgun Gothic,sans-serif;line-height:1.6;color:#222;padding:24px;background:#f8fafc}
    h1{font-size:22px;margin:0 0 16px}
    h2{font-size:18px;margin:24px 0 8px}
    table{width:100%;border-collapse:collapse;margin:8px 0 16px;background:#fff}
    th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
    th{background:#f1f5f9}
    .ok{color:#0f766e;font-weight:bold}
    .warn{color:#b45309;font-weight:bold}
    .bad{color:#b91c1c;font-weight:bold}
    .muted{color:#6b7280}
    .section{background:#fff;padding:16px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px}
    .pill{display:inline-block;background:#eef2ff;color:#3730a3;padding:4px 8px;border-radius:9999px;margin-right:6px}
    .icd-code{color:#111827;font-weight:bold}
  `;

  const planRows = Object.entries(planProgress.statusMap)
    .map(([key, info]) => {
      const labelMap = {
        dateExtractionAdvancement: "날짜 추출 알고리즘 고도화",
        medicalTerminologyDBExpansion: "의료 용어 데이터베이스 확장",
        adaptiveLengthAdjustment: "적응형 길이 조절",
        keywordMatchingEnhancement: "키워드 매칭 강화",
        templateStructuringSystem: "템플릿 기반 구조화",
        medicalAIIntegration: "의료 AI 모델 통합",
        contextAwarenessImprovement: "컨텍스트 인식 개선",
        expertValidationSystem: "전문가 검증 시스템",
        ensembleModels: "다중 모델 앙상블 적용",
      };
      const statusClass = info.status === "completed" ? "ok" : info.status === "in_progress" ? "warn" : "bad";
      return `<tr>
        <td>${labelMap[key] ?? key}</td>
        <td class="${statusClass}">${info.status}</td>
        <td>${info.foundCount}/${info.total}</td>
      </tr>`;
    })
    .join("");

  const caseRows = caseSummaries
    .map((c) => {
      const hospitalsStr = [...c.hospitals].join(", ") || "-";
      return `<tr>
        <td>Case${c.caseNumber}</td>
        <td>${c.records}</td>
        <td>${hospitalsStr}</td>
        <td>${c.periodText || "-"}</td>
        <td>${c.source}</td>
      </tr>`;
    })
    .join("");

  const issues = caseIssuesAgg;
  const issuesRows = `
    <tr><td>Spacing</td><td>${issues.spacing}</td></tr>
    <tr><td>English Duplicate</td><td>${issues.englishDuplicate}</td></tr>
    <tr><td>Nested Parentheses</td><td>${issues.nestedParentheses}</td></tr>
    <tr><td>Normalization Difference</td><td>${issues.normalizationDiff}</td></tr>
    <tr><td>ICD Format Issue</td><td>${issues.icdFormatIssue}</td></tr>
  `;

  const planSummary = `
    <div class="section">
      <h2>개선계획 기준 공정율</h2>
      <p>
        전체 작업: <span class="pill">${planProgress.total}</span>
        완료: <span class="pill">${planProgress.completed}</span>
        진행중: <span class="pill">${planProgress.inProgress}</span>
        미착수: <span class="pill">${planProgress.notStarted}</span>
      </p>
      <p>달성도(가중치: 완료=1, 진행중=0.5): <b>${planProgress.completionRate.toFixed(1)}%</b></p>
      <table>
        <thead><tr><th>개선과제</th><th>상태</th><th>근거 파일 수</th></tr></thead>
        <tbody>${planRows}</tbody>
      </table>
      <p class="muted">참고: 시스템 종합 리포트의 전체 진행률은 82.5%로 보고됨. 본 표는 초기 개선계획(Task 9개)에 대한 구현 달성도를 기준으로 산출(추가 확인 필요).</p>
    </div>
  `;

  const html = `<!doctype html>
  <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>${style}</style>
    </head>
    <body>
      <h1>${title}</h1>

      <div class="section">
        <h2>요약</h2>
        <p>총 케이스: <b>${overall.totalCases}</b> | 성공 처리: <b>${overall.successCases}</b> | 처리 시간(평균): <b>${overall.avgMs.toFixed(0)}ms</b></p>
        <p>보고서 생성 소스: normalized(<b>${overall.sourceCounts.normalized}</b>), raw→normalized(<b>${overall.sourceCounts.normalized_from_raw}</b>), 누락(<b>${overall.sourceCounts.missing}</b>)</p>
      </div>

      <div class="section">
        <h2>외부 진행 리포트 요약</h2>
        ${externalSummary?.available ? `
          <p>연동된 리포트: <a href="${externalSummary.path}">${externalSummary.path}</a></p>
          <p>전체 진행률: <b>${externalSummary.overallProgress != null ? externalSummary.overallProgress.toFixed(1) + '%': 'N/A'}</b>
             | 검증 점수: <b>${externalSummary.validationScore != null ? externalSummary.validationScore.toFixed(1) : 'N/A'}</b></p>
        ` : `
          <p class="muted">외부 진행 리포트를 찾지 못했습니다. 루트 또는 reports 폴더에 위치한 '종합_개발_진행_리포트.html'을 참조합니다.</p>
        `}
      </div>

      <div class="section">
        <h2>케이스 처리 현황</h2>
        <table>
          <thead><tr><th>케이스</th><th>레코드 수</th><th>병원</th><th>기간</th><th>소스</th></tr></thead>
          <tbody>${caseRows}</tbody>
        </table>
      </div>

      <div class="section">
        <h2>진단명 이슈 집계</h2>
        <table>
          <thead><tr><th>유형</th><th>건수</th></tr></thead>
          <tbody>${issuesRows}</tbody>
        </table>
        <p class="muted">개선 제안: 공백 정규화, 영문-한글 중복 제거, 중첩 괄호 해소, ICD 포맷 일관화.</p>
      </div>

      <div class="section">
        <h2>진단 샘플 (ICD 포맷팅 확인)</h2>
        ${Array.isArray(diagnosisSamples) && diagnosisSamples.length > 0 ? `
          <table>
            <thead><tr><th>케이스</th><th>날짜</th><th>병원</th><th>진단명</th><th>증거</th></tr></thead>
            <tbody>
              ${diagnosisSamples.map(s => `
                <tr>
                  <td>Case${s.caseNumber}</td>
                  <td>${s.date || '-'}</td>
                  <td>${s.hospital || '-'}</td>
                  <td>${formatIcdInText(s.diagnosis)}</td>
                  <td><a href="Case${s.caseNumber}_normalized.json" target="_blank" rel="noopener">JSON</a></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <p class="muted">링크된 JSON은 정규화된 케이스 데이터입니다. 브라우저에서 열어 진단 필드를 확인할 수 있습니다.</p>
        ` : `<p class="muted">진단 샘플을 찾지 못했습니다(추가 확인 필요).</p>`}
      </div>

      ${planSummary}

      <div class="section">
        <h2>개선안 제안</h2>
        <ul>
          <li>Diagnosis normalizer에 공백/중복/중첩 괄호/ICD 포맷 정규화 규칙 추가</li>
          <li>MedicalTermDictionary(제안)와 dictionaries.json 통합 로더로 컨텍스트 기반 필터 강화</li>
          <li>Adaptive Length 조절: 섹션별 길이 가이드 + 요약/확장 자동화 적용</li>
          <li>DynamicValidationEngine에 날짜-진단-처치 상관 규칙 추가 및 스냅샷 계약 테스트</li>
          <li>앙상블 선택 로직에 비용/레이턴시 가중치 도입(핫 경로 우선)</li>
        </ul>
        <p class="muted">성능 영향: (1) 정규화 규칙 추가로 CPU 사용 증가 가능, (2) 검증 단계 확장으로 처리 지연 증가 가능. 대안: 캐싱/배치/서킷브레이커 적용 및 RAG 프리필터 강화.</p>
      </div>

      <div class="section">
        <h2>엣지 케이스</h2>
        <ul>
          <li>동일 날짜에 복수 병원 방문(중복 제거/병원별 묶음)</li>
          <li>ICD 코드 누락 또는 잘못된 포맷(검증/보정)</li>
          <li>영문/한글 진단 중복 표기(하나로 통합)</li>
          <li>중첩 괄호가 포함된 진단명(정규화 해소)</li>
          <li>기간 텍스트만 존재하고 개별 방문일 누락(추론/보안정)</li>
        </ul>
      </div>

      <div class="section">
        <h2>참고</h2>
        <p class="muted">초기 개선계획(3단계/9과제)과 현재 구현을 매핑하여 산출한 달성도입니다. 일부 항목은 파일 존재 기반 휴리스틱으로 평가되었으며, 상세 구현 정도는 추가 확인이 필요합니다.</p>
        <p class="muted">리포트 인덱스: <a href="reports/index.html">reports/index.html</a></p>
      </div>
    </body>
  </html>`;

  return html;
}

async function main() {
  const tempReportsDir = path.resolve("temp/reports");
  const reportsDir = path.resolve("reports");
  const testOutputsDir = path.resolve(path.join(__dirname, "test_outputs"));
  ensureDir(tempReportsDir);
  ensureDir(reportsDir);

  const normalizedFiles = listNormalizedCaseFiles(testOutputsDir);
  const cases = normalizedFiles.length
    ? normalizedFiles.map((f) => f.caseNumber)
    : Array.from({ length: 13 }, (_, i) => i + 1); // default Case1..Case13

  const caseSummaries = [];
  const aggIssues = { spacing: 0, englishDuplicate: 0, nestedParentheses: 0, normalizationDiff: 0, icdFormatIssue: 0 };
  let successCases = 0;
  const sourceCounts = { normalized: 0, normalized_from_raw: 0, missing: 0 };
  const elapsedList = [];
  const diagnosisSamples = [];
  const normalizedPathsToCopy = [];

  for (const caseNumber of cases) {
    const start = Date.now();
    const loaded = await loadOrNormalizeCase({ caseNumber, testOutputsDir });
    const elapsedMs = Date.now() - start;
    elapsedList.push(elapsedMs);
    const normalized = loaded.data;
    const recs = getMedicalRecords(normalized);
    if (normalized && Array.isArray(recs) && recs.length > 0) {
      successCases++;
      const issues = analyzeDiagnosisIssues(recs);
      aggIssues.spacing += issues.spacing;
      aggIssues.englishDuplicate += issues.englishDuplicate;
      aggIssues.nestedParentheses += issues.nestedParentheses;
      aggIssues.normalizationDiff += issues.normalizationDiff;
      aggIssues.icdFormatIssue += issues.icdFormatIssue;
      // Collect diagnosis samples (up to 2 per case)
      diagnosisSamples.push(...collectDiagnosisSamples({ caseNumber, normalized, maxPerCase: 2 }));
      // Track normalized file path for evidence copying if exists
      const normalizedFilePath = path.resolve(testOutputsDir, `Case${caseNumber}_normalized.json`);
      if (fs.existsSync(normalizedFilePath)) {
        normalizedPathsToCopy.push({ caseNumber, src: normalizedFilePath });
      }
    }
    if (loaded.source === "normalized") sourceCounts.normalized++;
    else if (loaded.source === "normalized_from_raw") sourceCounts.normalized_from_raw++;
    else sourceCounts.missing++;

    const summary = summarizeCase(normalized);
    caseSummaries.push({ caseNumber, source: loaded.source, ...summary });
  }

  const avgMs = elapsedList.length ? elapsedList.reduce((a, b) => a + b, 0) / elapsedList.length : 0;
  const planProgress = computePlanProgress();
  const externalSummary = parseExternalProgressReport();

  const html = renderHTML({
    title: "종합 케이스 진행/개선 리포트",
    overall: { totalCases: cases.length, successCases, avgMs, sourceCounts },
    caseSummaries,
    caseIssuesAgg: aggIssues,
    planProgress,
    planReference: improvementStrategy,
    externalSummary,
    diagnosisSamples,
  });

  // Write to temp/reports for dedicated preview server
  const outPathTemp = path.resolve(tempReportsDir, "Comprehensive_Case_Progress_Report.html");
  fs.writeFileSync(outPathTemp, html, "utf-8");
  // Also write to reports for existing http-server on port 5500
  const outPathReports = path.resolve(reportsDir, "Comprehensive_Case_Progress_Report.html");
  fs.writeFileSync(outPathReports, html, "utf-8");
  logger.info({ event: "report_written", paths: [outPathTemp, outPathReports] });
  // Copy normalized evidence JSONs to both temp/reports and reports
  try {
    for (const p of normalizedPathsToCopy) {
      const dstTemp = path.resolve(tempReportsDir, `Case${p.caseNumber}_normalized.json`);
      const dstRep = path.resolve(reportsDir, `Case${p.caseNumber}_normalized.json`);
      fs.copyFileSync(p.src, dstTemp);
      fs.copyFileSync(p.src, dstRep);
    }
    logger.info({ event: "evidence_copied", count: normalizedPathsToCopy.length });
  } catch (err) {
    logger.warn({ event: "evidence_copy_failed", message: String(err) });
  }
  return outPathReports;
}

// Execute when run directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    logger.error({ event: "report_failed", message: String(err) });
    process.exitCode = 1;
  });
}
