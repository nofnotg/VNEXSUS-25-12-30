// Unit test: ReportTemplateEngine ICD formatting in HTML
// ESM test; can be executed with node or vitest
import assert from 'assert';
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

const html = engine.createHtmlTemplate(sampleData, { locale: 'ko' });

// Expect bolded and normalized codes; no label "ICD" remains in rendered code
assert(html.includes('<strong class="icd-code">I20.9</strong>'), 'I20.9 should be bold without ICD label');
assert(html.includes('<strong class="icd-code">R07.4</strong>'), 'R07.4 should be bold without ICD label');
assert(!/\(\s*ICD\s*:\s*/.test(html), 'ICD label should be removed from display');

console.log('ReportTemplateEngine ICD formatting tests passed.');

