// structuredOutput.test.js - 구조화된 출력 검증 단위 테스트
import { 
  validateStructure, 
  FullReportSchema, 
  SummarySchema, 
  DisclosureSchema 
} from '../../src/services/core/structuredOutput.js';

describe('StructuredOutput', () => {
  describe('FullReportSchema 검증', () => {
    test('유효한 Full Report 구조', () => {
      const validReport = {
        patient: { name: '홍길동', dob: '1980-01-01' },
        visit: { date: '2023-06-01', reason: '정기검진' },
        diagnosis: ['자궁내막암', 'T2N1M0'],
        exams: [
          { name: 'MRI', date: '2023-06-01', result: '정상' },
          { name: 'CT', date: '2023-06-02', result: '이상소견' }
        ],
        treatments: [
          { type: '수술', date: '2023-06-10', details: '복강경 수술' }
        ],
        periods: {
          admission: { start: '2023-06-10', end: '2023-06-15', days: 5 },
          outpatient: { visits: 3, period: '2023-06-01~2023-06-30' }
        },
        history: ['고혈압', '당뇨'],
        doctor_note: '수술 후 경과 양호함'
      };

      const result = validateStructure(validReport, FullReportSchema);
      expect(result.ok).toBe(true);
    });

    test('필수 필드 누락 - patient', () => {
      const invalidReport = {
        // patient 누락
        visit: { date: '2023-06-01' },
        diagnosis: [],
        exams: [],
        treatments: [],
        periods: {},
        history: [],
        doctor_note: ''
      };

      const result = validateStructure(invalidReport, FullReportSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('missing:patient');
    });

    test('잘못된 타입 - diagnosis', () => {
      const invalidReport = {
        patient: {},
        visit: {},
        diagnosis: 'should be array', // 배열이어야 함
        exams: [],
        treatments: [],
        periods: {},
        history: [],
        doctor_note: ''
      };

      const result = validateStructure(invalidReport, FullReportSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('type:diagnosis');
    });
  });

  describe('SummarySchema 검증', () => {
    test('유효한 Summary Report 구조', () => {
      const validSummary = {
        visit_date: '2023.06.01',
        visit_reason: '조직검사 결과 확인',
        diagnosis: 'C54.1 자궁내막암 (Endometrial carcinoma)',
        exam_summary: 'MRI: 자궁내막 종양 확인, CT: 림프절 전이 의심',
        postop_pathology: '2023.06.15, 복강경 수술, T2N1M0',
        treatment: '수술/항암화학요법',
        opd_period: '2023.06.01 ~ 2023.08.01 / 8회 통원',
        adm_period: '2023.06.10 ~ 2023.06.15 / 5일 입원',
        history: '고혈압, 당뇨병',
        doctor_note: '수술 후 경과 양호, 정기 추적관찰 예정'
      };

      const result = validateStructure(validSummary, SummarySchema);
      expect(result.ok).toBe(true);
    });

    test('필수 필드 누락 - visit_date', () => {
      const invalidSummary = {
        // visit_date 누락
        visit_reason: '검사',
        diagnosis: '암',
        exam_summary: '정상',
        postop_pathology: '없음',
        treatment: '수술',
        opd_period: '1개월',
        adm_period: '5일',
        history: '없음',
        doctor_note: '양호'
      };

      const result = validateStructure(invalidSummary, SummarySchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('missing:visit_date');
    });

    test('잘못된 타입 - doctor_note', () => {
      const invalidSummary = {
        visit_date: '2023.06.01',
        visit_reason: '검사',
        diagnosis: '암',
        exam_summary: '정상',
        postop_pathology: '없음',
        treatment: '수술',
        opd_period: '1개월',
        adm_period: '5일',
        history: '없음',
        doctor_note: 123 // 문자열이어야 함
      };

      const result = validateStructure(invalidSummary, SummarySchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('type:doctor_note');
    });
  });

  describe('DisclosureSchema 검증', () => {
    test('유효한 Disclosure 구조', () => {
      const validDisclosure = {
        windows: [
          {
            window: '3m',
            status: '해당',
            evidence: [
              { date: '2023-03-01', text: '의심 소견', linkage_to_claim: true }
            ]
          },
          {
            window: '2y',
            status: '해당없음',
            evidence: []
          },
          {
            window: '5y',
            status: '위반의심',
            evidence: [
              { date: '2020-01-01', text: '암 진단', linkage_to_claim: true }
            ]
          }
        ],
        taggedRecords: [
          {
            date: '2023-03-01',
            text: '검사 결과',
            source: '병원',
            diffDays: 92,
            windows: ['3m']
          }
        ]
      };

      const result = validateStructure(validDisclosure, DisclosureSchema);
      expect(result.ok).toBe(true);
    });

    test('필수 필드 누락 - windows', () => {
      const invalidDisclosure = {
        // windows 누락
        taggedRecords: []
      };

      const result = validateStructure(invalidDisclosure, DisclosureSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('missing:windows');
    });

    test('잘못된 타입 - taggedRecords', () => {
      const invalidDisclosure = {
        windows: [],
        taggedRecords: 'should be array' // 배열이어야 함
      };

      const result = validateStructure(invalidDisclosure, DisclosureSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('type:taggedRecords');
    });
  });

  describe('엣지 케이스 테스트', () => {
    test('null 객체', () => {
      const result = validateStructure(null, FullReportSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('not-an-object');
    });

    test('undefined 객체', () => {
      const result = validateStructure(undefined, SummarySchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('not-an-object');
    });

    test('문자열 객체', () => {
      const result = validateStructure('not an object', DisclosureSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('not-an-object');
    });

    test('빈 객체', () => {
      const result = validateStructure({}, FullReportSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('missing:patient');
    });

    test('추가 필드가 있는 유효한 객체', () => {
      const validWithExtra = {
        visit_date: '2023.06.01',
        visit_reason: '검사',
        diagnosis: '암',
        exam_summary: '정상',
        postop_pathology: '없음',
        treatment: '수술',
        opd_period: '1개월',
        adm_period: '5일',
        history: '없음',
        doctor_note: '양호',
        extra_field: '추가 필드' // 스키마에 없는 필드
      };

      const result = validateStructure(validWithExtra, SummarySchema);
      expect(result.ok).toBe(true); // 추가 필드는 허용
    });
  });

  describe('타입 검증 세부 테스트', () => {
    test('object 타입 검증', () => {
      const testCases = [
        { value: {}, expected: true },
        { value: [], expected: false }, // 배열은 object가 아님
        { value: null, expected: false },
        { value: 'string', expected: false },
        { value: 123, expected: false }
      ];

      testCases.forEach(({ value, expected }) => {
        const obj = { patient: value, visit: {}, diagnosis: [], exams: [], treatments: [], periods: {}, history: [], doctor_note: '' };
        const result = validateStructure(obj, FullReportSchema);
        expect(result.ok).toBe(expected);
      });
    });

    test('array 타입 검증', () => {
      const testCases = [
        { value: [], expected: true },
        { value: [1, 2, 3], expected: true },
        { value: {}, expected: false },
        { value: null, expected: false },
        { value: 'string', expected: false }
      ];

      testCases.forEach(({ value, expected }) => {
        const obj = { patient: {}, visit: {}, diagnosis: value, exams: [], treatments: [], periods: {}, history: [], doctor_note: '' };
        const result = validateStructure(obj, FullReportSchema);
        expect(result.ok).toBe(expected);
      });
    });

    test('string 타입 검증', () => {
      const testCases = [
        { value: 'valid string', expected: true },
        { value: '', expected: true }, // 빈 문자열도 유효
        { value: 123, expected: false },
        { value: null, expected: false },
        { value: {}, expected: false }
      ];

      testCases.forEach(({ value, expected }) => {
        const obj = {
          visit_date: '2023.06.01',
          visit_reason: '검사',
          diagnosis: '암',
          exam_summary: '정상',
          postop_pathology: '없음',
          treatment: '수술',
          opd_period: '1개월',
          adm_period: '5일',
          history: '없음',
          doctor_note: value
        };
        const result = validateStructure(obj, SummarySchema);
        expect(result.ok).toBe(expected);
      });
    });
  });

  describe('실제 사용 시나리오', () => {
    test('LLM 응답 검증 시뮬레이션', () => {
      // LLM이 반환할 수 있는 다양한 형태의 응답 테스트
      const llmResponses = [
        {
          // 정상적인 응답
          data: {
            visit_date: '2023.06.01',
            visit_reason: '정기검진',
            diagnosis: 'C54.1 자궁내막암',
            exam_summary: 'MRI, CT 정상',
            postop_pathology: '수술 후 조직검사 양성',
            treatment: '수술, 항암치료',
            opd_period: '3개월',
            adm_period: '7일',
            history: '고혈압',
            doctor_note: '경과 양호'
          },
          shouldPass: true
        },
        {
          // 필드 누락
          data: {
            visit_date: '2023.06.01',
            // visit_reason 누락
            diagnosis: 'C54.1 자궁내막암',
            exam_summary: 'MRI, CT 정상',
            postop_pathology: '수술 후 조직검사 양성',
            treatment: '수술, 항암치료',
            opd_period: '3개월',
            adm_period: '7일',
            history: '고혈압',
            doctor_note: '경과 양호'
          },
          shouldPass: false
        },
        {
          // 잘못된 타입
          data: {
            visit_date: 20230601, // 숫자 (문자열이어야 함)
            visit_reason: '정기검진',
            diagnosis: 'C54.1 자궁내막암',
            exam_summary: 'MRI, CT 정상',
            postop_pathology: '수술 후 조직검사 양성',
            treatment: '수술, 항암치료',
            opd_period: '3개월',
            adm_period: '7일',
            history: '고혈압',
            doctor_note: '경과 양호'
          },
          shouldPass: false
        }
      ];

      llmResponses.forEach(({ data, shouldPass }, index) => {
        const result = validateStructure(data, SummarySchema);
        expect(result.ok).toBe(shouldPass);
      });
    });
  });
});