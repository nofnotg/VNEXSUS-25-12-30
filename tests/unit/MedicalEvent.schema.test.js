import { MedicalEventSchema } from '../../src/modules/reports/types/structuredOutput.js';

describe('MedicalEventSchema SSOT', () => {
  test('valid minimal medical event', () => {
    const evt = {
      id: 'evt_001',
      date: '2025-12-01',
      eventType: '진료',
      confidence: 0.88
    };
    const parsed = MedicalEventSchema.safeParse(evt);
    expect(parsed.success).toBe(true);
  });

  test('valid full medical event with anchors', () => {
    const evt = {
      id: 'evt_002',
      date: '2025-11-15',
      hospital: '서울병원',
      eventType: '검사',
      description: '복부 CT 검사 시행',
      diagnosis: { name: '복부통증', code: 'R10.0' },
      procedures: [{ name: 'CT Abdomen', code: 'CT-ABD' }],
      medications: [{ name: 'Tylenol', dose: '500mg' }],
      anchors: {
        position: { page: 2, xMin: 0.12, yMin: 0.34, xMax: 0.56, yMax: 0.78 },
        sourceSpan: { blockIndex: 5 },
        confidence: 0.92
      },
      confidence: 0.93,
      tags: ['EXAMINATION', 'CT']
    };
    const parsed = MedicalEventSchema.safeParse(evt);
    expect(parsed.success).toBe(true);
  });

  test('invalid date format rejected', () => {
    const evt = {
      id: 'evt_003',
      date: '2025/11/15',
      eventType: '수술',
      confidence: 0.7
    };
    const parsed = MedicalEventSchema.safeParse(evt);
    expect(parsed.success).toBe(false);
  });
});

