import express from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import ReportTemplateEngine from '../postprocess/reportTemplateEngine.js';
import { logger } from '../../src/shared/logging/logger.js';
import { maskObject } from '../../src/shared/security/mask.js';
import { buildSummaryContract } from '../../src/scripts/summaryContract.js';

const router = express.Router();

// Basic preview endpoint for ReportTemplateEngine
router.get('/basic', async (req, res) => {
  const startedAt = Date.now();
  logger.logApiRequest(req, { route: 'report-template/basic' });

  try {
    const QuerySchema = z.object({
      locale: z.enum(['ko', 'en']).optional(),
      format: z.enum(['html', 'text', 'json', 'markdown']).optional(),
    });

    const parsed = QuerySchema.safeParse(req.query);
    const locale = parsed.success ? (parsed.data.locale ?? 'ko') : 'ko';
    const format = parsed.success ? (parsed.data.format ?? 'html') : 'html';

    const sampleData = {
      header: { title: '의료 경과보고서', subtitle: 'Medical Progress Report' },
      patientInfo: {
        name: '홍길동',
        birthDate: '1985-03-12',
        gender: '남',
      },
      timeline: [
        { date: '2024-01-15', event: '내원 및 검사', details: '혈압 및 기본 혈액검사' },
        { date: '2024-01-20', event: '진단 (ICD: I10)', details: '고혈압 1단계' },
        { date: '2024-01-25', event: '상병명: 흉통 ICD 코드 R074', details: '관찰실 경과' },
      ],
    };

    const engine = new ReportTemplateEngine();

    let payload = '';
    switch (format) {
      case 'json':
        payload = engine.createJsonTemplate(sampleData, { locale });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        break;
      case 'markdown':
        payload = engine.createMarkdownTemplate(sampleData, { locale });
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        break;
      case 'text':
        payload = engine.createTextTemplate(sampleData, { locale });
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        break;
      case 'html':
      default:
        payload = engine.createHtmlTemplate(sampleData, { locale });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }

    res.status(200).send(payload);
    logger.logApiResponse(req, res, Date.now() - startedAt, { locale, format });
  } catch (error) {
    logger.logProcessingError('report-template-basic', error, { query: maskObject(req.query) });
    res.status(500).json({ success: false, message: 'report_generation_failed' });
  }
});

// Summary contract endpoint
router.get('/summary', async (req, res) => {
  const startedAt = Date.now();
  logger.logApiRequest(req, { route: 'report-template/summary' });

  try {
    const QuerySchema = z.object({
      input: z.string().min(1).optional(),
    });

    const parsed = QuerySchema.safeParse(req.query);
    const inputRel = parsed.success ? parsed.data.input : undefined;
    const defaultRel = 'results/outpatient-episodes-case-comparison.json';
    const chosenRel = inputRel || defaultRel;

    const inputPath = path.isAbsolute(chosenRel) ? chosenRel : path.join(process.cwd(), chosenRel);
    if (!fs.existsSync(inputPath)) {
      logger.logProcessingError('report-summary-input-missing', new Error('Input file not found'), { query: maskObject(req.query), inputPath });
      res.status(404).json({ success: false, message: 'input_file_not_found' });
      return;
    }

    const raw = fs.readFileSync(inputPath, 'utf8');
    const data = JSON.parse(raw);
    const summary = buildSummaryContract(data);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(summary);
    logger.logApiResponse(req, res, Date.now() - startedAt, { inputPath });
  } catch (error) {
    logger.logProcessingError('report-template-summary', error, { query: maskObject(req.query) });
    res.status(400).json({ success: false, message: 'invalid_input' });
  }
});

export default router;
