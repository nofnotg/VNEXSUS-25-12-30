import fs from "fs";
import path from "path";
import { BindInput } from "../types/index";
import iconv from "iconv-lite";

const normalizeDateISO = (s: string) => {
  const m1 = s.match(/(\d{4})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  const m2 = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  return s;
};

const stripBOM = (s: string) => s.replace(/^\uFEFF/, "");
const read = (p: string) => stripBOM(fs.readFileSync(p, "utf-8"));
const num = (v: any) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const bboxOf = (o: any) => {
  const page = num(o?.page ?? o?.bbox?.page ?? 0);
  const x = num(o?.x ?? o?.bbox?.x ?? 0);
  const y = num(o?.y ?? o?.bbox?.y ?? 0);
  const width = num(o?.width ?? o?.bbox?.width ?? 0);
  const height = num(o?.height ?? o?.bbox?.height ?? 0);
  return { page, x, y, width, height };
};

const defaultBBox = (page: number) => ({ page: num(page ?? 0), x: 0.5, y: 0.5, width: 0.1, height: 0.1 });
const isValidISODate = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), da = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  if (da < 1 || da > 31) return false;
  const dt = new Date(y, mo - 1, da);
  const ok = Number.isFinite(dt.getTime()) && dt.getFullYear() === y && dt.getMonth() + 1 === mo && dt.getDate() === da;
  if (!ok) return false;
  const todayPlus = Date.now() + 1000 * 60 * 60 * 24 * 30;
  return dt.getTime() <= todayPlus;
};

const parseJSON = (p: string) => {
  let obj: any;
  try {
    const raw = read(p);
    obj = JSON.parse(raw);
  } catch {
    try {
      const buf = fs.readFileSync(p);
      const decoders = ["utf8", "cp949", "euc-kr"] as const;
      for (const enc of decoders) {
        try {
          const s = enc === "utf8" ? buf.toString("utf8") : iconv.decode(buf, enc);
          obj = JSON.parse(stripBOM(s));
          break;
        } catch {}
      }
      if (!obj) obj = {};
    } catch {
      obj = {};
    }
  }
  const mapBlock = (b: any) => ({
    text: String(b.text || b.content || ""),
    bbox:
      b.bbox ||
      (b.BoundingBox
        ? {
            page: num(b.page ?? 0),
            x: num(b.BoundingBox.Left ?? 0),
            y: num(b.BoundingBox.Top ?? 0),
            width: num(b.BoundingBox.Width ?? 0),
            height: num(b.BoundingBox.Height ?? 0),
          }
        : bboxOf(b)),
    page: num(b.page ?? b.bbox?.page ?? 0),
    confidence: clamp01(num(b.confidence ?? b.Confidence ?? 0.6)),
  });
  if (Array.isArray(obj.dates) && Array.isArray(obj.blocks)) {
    const out: BindInput = {
      dates: obj.dates.map((d: any) => ({
        text: String(d.text || d.date || ""),
        bbox: bboxOf(d),
        confidence: clamp01(num(d.confidence ?? 0.7)),
        kind: d.kind,
      })),
      blocks: obj.blocks.map(mapBlock),
      contractDate: obj.contractDate ? normalizeDateISO(String(obj.contractDate)) : undefined,
    };
    return out;
  }
  if (Array.isArray(obj.items)) {
    const dates = obj.items.filter((i: any) => i.type === "date").map((d: any) => ({
      text: String(d.text || ""),
      bbox: bboxOf(d),
      confidence: clamp01(num(d.confidence ?? 0.7)),
      kind: d.kind,
    }));
    const blocks = obj.items.filter((i: any) => i.type !== "date").map(mapBlock);
    return { dates, blocks } as BindInput;
  }
  if (Array.isArray(obj)) {
    const dates = obj.filter((i: any) => i.kind === "date").map((d: any) => ({
      text: String(d.text || ""),
      bbox: bboxOf(d),
      confidence: clamp01(num(d.confidence ?? 0.7)),
      kind: d.kind,
    }));
    const blocks = obj.filter((i: any) => i.kind !== "date").map(mapBlock);
    return { dates, blocks } as BindInput;
  }
  // Fallbacks for alternate shapes
  if (Array.isArray(obj.blocks) && obj.blocks.length > 0) {
    const blocks = obj.blocks.map((b: any) => {
      const bb = mapBlock(b);
      if (!bb.bbox || (!bb.bbox.width && !bb.bbox.height)) {
        bb.bbox = defaultBBox(bb.page);
      }
      return bb;
    });
    return { dates: [], blocks } as BindInput;
  }
  if (Array.isArray(obj.lines) && obj.lines.length > 0) {
    const blocks = obj.lines.map((ln: any) => {
      const page = num(ln.page ?? 0);
      const bbox =
        ln.BoundingBox
          ? {
              page,
              x: num(ln.BoundingBox.Left ?? 0),
              y: num(ln.BoundingBox.Top ?? 0),
              width: num(ln.BoundingBox.Width ?? 0),
              height: num(ln.BoundingBox.Height ?? 0),
            }
          : defaultBBox(page);
      return { text: String(ln.text || ln.content || ""), bbox, page, confidence: clamp01(num(ln.Confidence ?? 0.6)) };
    });
    return { dates: [], blocks } as BindInput;
  }
  if (typeof obj.text === "string" && obj.text.length > 0) {
    const chunks = obj.text.split(/\r?\n\r?\n/).filter(s => s.trim().length > 0).slice(0, 500);
    const blocks = chunks.map(t => ({ text: t, bbox: defaultBBox(1), page: 1, confidence: 0.6 }));
    return { dates: [], blocks } as BindInput;
  }
  return { dates: [], blocks: [] } as BindInput;
};

const parseNDJSON = (p: string) => {
  const lines = read(p).split(/\r?\n/).filter(l => l.trim().length > 0);
  const items = lines.map(l => JSON.parse(stripBOM(l)));
  const dates = items.filter((i: any) => (i.kind || i.type) === "date").map((d: any) => ({
    text: String(d.text || ""),
    bbox: bboxOf(d),
    confidence: clamp01(num(d.confidence ?? 0.7)),
    kind: d.kind || d.type,
  }));
  const blocks = items.filter((i: any) => (i.kind || i.type) !== "date").map((b: any) => ({
    text: String(b.text || ""),
    bbox: bboxOf(b),
    page: num(b.page ?? b.bbox?.page ?? 0),
    confidence: clamp01(num(b.confidence ?? 0.6)),
  }));
  return { dates, blocks } as BindInput;
};

const parseCSV = (p: string) => {
  const lines = read(p).split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(",");
  const idx = (k: string) => header.findIndex(h => h.trim().toLowerCase() === k);
  const textIdx = idx("text");
  const pageIdx = idx("page");
  const xIdx = idx("bbox_x");
  const yIdx = idx("bbox_y");
  const wIdx = idx("bbox_w");
  const hIdx = idx("bbox_h");
  const kindIdx = idx("kind");
  const confIdx = idx("confidence");
  const dates: any[] = [];
  const blocks: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const rec = {
      text: cols[textIdx],
      page: num(cols[pageIdx]),
      bbox: { page: num(cols[pageIdx]), x: num(cols[xIdx]), y: num(cols[yIdx]), width: num(cols[wIdx]), height: num(cols[hIdx]) },
      kind: cols[kindIdx],
      confidence: clamp01(num(cols[confIdx] ?? 0.6)),
    };
    if ((rec.kind || "").toLowerCase() === "date") dates.push(rec);
    else blocks.push(rec);
  }
  return { dates, blocks } as BindInput;
};

export const loadBindInputFromFile = (p: string) => {
  const ext = path.extname(p).toLowerCase();
  const base = path.basename(p).toLowerCase();
  if (base === "manifest" || base.startsWith("manifest")) return { dates: [], blocks: [] } as BindInput;
  let out: BindInput;
  if (ext === ".json") out = parseJSON(p);
  else if (ext === ".ndjson") out = parseNDJSON(p);
  else if (ext === ".csv") out = parseCSV(p);
  else out = parseJSON(p);
  const fix = (bb: any, pg: number) => {
    if (!bb || typeof bb !== "object") return defaultBBox(pg);
    const page = typeof bb.page === "number" ? bb.page : num(pg ?? 0);
    const x = typeof bb.x === "number" ? bb.x : 0.5;
    const y = typeof bb.y === "number" ? bb.y : 0.5;
    const width = typeof bb.width === "number" ? bb.width : 0.1;
    const height = typeof bb.height === "number" ? bb.height : 0.1;
    return { page, x, y, width, height };
  };
  out.blocks = (out.blocks || []).map(b => ({
    ...b,
    page: typeof b.page === "number" ? b.page : 1,
    bbox: fix(b.bbox, b.page),
    confidence: clamp01(num(b.confidence ?? 0.6)),
  }));
  out.dates = (out.dates || []).map(d => ({
    ...d,
    bbox: fix((d as any).bbox, (d as any).page ?? 1),
    confidence: clamp01(num((d as any).confidence ?? 0.7)),
    text: String((d as any).text || ""),
  }));
  if (!out.dates || out.dates.length === 0) {
    const pattern = /(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})|(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
    const seen = new Set<string>();
    for (const b of out.blocks || []) {
      const m = String(b.text || "").matchAll(pattern);
      for (const mm of m) {
        const dateText = mm[0];
        const iso = normalizeDateISO(dateText);
        if (isValidISODate(iso) && !seen.has(iso)) {
          seen.add(iso);
          out.dates.push({ text: dateText, bbox: b.bbox || defaultBBox(b.page), confidence: 0.7, kind: undefined } as any);
        }
      }
    }
  }
  return out;
};

