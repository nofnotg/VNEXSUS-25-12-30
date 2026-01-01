import { MedicalEvent } from "../types/index";
import { WEIGHTS } from "../../../shared/constants/medicalEvents";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const severity = (ev: MedicalEvent) => {
  const t = ev.meta?.tags || [];
  let s = 0;
  if (t.includes("입원")) s += 0.9;
  if (t.includes("수술")) s += 0.9;
  if (t.includes("영상검사")) s += 0.4;
  return Math.min(1, s);
};

const proximityToContract = (ev: MedicalEvent, contractDate?: string) => {
  if (!contractDate) return 0.5;
  const ed = new Date(ev.date).getTime();
  const cd = new Date(contractDate).getTime();
  if (!Number.isFinite(ed) || !Number.isFinite(cd)) return 0.5;
  const diffDays = Math.abs(ed - cd) / (1000 * 60 * 60 * 24);
  const s = diffDays < 90 ? 1 : diffDays < 365 ? 0.7 : diffDays < 5 * 365 ? 0.4 : 0.2;
  return s;
};

const documentationStrength = (ev: MedicalEvent) => {
  const evi = ev.meta?.evidence || [];
  const hasPathology = (ev.slots.pathology || []).length > 0;
  const hasSurgery = (ev.slots.treatment || []).some(t => /수술|시술/.test(t));
  const base = Math.min(1, evi.length * 0.1);
  let bonus = 0;
  if (hasPathology) bonus += 0.4;
  if (hasSurgery) bonus += 0.3;
  return Math.min(1, base + bonus);
};

const claimRelevance = (ev: MedicalEvent, claimKeywords?: string[]) => {
  if (!claimKeywords || claimKeywords.length === 0) return 0.5;
  const s = (ev.slots.diagnosis || []).concat(ev.slots.examination || []).join(" ");
  let hits = 0;
  for (const k of claimKeywords) {
    if (s.toLowerCase().includes(k.toLowerCase())) hits++;
  }
  return Math.min(1, hits / Math.max(1, claimKeywords.length));
};

const repetitionPattern = (current: MedicalEvent, all: MedicalEvent[]) => {
  const sameDay = all.filter(e => e.date === current.date).length;
  return Math.min(1, Math.max(0, sameDay - 1) * 0.2);
};

const disclosureTrigger = (ev: MedicalEvent) => {
  const o = ev.slots.doctorOpinion || "";
  return /(입원 필요|수술 필요|추가검사|재검)/.test(o) ? 0.8 : 0.2;
};

export const scoreEvent = (ev: MedicalEvent, all: MedicalEvent[], opts?: { contractDate?: string; claimKeywords?: string[] }) => {
  const f1 = severity(ev);
  const f2 = proximityToContract(ev, opts?.contractDate);
  const f3 = documentationStrength(ev);
  const f4 = claimRelevance(ev, opts?.claimKeywords);
  const f5 = repetitionPattern(ev, all);
  const f6 = disclosureTrigger(ev);
  const s = WEIGHTS.severity * f1 + WEIGHTS.proximityToContract * f2 + WEIGHTS.documentationStrength * f3 + WEIGHTS.claimRelevance * f4 + WEIGHTS.repetitionPattern * f5 + WEIGHTS.disclosureTrigger * f6;
  return Number(sigmoid(s).toFixed(3));
};

export const computeRelations = (events: MedicalEvent[]) => {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const rels: { toDate: string; rel: number }[] = [];
    for (let j = 0; j < events.length; j++) {
      if (i === j) continue;
      const tSameDx = intersect(events[i].slots.diagnosis || [], events[j].slots.diagnosis || []).length > 0 ? 0.4 : 0;
      const tExamChain = intersect(events[i].slots.examination || [], events[j].slots.examination || []).length > 0 ? 0.3 : 0;
      const tTime = timeRel(events[i].date, events[j].date);
      const rel = Math.min(1, tSameDx + tExamChain + tTime);
      if (rel >= 0.3) rels.push({ toDate: events[j].date, rel: Number(rel.toFixed(3)) });
    }
    if (!events[i].meta) events[i].meta = {};
    events[i].meta.relEdges = rels;
  }
  return events;
};

const intersect = (a: string[], b: string[]) => {
  const s = new Set(a);
  return b.filter(x => s.has(x));
};

const timeRel = (a: string, b: string) => {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0.1;
  const diffDays = Math.abs(ta - tb) / (1000 * 60 * 60 * 24);
  if (diffDays <= 14) return 0.3;
  if (diffDays <= 60) return 0.2;
  if (diffDays <= 180) return 0.1;
  return 0.05;
};

