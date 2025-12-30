const { describe, test, expect } = require('@jest/globals');

describe('PostProcessing pipeline SSOT integration (backend wrapper)', () => {
  test('produces MedicalEvent[] from simple OCR text', async () => {
    const postprocessMod = await import('../../postprocess/index.js');
    const postprocess = postprocessMod.default || postprocessMod;
    const typesMod = await import('../../../src/modules/reports/types/structuredOutput.js');
    const { MedicalEventSchema } = typesMod;

    const text = '2025-11-15 서울병원에서 CT 검사 시행.';
    const coordinateBlocks = [
      {
        text,
        page: 1,
        blockIndex: 0,
        bbox: { xMin: 10, yMin: 20, xMax: 210, yMax: 60, width: 200, height: 40 }
      }
    ];
    const res = await postprocess.processOCRResult(text, {
      minConfidence: 0.1,
      includeAll: true,
      useHybridApproach: true,
      patientInfo: { enrollmentDate: '2026-01-01' },
      coordinateBlocks
    });
    expect(res.success).toBe(true);
    const events = res.pipeline.medicalEvents || [];
    expect(Array.isArray(events)).toBe(true);
    const valid = events.filter(e => MedicalEventSchema.safeParse(e).success);
    expect(valid.length).toBeGreaterThanOrEqual(1);
    expect(valid[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const hasAnchors = events.some(e => {
      const a = e.anchors;
      return a && ((a.sourceSpan && typeof a.sourceSpan.blockIndex === 'number') || (a.position && typeof a.position.page === 'number'));
    });
    expect(hasAnchors).toBe(true);
  });
});
