import { describe, it, expect } from '@jest/globals';
import { TextArrayDateControllerOptimized } from '../../src/dna-engine/core/textArrayDateControllerOptimized.js';

describe('TextArrayDateControllerOptimized.hasDatePatternOptimized', () => {
  const controller = new TextArrayDateControllerOptimized();

  it('detects yyyy-mm-dd and yyyy.mm.dd patterns', () => {
    expect(controller.hasDatePatternOptimized('진료일: 2024-03-12')).toBe(true);
    expect(controller.hasDatePatternOptimized('검사일: 2024.03.12')).toBe(true);
  });

  it('detects dd-mm-yyyy and dd.mm.yyyy patterns', () => {
    expect(controller.hasDatePatternOptimized('수술일: 12-03-2024')).toBe(true);
    expect(controller.hasDatePatternOptimized('촬영일: 12.03.2024')).toBe(true);
  });

  it('detects Korean date format yyyy년 m월 d일', () => {
    expect(controller.hasDatePatternOptimized('진단일: 2024년 3월 12일')).toBe(true);
  });

  it('returns false when no date-like pattern present', () => {
    expect(controller.hasDatePatternOptimized('의무기록: 환자 상태 양호, 추적 관찰 예정')).toBe(false);
  });
});

