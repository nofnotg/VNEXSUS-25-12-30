// disclosureEngine.test.js - 고지의무 엔진 단위 테스트
import { computeDisclosure } from '../../src/services/core/disclosureEngine.js';

describe('DisclosureEngine', () => {
  const baseConfig = {
    contractDate: '2023-06-01',
    disclosureWindows: ['3m', '2y', '5y'],
    claimDiagnosis: '자궁내막암'
  };

  describe('3개월 윈도우 테스트', () => {
    test('3개월 내 의심 소견 - 해당 판정', () => {
      const records = [
        {
          date: '2023-04-15', // 계약일 47일 전
          text: '자궁내막 조직검사 결과 의심 소견',
          source: '강북삼성병원'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      const window3m = result.windows.find(w => w.window === '3m');
      
      expect(window3m.status).toBe('해당');
      expect(window3m.evidence).toHaveLength(1);
      expect(window3m.evidence[0].linkage_to_claim).toBe(true);
    });

    test('3개월 내 일반 검사 - 해당없음', () => {
      const records = [
        {
          date: '2023-04-15',
          text: '일반 건강검진 정상',
          source: '서울대병원'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      const window3m = result.windows.find(w => w.window === '3m');
      
      expect(window3m.status).toBe('해당없음');
      expect(window3m.evidence).toHaveLength(0);
    });

    test('3개월 외 기간 - 해당없음', () => {
      const records = [
        {
          date: '2023-01-01', // 계약일 151일 전
          text: '자궁내막 의심 소견',
          source: '병원'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      const window3m = result.windows.find(w => w.window === '3m');
      
      expect(window3m.status).toBe('해당없음');
    });
  });

  describe('2년 윈도우 테스트', () => {
    test('2년 내 입원 기록 - 해당 판정', () => {
      const records = [
        {
          date: '2022-08-01', // 계약일 304일 전
          text: '부인과 질환으로 입원 치료',
          source: '은평성모병원'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      const window2y = result.windows.find(w => w.window === '2y');
      
      expect(window2y.status).toBe('해당');
      expect(window2y.evidence).toHaveLength(1);
    });

    test('2년 내 수술 기록 - 해당 판정', () => {
      const records = [
        {
          date: '2022-12-15',
          text: '복강경 수술 시행',
          source: '홍익병원'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      const window2y = result.windows.find(w => w.window === '2y');
      
      expect(window2y.status).toBe('해당');
    });
  });

  describe('5년 윈도우 테스트', () => {
    test('5년 내 암 진단 - 위반의심 판정', () => {
      const records = [
        {
          date: '2020-03-15', // 계약일 3년 전
          text: '자궁내막암 진단 및 치료',
          source: '서울대병원'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      const window5y = result.windows.find(w => w.window === '5y');
      
      expect(window5y.status).toBe('위반의심');
      expect(window5y.evidence[0].linkage_to_claim).toBe(true);
    });

    test('5년 내 다른 암 진단 - 해당 판정', () => {
      const records = [
        {
          date: '2019-06-01',
          text: '유방암 진단',
          source: '강남세브란스'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      const window5y = result.windows.find(w => w.window === '5y');
      
      expect(window5y.status).toBe('해당');
      expect(window5y.evidence[0].linkage_to_claim).toBe(false);
    });
  });

  describe('복합 시나리오 테스트', () => {
    test('여러 윈도우에 걸친 복합 기록', () => {
      const records = [
        {
          date: '2023-04-01', // 3m 내
          text: '자궁내막 조직검사 의심',
          source: '병원A'
        },
        {
          date: '2022-06-01', // 2y 내
          text: '부인과 입원',
          source: '병원B'
        },
        {
          date: '2019-06-01', // 5y 내
          text: '자궁내막암 수술',
          source: '병원C'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      
      expect(result.windows.find(w => w.window === '3m').status).toBe('위반의심');
      expect(result.windows.find(w => w.window === '2y').status).toBe('해당');
      expect(result.windows.find(w => w.window === '5y').status).toBe('위반의심');
    });
  });

  describe('엣지 케이스 테스트', () => {
    test('빈 레코드 배열', () => {
      const result = computeDisclosure({ ...baseConfig, records: [] });
      
      result.windows.forEach(window => {
        expect(window.status).toBe('해당없음');
        expect(window.evidence).toHaveLength(0);
      });
    });

    test('잘못된 날짜 형식', () => {
      const records = [
        {
          date: 'invalid-date',
          text: '암 진단',
          source: '병원'
        }
      ];

      expect(() => {
        computeDisclosure({ ...baseConfig, records });
      }).not.toThrow();
    });

    test('누락된 필드', () => {
      const records = [
        {
          date: '2023-04-01',
          // text 누락
          source: '병원'
        }
      ];

      const result = computeDisclosure({ ...baseConfig, records });
      expect(result.windows).toHaveLength(3);
    });
  });
});