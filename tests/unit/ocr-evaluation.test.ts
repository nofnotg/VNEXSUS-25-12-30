import { describe, it, expect } from 'vitest';
import { charAccuracy, extractKeyInfo, structureScore } from '../../src/modules/ocr-evaluation/service/metrics.ts';
import { classifyCaseFiles } from '../../src/modules/ocr-evaluation/service/classifier.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('metrics', () => {
  it('computes char-level accuracy', () => {
    const a = '보험금 지급액 1,000,000원';
    const b = '보험금 지급액 1,000,000원';
    expect(charAccuracy(a, b)).toBe(1);
    const c = '보험금 지급 1,000,00원';
    const acc = charAccuracy(a, c);
    expect(acc).toBeGreaterThan(0.8);
  });

  it('extracts key info from text', () => {
    const txt = '2024년 5월 2일 서울의료원 진료, 지급액 2,500,000원';
    const ki = extractKeyInfo(txt);
    expect(ki.amounts[0]).toContain('2,500,000');
    expect(ki.dates.length).toBeGreaterThan(0);
    expect(ki.hospitals.length).toBeGreaterThan(0);
  });

  it('computes structure score heuristically', () => {
    const orig = '개요\n진단\n치료 경과\n결론';
    const gen = '개요\n진단\n결론';
    const s = structureScore(orig, gen);
    expect(s).toBeGreaterThan(0.5);
  });
});

describe('classifier', () => {
  it('classifies files by keywords', () => {
    const tmp = path.join(process.cwd(), 'tmp-test');
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, '케이스A_종결보고서.pdf'), '');
    fs.writeFileSync(path.join(tmp, '케이스A_진단서.pdf'), '');
    fs.writeFileSync(path.join(tmp, '메모.txt'), '');

    const res = classifyCaseFiles(tmp);
    expect(res.find(f => f.fileName.includes('종결보고서'))?.type).toBe('actual_report');
    expect(res.find(f => f.fileName.includes('진단서'))?.type).toBe('medical_doc');
    expect(res.find(f => f.fileName.includes('메모'))?.type).toBe('other');

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

