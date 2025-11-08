// primaryMetastasisClassifier.test.js - 원발/전이 분류기 단위 테스트
import { classifyPrimaryMetastasis } from '../../src/services/core/primaryMetastasisClassifier.js';

describe('PrimaryMetastasisClassifier', () => {
  describe('원발 부위 분류 테스트', () => {
    test('자궁내막암 원발 감지', () => {
      const records = [
        {
          text: 'Endometrioid carcinoma of the endometrium. Primary tumor confirmed.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('자궁내막암');
      expect(result.classificationLine).toContain('자궁내막암 원발');
    });

    test('직장암 원발 감지', () => {
      const records = [
        {
          text: 'Rectal adenocarcinoma. Primary site: rectum (C20).',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('직장암');
      expect(result.classificationLine).toContain('직장암 원발');
    });

    test('유방암 원발 감지', () => {
      const records = [
        {
          text: 'Invasive ductal carcinoma of the breast. C50 classification.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('유방암');
    });

    test('폐암 원발 감지', () => {
      const records = [
        {
          text: 'Non-small cell lung carcinoma. Primary lung tumor (C34).',
          source: '흉부외과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('폐암');
    });

    test('원발부위 미상', () => {
      const records = [
        {
          text: '일반적인 검사 소견으로 특별한 이상 없음',
          source: '내과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('원발부위 미상');
      expect(result.classificationLine).toContain('원발부위 미상');
    });
  });

  describe('전이 부위 분류 테스트', () => {
    test('림프절 전이 감지', () => {
      const records = [
        {
          text: 'Pelvic lymph node metastasis confirmed. Paraaortic LN involvement.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.metastasis).toContain('림프절');
      expect(result.classificationLine).toContain('림프절 전이');
    });

    test('복막 전이 감지', () => {
      const records = [
        {
          text: 'Peritoneal seeding noted on CT scan. 복막 전이 의심.',
          source: '영상의학과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.metastasis).toContain('복막');
      expect(result.classificationLine).toContain('복막 전이');
    });

    test('간 전이 감지', () => {
      const records = [
        {
          text: 'Multiple liver metastases on MRI. 간 전이 다발성.',
          source: '영상의학과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.metastasis).toContain('간');
    });

    test('뼈 전이 감지', () => {
      const records = [
        {
          text: 'Bone scan shows multiple bone metastases. 골 전이 소견.',
          source: '핵의학과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.metastasis).toContain('뼈');
    });

    test('전이 없음', () => {
      const records = [
        {
          text: 'Primary tumor only. No evidence of metastasis.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.metastasis).toHaveLength(0);
      expect(result.classificationLine).toContain('전이 없음');
    });
  });

  describe('복합 시나리오 테스트', () => {
    test('원발 + 단일 전이', () => {
      const records = [
        {
          text: 'Endometrioid carcinoma of endometrium confirmed.',
          source: '병리과'
        },
        {
          text: 'Pelvic lymph node metastasis present.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('자궁내막암');
      expect(result.metastasis).toContain('림프절');
      expect(result.classificationLine).toBe('분류: ✅ 자궁내막암 원발 + 림프절 전이');
    });

    test('원발 + 다중 전이', () => {
      const records = [
        {
          text: 'Rectal adenocarcinoma primary tumor.',
          source: '병리과'
        },
        {
          text: 'Liver metastases and peritoneal seeding confirmed.',
          source: '영상의학과'
        },
        {
          text: 'Paraaortic lymph node involvement.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('직장암');
      expect(result.metastasis).toContain('간');
      expect(result.metastasis).toContain('복막');
      expect(result.metastasis).toContain('림프절');
      expect(result.classificationLine).toBe('분류: ✅ 직장암 원발 + 간 및 복막 및 림프절 전이');
    });

    test('원발만 있고 전이 없음', () => {
      const records = [
        {
          text: 'Breast carcinoma T1N0M0. No metastasis detected.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('유방암');
      expect(result.metastasis).toHaveLength(0);
      expect(result.classificationLine).toBe('분류: ✅ 유방암 원발 + 전이 없음');
    });

    test('전이만 있고 원발 미상', () => {
      const records = [
        {
          text: 'Multiple liver metastases of unknown primary.',
          source: '영상의학과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('원발부위 미상');
      expect(result.metastasis).toContain('간');
      expect(result.classificationLine).toBe('분류: ✅ 원발부위 미상 원발 + 간 전이');
    });
  });

  describe('한글/영문 혼합 테스트', () => {
    test('한글 의료용어 인식', () => {
      const records = [
        {
          text: '자궁내막 선암종 확진. 골반 림프절 전이 소견.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('자궁내막암');
      expect(result.metastasis).toContain('림프절');
    });

    test('영문 의료용어 인식', () => {
      const records = [
        {
          text: 'Endometrioid carcinoma with lymph node metastasis.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('자궁내막암');
      expect(result.metastasis).toContain('림프절');
    });

    test('ICD-10 코드 인식', () => {
      const records = [
        {
          text: 'Malignant neoplasm C54.1 (endometrium).',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('자궁내막암');
    });
  });

  describe('엣지 케이스 테스트', () => {
    test('빈 레코드 배열', () => {
      const result = classifyPrimaryMetastasis({ records: [] });
      expect(result.primary).toBe('원발부위 미상');
      expect(result.metastasis).toHaveLength(0);
      expect(result.classificationLine).toBe('분류: ✅ 원발부위 미상 원발 + 전이 없음');
    });

    test('텍스트 없는 레코드', () => {
      const records = [
        { text: '', source: '병리과' },
        { text: null, source: '영상의학과' },
        { source: '내과' } // text 필드 없음
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('원발부위 미상');
      expect(result.metastasis).toHaveLength(0);
    });

    test('중복 전이 부위 제거', () => {
      const records = [
        {
          text: 'Liver metastasis confirmed on CT.',
          source: '영상의학과'
        },
        {
          text: 'Multiple liver met on MRI.',
          source: '영상의학과'
        },
        {
          text: '간 전이 다발성 소견.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.metastasis).toEqual(['간']); // 중복 제거되어 하나만
    });

    test('대소문자 구분 없이 인식', () => {
      const records = [
        {
          text: 'ENDOMETRIOID CARCINOMA with LYMPH NODE metastasis.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.primary).toBe('자궁내막암');
      expect(result.metastasis).toContain('림프절');
    });
  });

  describe('분류 라인 형식 테스트', () => {
    test('고정 형식 준수', () => {
      const records = [
        {
          text: 'Breast carcinoma with bone and liver metastases.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.classificationLine).toMatch(/^분류: ✅ .+ 원발 \+ .+ 전이$/);
    });

    test('전이 없을 때 형식', () => {
      const records = [
        {
          text: 'Lung carcinoma T1N0M0.',
          source: '병리과'
        }
      ];

      const result = classifyPrimaryMetastasis({ records });
      expect(result.classificationLine).toMatch(/^분류: ✅ .+ 원발 \+ 전이 없음$/);
    });
  });
});