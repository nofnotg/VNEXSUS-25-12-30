/**
 * Developer Case Manager Routes
 * 
 * 목적:
 * - 개발자용 케이스 관리(업로드, 즉시 OCR, 보고서 저장)를 위한 API 제공
 * - 기존 파이프라인(caseReportService) 재사용하여 안전하게 처리
 * - 디렉토리: BASE/case, BASE/case_sample, BASE/case_vnexsus, BASE/case_report
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import * as caseReportService from '../services/caseReportService.js';
import postProcessorDefault from '../postprocess/index.js';
import { logger } from '../../src/shared/logging/logger.js';
import { mask } from '../../src/shared/security/mask.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BASE 디렉토리 설정 (기본: src/rag)
const BASE_DIR = process.env.CASE_BASE_DIR
  ? path.resolve(process.env.CASE_BASE_DIR)
  : path.join(__dirname, '../../src/rag');

const DIRS = {
  case: path.join(BASE_DIR, 'case'), // 원문 텍스트 저장(caseX.txt)
  case_sample: path.join(BASE_DIR, 'case_sample'), // 기존 샘플(읽기용)
  case_vnexsus: path.join(BASE_DIR, 'case_vnexsus'), // 앱 보고서(caseX_vnexsus.txt)
  case_report: path.join(BASE_DIR, 'case_report'), // 사용자 보고서(caseX_report.txt)
  temp_uploads: path.join(BASE_DIR, 'temp_uploads')
};

for (const d of Object.values(DIRS)) {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads/case-manager');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 파일 업로드 설정 (임시 저장소)
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 50 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('지원되지 않는 파일 형식입니다. (.txt/.pdf/.doc/.docx)'));
  }
});

router.use((err, req, res, next) => {
  if (err) {
    logger.error({ event: 'dev_case_upload_middleware_error', error: err.message });
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});

// 유틸: 파일명 안전화
function safeName(name) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}
function extractReportSection(text) {
  const t = String(text || '').replace(/\r\n/g, '\n');
  const lines = t.split('\n').map(s => s.trim());
  let s = lines.findIndex(l => /경과\s*요약|요약\s*보고서|보고서\s*요약/i.test(l));
  if (s < 0) s = 0;
  let e = lines.findIndex((l, i) => i > s && /결\s*론|종결|끝|End\s*of\s*Report/i.test(l));
  const sel = lines.slice(s, e > -1 ? e : Math.min(lines.length, s + 500));
  const out = [];
  for (const line of sel) {
    if (line.length === 0 && out.length && out[out.length - 1] === '') continue;
    out.push(line);
  }
  return out.join('\n');
}

// 텍스트로부터 앱 보고서 생성 (공유 후처리 파이프라인 재사용)
async function generateAppReportFromText(text, caseNumber) {
  const options = {
    reportFormat: 'text',
    reportTitle: '병력사항 요약 경과표',
    includeRawText: false,
    sortDirection: 'asc',
    periodType: 'all',
    caseIndex: Number(caseNumber),
    outDir: DIRS.case_vnexsus
  };
  const result = await postProcessorDefault.processForMainApp(text, options);
  const finalPath = result?.finalReport?.filePath;
  if (!finalPath || !fs.existsSync(finalPath)) return null;
  const vnexsusText = fs.readFileSync(finalPath, 'utf-8');
  const outPath = path.join(DIRS.case_vnexsus, `case${caseNumber}_vnexsus.txt`);
  fs.writeFileSync(outPath, vnexsusText, 'utf-8');
  return outPath;
}

// 스키마: caseNumber 유효성
const CaseNumberSchema = z.string().regex(/^\d+$/);

// 케이스 목록 집계
router.get('/cases', async (req, res) => {
  try {
    const cases = new Map();

    const collect = (dir, label) => {
      if (!fs.existsSync(dir)) return;
      for (const file of fs.readdirSync(dir)) {
        const m = file.match(/case(\d+)_(vnexsus|report)?\.txt$/) || file.match(/case(\d+)\.txt$/);
        if (!m) continue;
        const num = m[1];
        const key = `case${num}`;
        if (!cases.has(key)) cases.set(key, { caseNumber: num, files: {} });
        const obj = cases.get(key);
        const p = path.join(dir, file);
        const stat = fs.statSync(p);
        obj.files[label] = { filename: file, path: p, size: stat.size };
      }
    };

    collect(DIRS.case, 'case');
    collect(DIRS.case_sample, 'case_sample');
    collect(DIRS.case_vnexsus, 'case_vnexsus');
    collect(DIRS.case_report, 'case_report');

    const list = Array.from(cases.values()).sort((a, b) => Number(a.caseNumber) - Number(b.caseNumber));

    logger.info({ event: 'dev_case_list', total: list.length });
    res.json({ success: true, total: list.length, cases: list });
  } catch (error) {
    logger.error({ event: 'dev_case_list_error', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/cases/next', async (req, res) => {
  try {
    const nums = new Set();
    const collect = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const file of fs.readdirSync(dir)) {
        const m = file.match(/case(\d+)(?:_(?:vnexsus|report))?\.txt$/);
        if (m) nums.add(Number(m[1]));
      }
    };
    collect(DIRS.case);
    collect(DIRS.case_sample);
    collect(DIRS.case_vnexsus);
    collect(DIRS.case_report);
    const next = nums.size ? Math.max(...Array.from(nums)) + 1 : 1;
    res.json({ success: true, nextCaseNumber: String(next) });
  } catch (error) {
    logger.error({ event: 'dev_case_next_error', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/cases/sample', async (req, res) => {
  try {
    const list = [];
    if (fs.existsSync(DIRS.case_sample)) {
      for (const f of fs.readdirSync(DIRS.case_sample)) {
        if (!f.endsWith('.txt')) continue;
        const m = f.match(/case(\d+)\.txt$/);
        if (m) list.push({ caseNumber: m[1], filename: f });
      }
    }
    list.sort((a, b) => Number(a.caseNumber) - Number(b.caseNumber));
    res.json({ success: true, list });
  } catch (error) {
    logger.error({ event: 'dev_case_sample_error', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// 특정 케이스 상세
router.get('/cases/:caseNumber', async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const parsed = CaseNumberSchema.safeParse(caseNumber);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: '유효하지 않은 케이스 번호입니다.' });
    }

    const files = {};
    const candidates = [
      { dir: DIRS.case, name: `case${caseNumber}.txt`, label: 'case' },
      { dir: DIRS.case_sample, name: `case${caseNumber}.txt`, label: 'case_sample' },
      { dir: DIRS.case_vnexsus, name: `case${caseNumber}_vnexsus.txt`, label: 'case_vnexsus' },
      { dir: DIRS.case_report, name: `case${caseNumber}_report.txt`, label: 'case_report' }
    ];

    for (const c of candidates) {
      const p = path.join(c.dir, c.name);
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        files[c.label] = { filename: c.name, path: p, size: stat.size };
      }
    }

    res.json({ success: true, caseNumber, files });
  } catch (error) {
    logger.error({ event: 'dev_case_detail_error', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// 업로드 + 즉시 처리 (원문/사용자 보고서)
router.post(
  '/cases/:caseNumber/upload',
  upload.fields([
    { name: 'rawFile', maxCount: 1 },
    { name: 'userReportFile', maxCount: 1 },
    { name: 'vnexsusFile', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { caseNumber } = req.params;
      const parsed = CaseNumberSchema.safeParse(caseNumber);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: '유효하지 않은 케이스 번호입니다.' });
      }

      const exists = (
        fs.existsSync(path.join(DIRS.case, `case${caseNumber}.txt`)) ||
        fs.existsSync(path.join(DIRS.case_report, `case${caseNumber}_report.txt`)) ||
        fs.existsSync(path.join(DIRS.case_vnexsus, `case${caseNumber}_vnexsus.txt`)) ||
        fs.existsSync(path.join(DIRS.case_sample, `case${caseNumber}.txt`))
      );
      if (exists) {
        const nums = new Set();
        const collect = (dir) => {
          if (!fs.existsSync(dir)) return;
          for (const file of fs.readdirSync(dir)) {
            const m = file.match(/case(\d+)(?:_(?:vnexsus|report))?\.txt$/);
            if (m) nums.add(Number(m[1]));
          }
        };
        collect(DIRS.case);
        collect(DIRS.case_sample);
        collect(DIRS.case_vnexsus);
        collect(DIRS.case_report);
        const next = nums.size ? Math.max(...Array.from(nums)) + 1 : 1;
        return res.status(409).json({ success: false, error: '이미 존재하는 케이스 번호입니다.', nextCaseNumber: String(next) });
      }

      const rawFile = req.files?.rawFile?.[0];
      const userReportFile = req.files?.userReportFile?.[0];
      const vnexsusFile = req.files?.vnexsusFile?.[0];

      if (!rawFile && !userReportFile && !vnexsusFile) {
        return res.status(400).json({ success: false, error: '업로드할 파일이 필요합니다.' });
      }

      const results = { caseNumber, actions: [] };

      // 원문 파일 처리 → caseX.txt, 그리고 앱 보고서 생성 caseX_vnexsus.txt
      if (rawFile) {
        const rawExt = path.extname(rawFile.originalname).toLowerCase();
        const uploadPath = rawFile.path;
        logger.info({ event: 'dev_case_raw_upload', caseNumber, filename: rawFile.originalname, size: rawFile.size });

        let caseTextPath = path.join(DIRS.case, `case${caseNumber}.txt`);
        let vnexsusPath = path.join(DIRS.case_vnexsus, `case${caseNumber}_vnexsus.txt`);

        if (rawExt === '.txt') {
          // 텍스트 파일은 바로 복사 저장
          const content = fs.readFileSync(uploadPath, 'utf-8');
          fs.writeFileSync(caseTextPath, content);
          results.actions.push({ type: 'save_text', path: caseTextPath });

          // 앱 보고서 생성 (후처리 재사용)
          try {
            const reportOut = await generateAppReportFromText(content, caseNumber);
            if (reportOut) {
              vnexsusPath = reportOut;
            }
            results.actions.push({ type: 'generate_app_report', path: vnexsusPath });
          } catch (err) {
            logger.error({ event: 'dev_case_generate_report_error', error: err.message });
          }
        } else {
          // PDF/문서 → OCR 후 저장 및 보고서 생성
          try {
            // 서비스 요구사항에 맞게 임시 디렉토리 구성 후 호출
            const tempCaseDir = path.join(DIRS.temp_uploads, `case${caseNumber}`);
            if (!fs.existsSync(tempCaseDir)) fs.mkdirSync(tempCaseDir, { recursive: true });
            const tempPdfPath = path.join(tempCaseDir, safeName(rawFile.originalname));
            fs.copyFileSync(uploadPath, tempPdfPath);

            const processed = await caseReportService.generateFromRawCase(tempCaseDir, Number(caseNumber), {
              useVision: process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION === 'true',
              outDir: DIRS.temp_uploads,
              excludePatterns: ['보고서']
            });

            if (processed?.rawTextPath && fs.existsSync(processed.rawTextPath)) {
              const txt = fs.readFileSync(processed.rawTextPath, 'utf-8');
              fs.writeFileSync(caseTextPath, txt, 'utf-8');
            }
            if (processed?.vnexsusPath && fs.existsSync(processed.vnexsusPath)) {
              const vn = fs.readFileSync(processed.vnexsusPath, 'utf-8');
              fs.writeFileSync(vnexsusPath, vn, 'utf-8');
            }

            results.actions.push({ type: 'ocr_and_save', path: caseTextPath });
            results.actions.push({ type: 'generate_app_report', path: vnexsusPath });
          } catch (err) {
            logger.error({ event: 'dev_case_ocr_error', error: err.message });
            return res.status(500).json({ success: false, error: `OCR 처리 실패: ${err.message}` });
          }
        }
      }

      // 사용자 보고서 파일 → caseX_report.txt
      if (userReportFile) {
        const ext = path.extname(userReportFile.originalname).toLowerCase();
        const uploadPath = userReportFile.path;
        const reportPath = path.join(DIRS.case_report, `case${caseNumber}_report.txt`);
        logger.info({ event: 'dev_case_user_report_upload', caseNumber, filename: userReportFile.originalname, size: userReportFile.size });

        try {
          if (ext === '.txt') {
            const content = fs.readFileSync(uploadPath, 'utf-8');
            const refined = extractReportSection(content);
            fs.writeFileSync(reportPath, refined || content, 'utf-8');
            results.actions.push({ type: 'save_user_report_text', path: reportPath });
          } else {
            // PDF → OCR 텍스트로 변환 후 저장 (서비스 재사용)
            const tempCaseDir = path.join(DIRS.temp_uploads, `case${caseNumber}_user_report`);
            if (!fs.existsSync(tempCaseDir)) fs.mkdirSync(tempCaseDir, { recursive: true });
            const tempPdfPath = path.join(tempCaseDir, safeName(userReportFile.originalname));
            fs.copyFileSync(uploadPath, tempPdfPath);
            const processed = await caseReportService.generateFromRawCase(tempCaseDir, Number(caseNumber), {
              useVision: process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION === 'true',
              outDir: DIRS.temp_uploads,
              excludePatterns: []
            });
            const txtPath = processed?.rawTextPath;
            if (txtPath && fs.existsSync(txtPath)) {
              const txt = fs.readFileSync(txtPath, 'utf-8');
              const refined = extractReportSection(txt);
              fs.writeFileSync(reportPath, refined || txt, 'utf-8');
              results.actions.push({ type: 'ocr_user_report', path: reportPath });
            } else {
              results.actions.push({ type: 'ocr_user_report_failed' });
            }
          }
        } catch (err) {
          logger.error({ event: 'dev_case_user_report_ocr_error', error: err.message });
          return res.status(500).json({ success: false, error: `사용자 보고서 OCR 실패: ${err.message}` });
        }
      }

      // VNEXSUS 보고서 파일 처리 → caseX_vnexsus.txt
      if (vnexsusFile) {
        const ext = path.extname(vnexsusFile.originalname).toLowerCase();
        const uploadPath = vnexsusFile.path;
        const vnexsusPath = path.join(DIRS.case_vnexsus, `case${caseNumber}_vnexsus.txt`);
        logger.info({ event: 'dev_case_vnexsus_upload', caseNumber, filename: vnexsusFile.originalname, size: vnexsusFile.size });
        try {
          if (ext === '.txt') {
            const content = fs.readFileSync(uploadPath, 'utf-8');
            fs.writeFileSync(vnexsusPath, content, 'utf-8');
            results.actions.push({ type: 'save_vnexsus_text', path: vnexsusPath });
          } else {
            // PDF/DOC → OCR 후 저장
            const tempCaseDir = path.join(DIRS.temp_uploads, `case${caseNumber}_vnexsus`);
            if (!fs.existsSync(tempCaseDir)) fs.mkdirSync(tempCaseDir, { recursive: true });
            const tempPdfPath = path.join(tempCaseDir, safeName(vnexsusFile.originalname));
            fs.copyFileSync(uploadPath, tempPdfPath);
            const processed = await caseReportService.generateFromRawCase(tempCaseDir, Number(caseNumber), {
              useVision: process.env.ENABLE_VISION_OCR === 'true' && process.env.USE_VISION === 'true',
              outDir: DIRS.temp_uploads,
              excludePatterns: []
            });
            const txtPath = processed?.rawTextPath;
            if (txtPath && fs.existsSync(txtPath)) {
              const txt = fs.readFileSync(txtPath, 'utf-8');
              fs.writeFileSync(vnexsusPath, txt, 'utf-8');
              results.actions.push({ type: 'ocr_vnexsus', path: vnexsusPath });
            } else {
              results.actions.push({ type: 'ocr_vnexsus_failed' });
            }
          }
        } catch (err) {
          logger.error({ event: 'dev_case_vnexsus_ocr_error', error: err.message });
          return res.status(500).json({ success: false, error: `VNEXSUS 파일 OCR 실패: ${err.message}` });
        }
      }

      res.json({ success: true, caseNumber, results });
    } catch (error) {
      logger.error({ event: 'dev_case_upload_error', error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get('/cases/:caseNumber/content/:label', async (req, res) => {
  try {
    const { caseNumber, label } = req.params;
    const parsed = CaseNumberSchema.safeParse(caseNumber);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: '유효하지 않은 케이스 번호입니다.' });
    }
    const allowed = ['case', 'case_sample', 'case_vnexsus', 'case_report'];
    if (!allowed.includes(label)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 라벨입니다.' });
    }
    const nameMap = {
      case: `case${caseNumber}.txt`,
      case_sample: `case${caseNumber}.txt`,
      case_vnexsus: `case${caseNumber}_vnexsus.txt`,
      case_report: `case${caseNumber}_report.txt`
    };
    const p = path.join(DIRS[label], nameMap[label]);
    if (!fs.existsSync(p)) {
      return res.status(404).json({ success: false, error: '파일이 존재하지 않습니다.' });
    }
    const limit = Math.min(Number(req.query.limit || 20000), 200000);
    const content = fs.readFileSync(p, 'utf-8');
    const out = content.length > limit ? content.slice(0, limit) : content;
    res.json({ success: true, caseNumber, label, length: content.length, content: out });
  } catch (error) {
    logger.error({ event: 'dev_case_content_error', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// 직접 텍스트 입력 → caseX_report.txt 저장
router.post('/cases/:caseNumber/report', async (req, res) => {
  try {
    const { caseNumber } = req.params;
    const parsed = CaseNumberSchema.safeParse(caseNumber);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: '유효하지 않은 케이스 번호입니다.' });
    }

    const exists = (
      fs.existsSync(path.join(DIRS.case, `case${caseNumber}.txt`)) ||
      fs.existsSync(path.join(DIRS.case_report, `case${caseNumber}_report.txt`)) ||
      fs.existsSync(path.join(DIRS.case_vnexsus, `case${caseNumber}_vnexsus.txt`)) ||
      fs.existsSync(path.join(DIRS.case_sample, `case${caseNumber}.txt`))
    );
    if (exists) {
      const nums = new Set();
      const collect = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const file of fs.readdirSync(dir)) {
          const m = file.match(/case(\d+)(?:_(?:vnexsus|report))?\.txt$/);
          if (m) nums.add(Number(m[1]));
        }
      };
      collect(DIRS.case);
      collect(DIRS.case_sample);
      collect(DIRS.case_vnexsus);
      collect(DIRS.case_report);
      const next = nums.size ? Math.max(...Array.from(nums)) + 1 : 1;
      return res.status(409).json({ success: false, error: '이미 존재하는 케이스 번호입니다.', nextCaseNumber: String(next) });
    }

    const text = typeof req.body.text === 'string' ? req.body.text : '';
    if (!text.trim()) {
      return res.status(400).json({ success: false, error: '저장할 텍스트가 필요합니다.' });
    }

    const safeTextForLog = mask(text.slice(0, 200));
    logger.info({ event: 'dev_case_report_text_save', caseNumber, preview: safeTextForLog });

    const reportPath = path.join(DIRS.case_report, `case${caseNumber}_report.txt`);
    const refined = extractReportSection(text);
    fs.writeFileSync(reportPath, refined || text, 'utf-8');
    res.json({ success: true, caseNumber, path: reportPath });
  } catch (error) {
    logger.error({ event: 'dev_case_report_text_error', error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
