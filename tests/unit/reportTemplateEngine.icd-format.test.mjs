import { describe, test, expect } from '@jest/globals';
import ReportTemplateEngine from '../../backend/postprocess/reportTemplateEngine.js';

const engine = new ReportTemplateEngine();

const sampleData = {
  header: { title: '의료 경과보고서' },
  patientInfo: { name: '테스트', birthDate: '1990-01-01', gender: '남' },
  timeline: [
    { date: '2024-01-01', event: '상병명: 협심증 (ICD: I20).9', details: '응급실 내원' },
    { date: '2024-01-02', event: '상병명: 흉통 ICD 코드 R074', details: '관찰실' },
  ],
};

describe('ReportTemplateEngine ICD formatting', () => {
  test('bolds and normalizes ICD codes in HTML', () => {
    const html = engine.createHtmlTemplate(sampleData, { locale: 'ko' });
    expect(html).toContain('<strong class="icd-code">I20.9</strong>');
    expect(html).toContain('<strong class="icd-code">R07.4</strong>');
    expect(/\(\s*ICD\s*:\s*/.test(html)).toBe(false);
  });
});
