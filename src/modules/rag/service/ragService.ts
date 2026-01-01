import fs from "fs";

type CodeEntry = { code?: string; english?: string; korean?: string; source?: string; date?: string; confidence?: number };

const ensureStore = (path: string) => {
  try {
    fs.mkdirSync(require("path").dirname(path), { recursive: true });
    if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify({ codes: [], exams: [] }, null, 2), "utf-8");
  } catch {}
};

const loadStore = (path: string) => {
  ensureStore(path);
  try {
    const raw = fs.readFileSync(path, "utf-8");
    return JSON.parse(raw) as { codes: CodeEntry[]; exams: CodeEntry[] };
  } catch {
    return { codes: [], exams: [] };
  }
};

const saveStore = (path: string, data: { codes: CodeEntry[]; exams: CodeEntry[] }) => {
  try {
    fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
};

export const RAGService = {
  storePath: "data/rag-cache.json",
  async lookupCode(q: { code?: string; english?: string; korean?: string }, webFetch?: (url: string) => Promise<any>) {
    const store = loadStore(this.storePath);
    const hit = store.codes.find(
      c =>
        (q.code && c.code === q.code) ||
        (q.english && c.english?.toLowerCase() === q.english.toLowerCase()) ||
        (q.korean && c.korean === q.korean),
    );
    if (hit) return hit;
    if (webFetch) {
      try {
        const res = await webFetch("https://icd.codes/api"); 
        const entry: CodeEntry = { code: q.code, english: q.english, korean: q.korean, source: "web", date: new Date().toISOString(), confidence: 0.6 };
        store.codes.push(entry);
        saveStore(this.storePath, store);
        return entry;
      } catch {}
    }
    return undefined;
  },
  async normalizeExamAbbrev(s: string, webFetch?: (url: string) => Promise<any>) {
    const store = loadStore(this.storePath);
    const base = {
      CT: "Computed Tomography",
      MRI: "Magnetic Resonance Imaging",
      EGD: "Esophagogastroduodenoscopy",
      TEE: "Transesophageal Echocardiogram",
      ECG: "Electrocardiogram",
      EKG: "Electrocardiogram",
    } as Record<string, string>;
    const key = s.toUpperCase();
    const local = base[key];
    if (local) return { english: local, korean: undefined, confidence: 0.8 };
    if (webFetch) {
      try {
        const res = await webFetch("https://example.com/medical-abbrev");
        return { english: s, korean: undefined, confidence: 0.5 };
      } catch {}
    }
    return { english: s, korean: undefined, confidence: 0.4 };
  },
};

