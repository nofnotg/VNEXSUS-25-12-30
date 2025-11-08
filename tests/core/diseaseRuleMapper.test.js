// diseaseRuleMapper.test.js - 질환 규칙 매퍼 단위 테스트
import { mapDiseaseRules } from '../../src/services/core/diseaseRuleMapper.js';

describe('DiseaseRuleMapper', () => {
  describe('질환군 분류 테스트', () => {
    test('협심증 그룹 분류', () => {
      const records = [
        {
          date: '2023-06-01',
          text: 'Coronary angiography shows 70% stenosis in LAD. Angina pectoris confirmed.',
          source: '심장내과'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.group).toBe('협심증');
      expect(result[0].normalized.metrics.stenosis).toBe('70');
    });

    test('AMI 그룹 분류', () => {
      const records = [
        {
          date: '2023-06-01',
          text: 'Acute myocardial infarction. Troponin I: 15.2 ng/mL, CK-MB: 45 U/L. ST elevation on EKG.',
          source: '응급실'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.group).toBe('AMI');
      expect(result[0].normalized.metrics.troponin).toBe('15.2');
      expect(result[0].normalized.metrics.ckmb).toBe('45');
      expect(result[0].normalized.metrics.ekg_st).toBe(true);
    });

    test('부정맥 그룹 분류', () => {
      const records = [
        {
          date: '2023-06-01',
          text: 'Holter monitoring shows AF with 150 episodes. Arrhythmia confirmed.',
          source: '심장내과'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.group).toBe('부정맥');
      expect(result[0].normalized.metrics.rhythm).toBe('af');
      expect(result[0].normalized.metrics.holter_freq).toBe('150');
    });

    test('뇌혈관 그룹 분류', () => {
      const records = [
        {
          date: '2023-06-01',
          text: 'Brain CT shows Lt MCA infarction. MRA reveals ICA stenosis.',
          source: '신경과'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.group).toBe('뇌혈관');
      expect(result[0].normalized.site).toBe('Lt MCA');
    });

    test('암 그룹 분류', () => {
      const records = [
        {
          date: '2023-06-01',
          text: 'Endometrioid adenocarcinoma. Pathology report shows T2N1M0 staging.',
          source: '병리과'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.group).toBe('암');
      expect(result[0].normalized.metrics.tnm).toBe('T2N1M0');
    });
  });

  describe('검사명 추출 테스트', () => {
    test('영상 검사 추출', () => {
      const records = [
        { date: '2023-06-01', text: 'Chest CT shows no abnormality', source: '영상의학과' },
        { date: '2023-06-02', text: 'Cardiac MRI performed', source: '심장내과' },
        { date: '2023-06-03', text: 'Coronary CT-angio scheduled', source: '심장내과' }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.exam).toBe('chest ct');
      expect(result[1].normalized.exam).toBe('cardiac mri');
      expect(result[2].normalized.exam).toBe('coronary ct-angio');
    });

    test('심전도 검사 추출', () => {
      const records = [
        { date: '2023-06-01', text: 'EKG shows normal sinus rhythm', source: '심장내과' },
        { date: '2023-06-02', text: 'Holter monitoring for 24 hours', source: '심장내과' }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.exam).toBe('ekg');
      expect(result[1].normalized.exam).toBe('holter');
    });

    test('병리 검사 추출', () => {
      const records = [
        { date: '2023-06-01', text: 'Biopsy result pending', source: '병리과' },
        { date: '2023-06-02', text: 'TRUS guided biopsy performed', source: '비뇨기과' }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.exam).toBe('biopsy');
      expect(result[1].normalized.exam).toBe('trus');
    });
  });

  describe('날짜 추출 테스트', () => {
    test('텍스트 내 날짜 추출', () => {
      const records = [
        {
          date: '2023-06-01',
          text: '2023-05-15 시행한 검사 결과 정상',
          source: '내과'
        },
        {
          date: '', // 빈 날짜
          text: '2023.05.20 MRI 촬영',
          source: '영상의학과'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.date).toBe('2023-06-01'); // 기존 date 우선
      expect(result[1].normalized.date).toBe('2023.05.20'); // 텍스트에서 추출
    });

    test('다양한 날짜 형식', () => {
      const records = [
        { date: '', text: '2023-5-1 검사', source: '내과' },
        { date: '', text: '2023/05/01 결과', source: '내과' },
        { date: '', text: '2023.5.1 소견', source: '내과' }
      ];

      const result = mapDiseaseRules(records);
      result.forEach(r => {
        expect(r.normalized.date).toMatch(/2023/);
      });
    });
  });

  describe('복합 시나리오 테스트', () => {
    test('다중 질환 레코드 처리', () => {
      const records = [
        {
          date: '2023-06-01',
          text: 'Coronary angiography shows 80% stenosis. TIMI 2 flow.',
          source: '심장내과'
        },
        {
          date: '2023-06-02',
          text: 'Brain MRI shows Lt MCA territory infarction.',
          source: '신경과'
        },
        {
          date: '2023-06-03',
          text: 'Adenocarcinoma T3N2M1 confirmed by pathology.',
          source: '병리과'
        }
      ];

      const result = mapDiseaseRules(records);
      
      expect(result[0].normalized.group).toBe('협심증');
      expect(result[0].normalized.metrics.stenosis).toBe('80');
      expect(result[0].normalized.metrics.timi).toBe('2');
      
      expect(result[1].normalized.group).toBe('뇌혈관');
      expect(result[1].normalized.site).toBe('Lt MCA');
      
      expect(result[2].normalized.group).toBe('암');
      expect(result[2].normalized.metrics.tnm).toBe('T3N2M1');
    });
  });

  describe('엣지 케이스 테스트', () => {
    test('빈 레코드 배열', () => {
      const result = mapDiseaseRules([]);
      expect(result).toEqual([]);
    });

    test('텍스트 없는 레코드', () => {
      const records = [
        { date: '2023-06-01', text: '', source: '내과' },
        { date: '2023-06-01', text: null, source: '내과' },
        { date: '2023-06-01', source: '내과' } // text 필드 없음
      ];

      const result = mapDiseaseRules(records);
      result.forEach(r => {
        expect(r.normalized.group).toBe('기타');
        expect(r.normalized.exam).toBe('unspecified');
      });
    });

    test('알 수 없는 질환', () => {
      const records = [
        {
          date: '2023-06-01',
          text: '일반적인 감기 증상으로 내원',
          source: '내과'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.group).toBe('기타');
    });

    test('특수 문자 포함 텍스트', () => {
      const records = [
        {
          date: '2023-06-01',
          text: 'Troponin-I: 12.5ng/mL, CK-MB: 35U/L (정상범위: <0.1ng/mL)',
          source: '응급실'
        }
      ];

      const result = mapDiseaseRules(records);
      expect(result[0].normalized.group).toBe('AMI');
      expect(result[0].normalized.metrics.troponin).toBe('12.5');
      expect(result[0].normalized.metrics.ckmb).toBe('35');
    });
  });
});