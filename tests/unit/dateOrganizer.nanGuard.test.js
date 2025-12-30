import DateOrganizer from '../../backend/postprocess/dateOrganizer.js';

describe('DateOrganizer NaN guards and normalization', () => {
  const organizer = new DateOrganizer();

  test('filters invalid dates and groups with normalized keys', () => {
    const input = [
      { date: '2024-05-01', hospital: 'A', shouldExclude: false },
      { date: '2024년 5월 1일', hospital: 'B', shouldExclude: false },
      { date: 'invalid-date', hospital: 'C', shouldExclude: false },
      { date: '', hospital: 'D', shouldExclude: false }
    ];
    const groups = organizer.sortAndFilter(input, { groupByDate: true, excludeNoise: true });
    expect(groups.length).toBe(1);
    expect(groups[0].date).toBe('2024-05-01');
    expect(groups[0].items.length).toBe(2);
  });

  test('groupByDate normalizes different formats into same group', () => {
    const input = [
      { date: '2024-03-15', hospital: 'A' },
      { date: '2024년 3월 15일', hospital: 'B' },
      { date: '2024.03.15', hospital: 'C' }
    ];
    const groups = organizer.sortAndFilter(input, { groupByDate: true });
    expect(groups.length).toBe(1);
    expect(groups[0].date).toBe('2024-03-15');
    expect(groups[0].items.length).toBe(3);
  });

  test('analyzePeriodDistribution counts only valid dated items', () => {
    const data = [
      { date: '2024-06-10' },
      { date: '2024년 05월 10일' },
      { date: 'not-a-date' }
    ];
    const dist = organizer.analyzePeriodDistribution(data, '2024-06-15');
    expect(dist.total).toBe(2);
    expect(dist.last3Months.count).toBeGreaterThanOrEqual(1);
    expect(dist.last5Years.count).toBe(2);
  });

  test('calculatePeriod handles multiple formats', () => {
    const p = organizer.calculatePeriod('2024년 01월 01일', '2024-06-30');
    expect(p.days).toBeGreaterThan(0);
    expect(typeof p.formattedPeriod).toBe('string');
  });
});
