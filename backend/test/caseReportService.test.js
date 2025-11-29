import fs from 'fs';
import path from 'path';
import os from 'os';
import * as service from '../services/caseReportService.js';

describe('caseReportService.generateFromRawCase', () => {
  const tmpRoot = path.join(process.cwd(), 'temp', 'reports', 'jest');
  const caseIdx = 123;
  const caseDir = path.join(tmpRoot, `Case${caseIdx}`);
  const outDir = path.join(tmpRoot, 'out');

  beforeAll(() => {
    fs.mkdirSync(caseDir, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });
    // Create sample PDFs (filenames only; processing is mocked)
    fs.writeFileSync(path.join(caseDir, 'A.pdf'), '%PDF\n...');
    fs.writeFileSync(path.join(caseDir, '보고서_무시.pdf'), '%PDF\n...');
    fs.writeFileSync(path.join(caseDir, 'B.pdf'), '%PDF\n...');
  });

  afterAll(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('excludes files with "보고서" and writes outputs', async () => {
    const mockPdfProcessor = {
      processPdf: async (filePath, opts) => ({ text: `TXT_${path.basename(filePath)}`, ocrSource: 'mock' })
    };

    const mockPostProcessor = {
      processForMainApp: async (mergedText, options) => {
        const reportPath = path.join(options.outDir, `Case${options.caseIndex}_tmp_report.txt`);
        fs.writeFileSync(reportPath, `REPORT_${mergedText.slice(0, 32)}`);
        return { finalReport: { filePath: reportPath } };
      }
    };

    const res = await service.generateFromRawCase(caseDir, caseIdx, {
      useVision: false,
      excludePatterns: ['보고서'],
      outDir,
      overrides: { pdfProcessor: mockPdfProcessor, postProcessor: mockPostProcessor }
    });

    expect(res.success).toBe(true);
    expect(res.rawTextPath).toBe(path.join(outDir, `Case${caseIdx}.txt`));
    expect(res.vnexsusPath).toBe(path.join(outDir, `Case${caseIdx}_vnexsus.txt`));

    const rawText = fs.readFileSync(res.rawTextPath, 'utf8');
    expect(rawText).toContain('TXT_A.pdf');
    expect(rawText).toContain('TXT_B.pdf');
    expect(rawText).not.toContain('보고서_무시.pdf');

    const vnexsusText = fs.readFileSync(res.vnexsusPath, 'utf8');
    expect(vnexsusText.startsWith('REPORT_')).toBe(true);
  });
});

