const { describe, test, expect } = require('@jest/globals');

describe('MedicalEventSchema SSOT (backend wrapper)', () => {
  test('valid minimal medical event', async () => {
    const mod = await import('../../../src/modules/reports/types/structuredOutput.js');
    const { MedicalEventSchema } = mod;
    const evt = {
      id: 'evt_001',
      date: '2025-12-01',
      eventType: '진료',
      confidence: 0.88
    };
    const parsed = MedicalEventSchema.safeParse(evt);
    expect(parsed.success).toBe(true);
  });

  test('invalid date format rejected', async () => {
    const mod = await import('../../../src/modules/reports/types/structuredOutput.js');
    const { MedicalEventSchema } = mod;
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
