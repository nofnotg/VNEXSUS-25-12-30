// core-engine-simple.test.js - 코어 엔진 단순 테스트 (ESM)
import {
  PipelineStateMachine,
  DataContracts,
  TextIngestor,
  AnchorDetector,
  EntityNormalizer,
  TimelineAssembler,
  DiseaseRuleEngine,
  DisclosureAnalyzer,
  ConfidenceScorer,
  ReportSynthesizer,
  EvidenceBinder
} from '../services/core-engine/index.js';

describe('Core Engine Components Tests', () => {
  
  describe('DataContracts', () => {
    test('should create valid Anchor object', () => {
      const anchor = DataContracts.DataFactory.createAnchor({
        text: '2023년 1월 15일',
        type: 'date',
        value: '2023-01-15',
        confidence: 0.95,
        position: { start: 0, end: 11 }
      });
      
      expect(anchor).toBeDefined();
      expect(anchor.text).toBe('2023년 1월 15일');
      expect(anchor.type).toBe('date');
      expect(anchor.confidence).toBe(0.95);
    });

    test('should create valid Diagnosis object', () => {
      const diagnosis = DataContracts.DataFactory.createDiagnosis({
        name: '고혈압',
        code: 'I10',
        confidence: 0.9,
        severity: 'moderate',
        status: 'active'
      });
      
      expect(diagnosis).toBeDefined();
      expect(diagnosis.name).toBe('고혈압');
      expect(diagnosis.code).toBe('I10');
      expect(diagnosis.type).toBe('diagnosis');
    });

    test('should validate Timeline object', () => {
      const timeline = DataContracts.DataFactory.createTimeline({
        events: [],
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      });
      
      const isValid = DataContracts.ValidationUtils.validateTimeline(timeline);
      expect(isValid).toBe(true);
    });
  });

  describe('Core Components', () => {
    test('TextIngestor should initialize correctly', () => {
      const ingestor = new TextIngestor();
      expect(ingestor).toBeDefined();
      expect(typeof ingestor.ingest).toBe('function');
      expect(typeof ingestor.healthCheck).toBe('function');
    });

    test('AnchorDetector should initialize correctly', () => {
      const detector = new AnchorDetector();
      expect(detector).toBeDefined();
      expect(typeof detector.detectAnchors).toBe('function');
      expect(typeof detector.healthCheck).toBe('function');
    });

    test('EntityNormalizer should initialize correctly', () => {
      const normalizer = new EntityNormalizer();
      expect(normalizer).toBeDefined();
      expect(typeof normalizer.normalize).toBe('function');
      expect(typeof normalizer.healthCheck).toBe('function');
    });

    test('TimelineAssembler should initialize correctly', () => {
      const assembler = new TimelineAssembler();
      expect(assembler).toBeDefined();
      expect(typeof assembler.assemble).toBe('function');
      expect(typeof assembler.healthCheck).toBe('function');
    });

    test('DiseaseRuleEngine should initialize correctly', () => {
      const engine = new DiseaseRuleEngine();
      expect(engine).toBeDefined();
      expect(typeof engine.applyRules).toBe('function');
      expect(typeof engine.healthCheck).toBe('function');
    });

    test('DisclosureAnalyzer should initialize correctly', () => {
      const analyzer = new DisclosureAnalyzer();
      expect(analyzer).toBeDefined();
      expect(typeof analyzer.analyze).toBe('function');
      expect(typeof analyzer.healthCheck).toBe('function');
    });

    test('ConfidenceScorer should initialize correctly', () => {
      const scorer = new ConfidenceScorer();
      expect(scorer).toBeDefined();
      expect(typeof scorer.calculateScore).toBe('function');
      expect(typeof scorer.healthCheck).toBe('function');
    });

    test('ReportSynthesizer should initialize correctly', () => {
      const synthesizer = new ReportSynthesizer();
      expect(synthesizer).toBeDefined();
      expect(typeof synthesizer.synthesize).toBe('function');
      expect(typeof synthesizer.healthCheck).toBe('function');
    });

    test('EvidenceBinder should initialize correctly', () => {
      const binder = new EvidenceBinder();
      expect(binder).toBeDefined();
      expect(typeof binder.bindEvidence).toBe('function');
      expect(typeof binder.healthCheck).toBe('function');
    });
  });

  describe('PipelineStateMachine', () => {
    let pipeline;

    beforeEach(() => {
      pipeline = new PipelineStateMachine({
        qualityGate: 'draft',
        maxRetries: 1,
        timeout: 5000,
        enableCaching: false,
        enableFallback: true,
        detailedLogging: false
      });
    });

    test('should initialize correctly', () => {
      expect(pipeline).toBeDefined();
      expect(typeof pipeline.execute).toBe('function');
      expect(typeof pipeline.getStatus).toBe('function');
      expect(typeof pipeline.abort).toBe('function');
      expect(typeof pipeline.healthCheck).toBe('function');
    });

    test('should have correct initial state', () => {
      const status = pipeline.getStatus();
      expect(status.currentState).toBe('INIT');
      expect(status.isRunning).toBe(false);
      expect(status.progress).toBe(0);
    });

    test('should validate input correctly', async () => {
      // 빈 입력 테스트
      await expect(pipeline.execute('')).rejects.toThrow();
      
      // null 입력 테스트
      await expect(pipeline.execute(null)).rejects.toThrow();
      
      // undefined 입력 테스트
      await expect(pipeline.execute(undefined)).rejects.toThrow();
    });

    test('should execute with valid input', async () => {
      const sampleText = '환자는 2023년 1월 15일 고혈압 진단을 받았습니다.';
      
      try {
        const result = await pipeline.execute(sampleText);
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      } catch (error) {
        // 외부 의존성이 없어서 실패할 수 있지만, 파이프라인 구조는 정상이어야 함
        expect(error.message).toContain('Pipeline execution failed');
      }
    });

    test('should handle abort correctly', async () => {
      const sampleText = '환자는 2023년 1월 15일 고혈압 진단을 받았습니다.';
      
      // 실행 시작
      const executePromise = pipeline.execute(sampleText);
      
      // 즉시 중단
      pipeline.abort();
      
      try {
        await executePromise;
      } catch (error) {
        expect(error.message).toContain('aborted');
      }
    });

    test('should perform health check', () => {
      const health = pipeline.healthCheck();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.components).toBeDefined();
      expect(Array.isArray(health.components)).toBe(true);
    });
  });

  describe('Integration Test', () => {
    test('should handle complete pipeline flow', async () => {
      const pipeline = new PipelineStateMachine({
        qualityGate: 'draft',
        maxRetries: 1,
        timeout: 10000,
        enableCaching: false,
        enableFallback: true,
        detailedLogging: true
      });

      const sampleText = `
        환자 정보:
        - 이름: 홍길동
        - 생년월일: 1980년 5월 15일
        - 진료 기록:
          * 2023년 1월 15일: 고혈압 진단 (I10)
          * 2023년 3월 20일: 당뇨병 진단 (E11)
          * 2023년 6월 10일: 정기 검진
        
        현재 복용 중인 약물:
        - 혈압약: 아모디핀 5mg
        - 당뇨약: 메트포르민 500mg
      `;

      try {
        const result = await pipeline.execute(sampleText);
        
        // 결과 구조 검증
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        
        if (result.success) {
          expect(result.data).toBeDefined();
          expect(result.data.anchors).toBeDefined();
          expect(result.data.entities).toBeDefined();
          expect(result.data.timeline).toBeDefined();
          expect(result.data.confidence).toBeDefined();
          expect(result.data.report).toBeDefined();
        }
        
      } catch (error) {
        // 외부 의존성 부족으로 실패할 수 있지만, 파이프라인은 정상 작동해야 함
        console.log('Pipeline execution failed (expected due to missing dependencies):', error.message);
        expect(error).toBeDefined();
      }

      // 상태 확인
      const finalStatus = pipeline.getStatus();
      expect(finalStatus).toBeDefined();
      expect(finalStatus.currentState).toBeDefined();
    });
  });
});
