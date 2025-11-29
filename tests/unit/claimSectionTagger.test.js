/**
 * @jest-environment node
 */
import { isClaimSectionHeader, isAnySectionHeader, tagEventsWithClaimFlag } from '../../src/shared/utils/claimSectionTagger.js';

describe('claimSectionTagger', () => {
  test('detects claim section headers (bracketed and plain)', () => {
    expect(isClaimSectionHeader('[청구사항]')).toBe(true);
    expect(isClaimSectionHeader('【청구】')).toBe(true);
    expect(isClaimSectionHeader('CLAIM SECTION')).toBe(true);
    expect(isClaimSectionHeader('# 청구사항:')).toBe(true);
    expect(isClaimSectionHeader('진료기록')).toBe(false);
  });

  test('detects generic section headers distinct from claim', () => {
    expect(isAnySectionHeader('[검사결과]')).toBe(true);
    expect(isAnySectionHeader('Summary')).toBe(true);
    expect(isAnySectionHeader('일반문장 입니다.')).toBe(false);
  });

  test('tags events inside claim section', () => {
    const text = [
      '[청구사항]',
      '2024-09-12 보험 청구 접수',
      '진단서 제출 및 확인',
      '[진료기록]',
      '2024-09-10 외래 방문 내과 진료',
      'Chest pain, EKG normal'
    ].join('\n');
    const events = [
      { date: '2024-09-12', content: '2024-09-12 보험 청구 접수\n진단서 제출 및 확인' },
      { date: '2024-09-10', content: '2024-09-10 외래 방문 내과 진료\nChest pain, EKG normal' }
    ];
    const tagged = tagEventsWithClaimFlag(events, text);
    expect(tagged[0].isClaim).toBe(true);
    expect(tagged[1].isClaim).toBe(false);
  });
});

