import preprocessor from '../../backend/postprocess/preprocessor.js';

test('preprocessor adds confidence score', async () => {
  const text = '2025-12-01 서울대학병원 수술 진단 보고서';
  const results = await preprocessor.run(text, { translateTerms: false, requireKeywords: false, enableTemplateCache: false });
  expect(Array.isArray(results)).toBe(true);
  expect(results.length).toBeGreaterThan(0);
  const r = results[0];
  expect(typeof r.confidence).toBe('number');
  expect(r.confidence).toBeGreaterThanOrEqual(0);
  expect(r.confidence).toBeLessThanOrEqual(1);
});

test('confidence higher with date/hospital/keywords', async () => {
  const rich = '2025년 12월 01일 서울병원 진단 기록 수술 항목 포함';
  const poor = '메모 텍스트';
  const richRes = await preprocessor.run(rich, { translateTerms: false, requireKeywords: false, enableTemplateCache: false });
  const poorRes = await preprocessor.run(poor, { translateTerms: false, requireKeywords: false, enableTemplateCache: false });
  const a = richRes[0]?.confidence ?? 0;
  const b = poorRes[0]?.confidence ?? 0;
  expect(a).toBeGreaterThanOrEqual(b);
});
