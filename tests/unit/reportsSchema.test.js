import { describe, it, expect } from '@jest/globals';
import { TimelineSchema } from '../../src/modules/reports/types/structuredOutput.js';

describe('Reports Timeline Zod Schema', () => {
  it('accepts valid timeline with events', () => {
    const timeline = {
      events: [
        {
          label: 'Diagnosis',
          date: '2023-01-15',
          confidence: 0.8,
          hospital: 'Seoul General',
          type: 'Diagnosis',
          tags: ['outpatient'],
        },
        {
          label: 'Procedure',
          date: '2023-02-01T09:00:00Z',
          confidence: 0.9,
        },
      ],
    };

    const res = TimelineSchema.safeParse(timeline);
    expect(res.success).toBe(true);
  });

  it('rejects invalid timeline when date is not ISO and confidence out of bounds', () => {
    const timeline = {
      events: [
        { label: 'Visit', date: '02/30/2023', confidence: 1.2 },
        { label: '', date: '2023-01-01', confidence: -0.1 },
      ],
    };

    const res = TimelineSchema.safeParse(timeline);
    expect(res.success).toBe(false);
    // Ensure issues include date and label/confidence errors
    const messages = res.success ? [] : res.error.issues.map((i) => i.message);
    expect(messages.some((m) => m.includes('ISO'))).toBe(true);
  });
});

