/**
 * @jest-environment node
 */
import { filterClaimsByWindow } from '../../src/modules/claims/service/disclosureWindowService.js';
import { DISCLOSURE_WINDOW_RULES } from '../../src/shared/constants/claimsRules.js';

describe('filterClaimsByWindow', () => {
  test('filters claim records within windowDays', () => {
    const fixedNow = new Date('2025-01-01T00:00:00.000Z');
    const records = [
      { date: '2024-12-15', content: '보험 청구 관련 문의', isClaim: true }, // 17 days before
      { date: '2024-08-01', content: '진료 기록', isClaim: true }, // 153 days before
      { date: '2024-12-20', content: '입원 경과', isClaim: false },
      { date: '2025-01-01', content: 'CLAIM SECTION\n접수 완료', isClaim: false } // should be tagged by fallback
    ];

    const { filtered, stats } = filterClaimsByWindow(records, DISCLOSURE_WINDOW_RULES, fixedNow);

    expect(stats.total).toBe(4);
    expect(stats.claimTotal).toBe(3); // last one becomes claim via keyword
    expect(stats.within).toBe(2);     // 2024-12-15 and 2025-01-01
    expect(stats.outside).toBe(1);    // 2024-08-01

    const dates = filtered.map(r => r.date).sort();
    expect(dates).toEqual(['2024-12-15', '2025-01-01']);
  });

  test('returns unfiltered when no claim rule present', () => {
    const fixedNow = new Date('2025-01-01T00:00:00.000Z');
    const records = [
      { date: '2024-10-10', content: '보험청구 접수', isClaim: true }
    ];
    const rules = []; // no claim rule
    const { filtered, stats } = filterClaimsByWindow(records, rules, fixedNow);
    expect(filtered.length).toBe(1);
    expect(stats.claimTotal).toBe(1);
    expect(stats.within).toBe(1);
    expect(stats.outside).toBe(0);
  });

  test('handles invalid dates gracefully', () => {
    const fixedNow = new Date('2025-01-01T00:00:00.000Z');
    const records = [
      { date: 'invalid-date', content: '청구 안내', isClaim: true }
    ];
    const { filtered, stats } = filterClaimsByWindow(records, DISCLOSURE_WINDOW_RULES, fixedNow);
    expect(filtered.length).toBe(0);
    expect(stats.outside).toBe(1);
  });
});

