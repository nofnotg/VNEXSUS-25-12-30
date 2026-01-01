import fs from "fs";
import path from "path";

const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const safeExists = (p: string) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};
const readJSON = (p: string) => JSON.parse(fs.readFileSync(p, "utf-8"));

const items = [
  { name: "태그 사전 병합·검출 함수 적용(dateBindingV3)", ref: "src/shared/constants/tagSynonyms.ts", done: true },
  { name: "골든 비교 자동화 스크립트 추가(_golden_diff)", ref: "scripts/compare-with-golden.ts", done: true },
  { name: "지표 스크립트 개선(정규화·유효 날짜율)", ref: "scripts/compute-metrics.ts", done: true },
  { name: "지표에 태그 분포 집계 추가", ref: "scripts/compute-metrics.ts", done: true },
  { name: "민감도 튜닝 재배치 및 golden 비교 실행", ref: "env:BIND_RADIUS,BIND_TABLE_TOL", done: true },
  { name: "가중치 환경변수화(퍼센트→정규화)와 지표 퍼센트 표시", ref: "src/shared/constants/medicalEvents.ts", done: true },
  { name: "파라미터 스위프 스크립트 추가·실행·요약 생성", ref: "scripts/param-sweep.ts", done: true },
  { name: "통합 오케스트레이션 스크립트 추가·실행·대시보드 생성", ref: "scripts/orchestrate-all.ts", done: true },
  { name: "자동 플래그 추천 스크립트 추가·실행", ref: "scripts/auto-flag-ten.ts", done: true },
  { name: "컨트롤러 플래그 연계(opt-in 기본값)", ref: "src/controllers/reportController.ts", done: true },
  { name: "태그 유닛 테스트 추가 및 실행", ref: "tests/unit/tagSynonyms.test.ts", done: true },
  { name: "통합 실행 스크립트 추가(ten:all)", ref: "package.json scripts", done: true },
  { name: "골든 비교 지표 개선(diff: events·dates·tags)", ref: "scripts/compare-with-golden.ts", done: true },
];

const main = () => {
  const dateStr = today();
  const outDir = path.resolve(process.cwd(), "outputs/progress");
  fs.mkdirSync(outDir, { recursive: true });
  const offlineDir = path.resolve(process.cwd(), "offline/progress");
  fs.mkdirSync(offlineDir, { recursive: true });
  const metricsPath = path.resolve(process.cwd(), "outputs/ten-report/_metrics.json");
  const diffPath = path.resolve(process.cwd(), "outputs/ten-report/_golden_diff.json");
  const metrics = safeExists(metricsPath) ? readJSON(metricsPath) : {};
  const diff = safeExists(diffPath) ? readJSON(diffPath) : {};
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const overallPct = Math.round((done / Math.max(1, total)) * 100);
  const avgPct = metrics?.totals?.avgScorePercent ?? 0;
  const dateValidPct = Math.round(((metrics?.totals?.dateValidRate ?? 0) * 100));
  const goldenOkRate = Math.round((((diff?.cases || []).filter((c: any) => c.ok === true).length / Math.max(1, (diff?.cases || []).length)) * 100));
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>개선계획 공정율 대시보드 - ${dateStr}</title>
<style>
:root{--deep-blue:#0b1f3a;--blue-700:#14355f;--blue-500:#215e9b;--blue-300:#4fa3e3;--blue-200:#8ec9f0;--accent:#18a0fb;--text:#e6eef7;--muted:#a8b6c6;--card:#102a4a}
html,body{height:100%;background:var(--deep-blue);color:var(--text);margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",Arial,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:32px}
.header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:16px;margin-bottom:24px}
.title{font-size:28px;font-weight:700;letter-spacing:.3px}
.date{font-size:14px;color:var(--blue-200)}
.overall{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.card{background:linear-gradient(180deg,var(--card),var(--blue-700));border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.4);padding:18px}
.metric{display:flex;justify-content:space-between;align-items:center;margin:6px 0}
.metric .label{color:var(--muted);font-size:13px}
.metric .value{font-size:18px;font-weight:600}
.progress{margin-top:8px;background:rgba(255,255,255,.08);border-radius:999px;height:12px;overflow:hidden}
.bar{height:100%;background:linear-gradient(90deg,var(--blue-300),var(--accent))}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.item{display:grid;gap:8px}
.item .name{font-weight:600;font-size:15px}
.status{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--blue-200)}
.pill{padding:4px 10px;border-radius:999px;background:rgba(24,160,251,.18);border:1px solid rgba(24,160,251,.35);color:var(--text);font-size:12px}
.footer{margin-top:24px;font-size:12px;color:var(--muted)}
a{color:var(--blue-200);text-decoration:none}a:hover{color:var(--blue-300)}
</style></head><body><div class="wrap">
<div class="header"><div class="title">개선계획 공정율 대시보드</div><div class="date">작성일: ${dateStr}</div></div>
<div class="overall">
 <div class="card"><div class="metric"><div class="label">전체 공정율</div><div class="value">${overallPct}%</div></div><div class="progress"><div class="bar" style="width:${overallPct}%"></div></div></div>
 <div class="card"><div class="metric"><div class="label">지표 요약</div><div class="value">AvgScore ${avgPct}%</div></div><div class="metric"><div class="label">Golden OK</div><div class="value">${goldenOkRate}%</div></div><div class="metric"><div class="label">Date Valid</div><div class="value">${dateValidPct}%</div></div></div>
</div>
<div class="grid">
${items.map(i => `<div class="card item"><div class="name">${i.name}</div><div class="status"><span class="pill">${i.done ? "완료" : "진행중"}</span><span>파일: ${i.ref}</span></div><div class="progress"><div class="bar" style="width:${i.done ? 100 : 50}%"></div></div></div>`).join("")}
</div>
<div class="footer">참고: 상세 지표는 <a href="../ten-report/_metrics.md">_metrics.md</a>, 골든 비교는 <a href="../ten-report/_golden_diff.md">_golden_diff.md</a>, 스위프 요약은 <a href="../sweep/_sweep.md">_sweep.md</a></div>
</div></body></html>`;
  const outFile = path.resolve(outDir, `${dateStr}-progress.html`);
  fs.writeFileSync(outFile, html, "utf-8");
  console.log(outFile);
  const offFile = path.resolve(offlineDir, `${dateStr}-progress.html`);
  fs.writeFileSync(offFile, html, "utf-8");
  console.log(offFile);
};

main();
