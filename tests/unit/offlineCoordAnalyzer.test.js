import { analyzeBlocks, extractTables, labelSections, buildHtml, clamp01 } from '../../backend/tools/offlineCoordAnalyzer.js';

test('clamp01 bounds', () => {
  expect(clamp01(-1)).toBe(0);
  expect(clamp01(0)).toBe(0);
  expect(clamp01(0.5)).toBe(0.5);
  expect(clamp01(1)).toBe(1);
  expect(clamp01(2)).toBe(1);
});

test('analyzeBlocks detects anomalies and normalizes', () => {
  const blocks = [
    { page: 1, text: 'A', bbox: { xMin: 0, yMin: 0, xMax: 100, yMax: 100, width: 100, height: 100 } },
    { page: 1, text: '', bbox: { xMin: 0, yMin: 0, xMax: 0, yMax: 0, width: 0, height: 0 } },
    { page: 2, text: 'B', bbox: { xMin: 10, yMin: 10, xMax: 5, yMax: 5, width: -5, height: -5 } },
    { page: 0, text: 'C', bbox: { xMin: 1, yMin: 1, xMax: 2, yMax: 2, width: 1, height: 1 } },
  ];
  const res = analyzeBlocks(blocks);
  expect(res.stats.blocksTotal).toBe(4);
  expect(res.stats.pagesTotal).toBe(2);
  expect(res.stats.missingTextRate).toBeGreaterThan(0);
  expect(res.stats.zeroAreaRate).toBeGreaterThan(0);
  expect(res.stats.negativeDimsRate).toBeGreaterThan(0);
  expect(res.stats.missingBboxRate).toBeGreaterThanOrEqual(0);
  expect(Array.isArray(res.normalized)).toBe(true);
  expect(res.normalized.length).toBeGreaterThan(0);
});

test('extractTables groups rows and columns with spans', () => {
  const blocks = [
    { page: 1, text: 'r1c1', bbox: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 } },
    { page: 1, text: 'r1c2', bbox: { xMin: 20, yMin: 0, xMax: 30, yMax: 10 } },
    { page: 1, text: 'r2c1', bbox: { xMin: 0, yMin: 20, xMax: 10, yMax: 30 } },
    { page: 1, text: 'r2c2', bbox: { xMin: 20, yMin: 20, xMax: 40, yMax: 30 } },
  ];
  const tables = extractTables(blocks, { rowTol: 0.2, colTol: 0.2, minCols: 2 });
  expect(Array.isArray(tables)).toBe(true);
  expect(tables.length).toBeGreaterThan(0);
  const t = tables[0];
  expect(t.rowCount).toBeGreaterThanOrEqual(2);
  expect(t.colCount).toBeGreaterThanOrEqual(2);
  expect(Array.isArray(t.grid)).toBe(true);
  expect(t.grid.length).toBeGreaterThan(0);
});

test('labelSections identifies header and footer ratios', () => {
  const normalized = [
    { blockIndex: 0, bboxNorm: { yMin: 0.01, yMax: 0.02 } },
    { blockIndex: 1, bboxNorm: { yMin: 0.5, yMax: 0.6 } },
    { blockIndex: 2, bboxNorm: { yMin: 0.94, yMax: 0.98 } },
  ];
  const res = labelSections(normalized, { top: 0.05, bottom: 0.95 });
  expect(res.total).toBe(3);
  expect(res.headerCount).toBe(1);
  expect(res.footerCount).toBe(1);
  expect(res.headerRatio).toBeCloseTo(1 / 3, 5);
  expect(res.footerRatio).toBeCloseTo(1 / 3, 5);
});

test('buildHtml renders light-themed elements and viewer', () => {
  const summary = {
    baseDir: '/reports/VNEXSUS_Report/sample',
    caseCount: 1,
    blocksTotal: 10,
    pagesTotal: 2,
    missingTextRateAvg: 0.1,
    zeroAreaRateAvg: 0.2,
    negativeDimsRateAvg: 0.3,
    missingBboxRateAvg: 0.4,
    avgSpanAvg: 1.5,
    perCase: [
      {
        caseIndex: 1,
        blocks: 10,
        pages: 2,
        pageCoverage: 0.5,
        qualityScore: 0.7,
        zeroAreaRate: 0.2,
        missingTextRate: 0.1,
        negativeDimsRate: 0.0,
        missingBboxRate: 0.0,
        tableCount: 1,
        headerRate: 0.1,
        footerRate: 0.1,
        avgSpan: 1.2,
        hasSpan: true
      }
    ]
  };
  const html = buildHtml(summary);
  expect(typeof html).toBe('string');
  expect(html.includes('오프라인 좌표 품질 분석')).toBe(true);
  expect(html.includes('class=\"table\"')).toBe(true);
  expect(html.includes('id=\"case-select\"')).toBe(true);
  expect(html.includes('color-scheme:light')).toBe(true);
});
