import { z } from "zod";
import {
  BindInput,
  BindOutput,
  DateBox,
  TextBlock,
  MedicalEvent,
  Evidence,
} from "../types/index";
import { BINDING_CONFIG } from "../../../shared/config/binding";
import { detectTags } from "../../../shared/constants/tagSynonyms";

const KEYWORDS = {
  visit: ["내원", "방문", "외래", "응급"],
  surgery: ["수술", "시술", "수술일"],
  exam: ["검사", "영상", "CT", "MRI", "X-ray", "초음파", "내시경", "조직검사"],
  report: ["보고", "판독", "리포트", "결과지"],
  admission: ["입원"],
  discharge: ["퇴원"],
};

const within = (a: number, b: number, d: number) => Math.abs(a - b) <= d;

const distance = (a: TextBlock | DateBox, b: TextBlock | DateBox) => {
  const ax = a.bbox.x + a.bbox.width / 2;
  const ay = a.bbox.y + a.bbox.height / 2;
  const bx = b.bbox.x + b.bbox.width / 2;
  const by = b.bbox.y + b.bbox.height / 2;
  return Math.hypot(ax - bx, ay - by);
};

const isHeader = (block: TextBlock) => block.bbox.y < 0.08;
const isFooter = (block: TextBlock) => block.bbox.y > 0.92;

const isTableLike = (blocks: TextBlock[], page: number) => {
  const pageBlocks = blocks.filter(b => b.page === page);
  if (pageBlocks.length < 6) return false;
  let rows = 0;
  for (let i = 1; i < pageBlocks.length; i++) {
    if (within(pageBlocks[i - 1].bbox.y, pageBlocks[i].bbox.y, BINDING_CONFIG.tableRowTolerance)) rows++;
  }
  return rows > Math.floor(pageBlocks.length * 0.3);
};

const keywordScore = (text: string) => {
  let s = 0;
  for (const group of Object.values(KEYWORDS)) {
    for (const k of group) {
      if (text.includes(k)) s += 1;
    }
  }
  return s;
};

const normalizeDateISO = (s: string) => {
  const m1 = s.match(/(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const mo = m1[2].padStart(2, "0");
    const da = m1[3].padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  const m2 = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m2) {
    const y = m2[1];
    const mo = m2[2].padStart(2, "0");
    const da = m2[3].padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return s;
};

const pickEvidence = (around: TextBlock[], k: number): Evidence[] => {
  const arr = around
    .slice(0, k)
    .map(b => ({
      page: b.page,
      bbox: b.bbox,
      snippet: b.text.length > 200 ? b.text.slice(0, 200) : b.text,
      confidence: 0.5 + Math.min(0.5, keywordScore(b.text) * 0.05),
    }));
  return arr;
};

export const bindDatesToEvents = (input: BindInput, opts?: { radius?: number; maxEvidence?: number }) => {
  const params = {
    radius: opts?.radius ?? BINDING_CONFIG.radius,
    maxEvidence: opts?.maxEvidence ?? BINDING_CONFIG.maxEvidence,
  };
  BindInput.parse(input);
  const events: MedicalEvent[] = [];
  for (const d of input.dates) {
    const pageBlocks = input.blocks.filter(b => b.page === d.bbox.page);
    const filtered = pageBlocks.filter(b => !(isHeader(b) || isFooter(b)));
    const tableLike = isTableLike(filtered, d.bbox.page);
    const candidates = filtered
      .map(b => ({ b, dist: distance(b, d) }))
      .filter(x => x.dist <= params.radius)
      .sort((a, b) => a.dist - b.dist)
      .map(x => x.b);
    const around = tableLike ? candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.5))) : candidates;
    const extra = filtered
      .filter(b => !around.includes(b))
      .filter(b => {
        const t = detectTags(b.text);
        return t.includes("과거력") || t.includes("의사소견");
      })
      .sort((a, b) => keywordScore(b.text) - keywordScore(a.text))
      .slice(0, Math.max(1, Math.min(3, params.maxEvidence)));
    const ev: MedicalEvent = {
      date: normalizeDateISO(d.text),
      slots: {
        visitDate: normalizeDateISO(d.text),
      },
      meta: {
        evidence: pickEvidence([...around, ...extra], params.maxEvidence),
        tags: [],
        needsReview: [],
      },
    };
    const tagSet = new Set<string>();
    for (const b of around) {
      const tags = detectTags(b.text);
      for (const t of tags) tagSet.add(t);
    }
    ev.meta!.tags = Array.from(tagSet);
    events.push(ev);
  }
  const out: BindOutput = { events };
  return BindOutput.parse(out);
};

export const DateBindingV3 = {
  bindDatesToEvents,
};

