import { CoreEngineService } from '../services/coreEngineService.js';
import { DataContracts } from '../services/core-engine/index.js';

describe('Core Engine Integration Tests', () => {
    let coreEngineService;
    
    beforeAll(() => {
        // 테스트 환경 설정
        process.env.NODE_ENV = 'test';
        process.env.CORE_ENGINE_ENABLED = 'true';
        process.env.PIPELINE_QUALITY_GATE = 'standard';
        
        coreEngineService = new CoreEngineService();
    });

    afterAll(() => {
        // 정리
        delete process.env.CORE_ENGINE_ENABLED;
        delete process.env.PIPELINE_QUALITY_GATE;
    });

    describe('Service Initialization', () => {
        test('should initialize CoreEngineService successfully', () => {
            expect(coreEngineService).toBeDefined();
            expect(coreEngineService.pipeline).toBeDefined();
        });

        test('should have pipeline initialized', () => {
            expect(coreEngineService.pipelineInitialized).toBe(true);
        });

        test('should return healthy status', async () => {
            const health = await coreEngineService.getHealthStatus();
            expect(health.status).toBe('healthy');
            expect(health.pipeline).toBeDefined();
        });
    });

    describe('Data Contracts', () => {
        test('should create Anchor with proper validation', () => {
            const anchorData = {
                date: '2024-01-15',
                dateString: '2024년 1월 15일',
                anchorType: 'visit',
                context: '외래 방문'
            };
            
            const anchor = DataContracts.DataFactory.createAnchor(anchorData);
            expect(anchor).toBeInstanceOf(DataContracts.Anchor);
            expect(anchor.validateDate()).toBe(true);
            expect(anchor.anchorType).toBe('visit');
        });

        test('should create Diagnosis entity', () => {
            const diagnosisData = {
                text: '고혈압',
                normalizedText: 'hypertension',
                entityType: 'diagnosis',
                icd10Code: 'I10',
                isPrimary: true
            };
            
            const diagnosis = DataContracts.DataFactory.createEntity(diagnosisData);
            expect(diagnosis).toBeInstanceOf(DataContracts.Diagnosis);
            expect(diagnosis.entityType).toBe('diagnosis');
            expect(diagnosis.isPrimary).toBe(true);
        });

        test('should create Timeline with events', () => {
            const timeline = DataContracts.DataFactory.createTimeline({
                patientId: 'test-patient-001',
                timelineType: 'medical'
            });
            
            expect(timeline).toBeInstanceOf(DataContracts.Timeline);
            expect(timeline.patientId).toBe('test-patient-001');
            expect(timeline.events).toEqual([]);
        });

        test('should validate entities correctly', () => {
            const validEntity = new DataContracts.MedicalEntity({
                text: '당뇨병',
                entityType: 'diagnosis',
                confidence: 0.95
            });
            
            const validation = DataContracts.ValidationUtils.validateEntity(validEntity);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toEqual([]);
        });
    });

    describe('Pipeline Execution', () => {
        const sampleMedicalText = `
            환자: 김철수 (남, 65세)
            
            2024년 1월 15일 외래 방문
            주소: 가슴 통증 및 호흡곤란
            
            과거력:
            - 2020년 고혈압 진단
            - 2022년 당뇨병 진단
            
            현재 복용 약물:
            - 아스피린 100mg 1일 1회
            - 메트포르민 500mg 1일 2회
            
            검사 결과:
            - 혈압: 150/90 mmHg
            - 혈당: 180 mg/dL
            - 심전도: 정상
            
            진단: 불안정 협심증 의심
            계획: 관상동맥 조영술 예정
        `;

        test('should analyze medical text successfully', async () => {
            const result = await coreEngineService.analyze(sampleMedicalText, {
                qualityGate: 'standard',
                includeEvidence: true,
                generateTimeline: true
            });

            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data.skeletonJson).toBeDefined();
        }, 30000); // 30초 타임아웃

        test('should detect temporal anchors', async () => {
            const result = await coreEngineService.analyze(sampleMedicalText);
            
            expect(result.data.anchors).toBeDefined();
            expect(result.data.anchors.length).toBeGreaterThan(0);
            
            // 2024년 1월 15일 방문 앵커 확인
            const visitAnchor = result.data.anchors.find(a => 
                a.anchorType === 'visit' && a.dateString.includes('2024')
            );
            expect(visitAnchor).toBeDefined();
        }, 30000);

        test('should extract medical entities', async () => {
            const result = await coreEngineService.analyze(sampleMedicalText);
            
            expect(result.data.entities).toBeDefined();
            expect(result.data.entities.length).toBeGreaterThan(0);
            
            // 진단 엔티티 확인
            const diagnoses = result.data.entities.filter(e => e.entityType === 'diagnosis');
            expect(diagnoses.length).toBeGreaterThan(0);
            
            // 약물 엔티티 확인
            const medications = result.data.entities.filter(e => e.entityType === 'medication');
            expect(medications.length).toBeGreaterThan(0);
        }, 30000);

        test('should generate timeline', async () => {
            const result = await coreEngineService.analyze(sampleMedicalText, {
                generateTimeline: true
            });
            
            expect(result.data.timeline).toBeDefined();
            expect(result.data.timeline.events).toBeDefined();
            expect(result.data.timeline.eventCount).toBeGreaterThan(0);
        }, 30000);

        test('should calculate confidence scores', async () => {
            const result = await coreEngineService.analyze(sampleMedicalText);
            
            expect(result.data.confidenceScores).toBeDefined();
            expect(result.data.confidenceScores.overall).toBeDefined();
            expect(result.data.confidenceScores.overall).toBeGreaterThan(0);
            expect(result.data.confidenceScores.overall).toBeLessThanOrEqual(1);
        }, 30000);

        test('should perform disclosure analysis', async () => {
            const result = await coreEngineService.analyze(sampleMedicalText);
            
            expect(result.data.disclosureAnalysis).toBeDefined();
            expect(result.data.disclosureAnalysis.riskLevel).toBeDefined();
            expect(result.data.disclosureAnalysis.disclosureItems).toBeDefined();
        }, 30000);

        test('should generate skeleton JSON', async () => {
            const result = await coreEngineService.analyze(sampleMedicalText);
            
            expect(result.data.skeletonJson).toBeDefined();
            expect(result.data.skeletonJson.reportId).toBeDefined();
            expect(result.data.skeletonJson.clinicalSummary).toBeDefined();
            expect(result.data.skeletonJson.timeline).toBeDefined();
            expect(result.data.skeletonJson.riskAssessment).toBeDefined();
        }, 30000);
    });

    describe('Quality Gates', () => {
        const shortText = "2024년 1월 15일 고혈압 진단";

        test('should handle draft quality gate', async () => {
            const result = await coreEngineService.analyze(shortText, {
                qualityGate: 'draft'
            });
            
            expect(result.success).toBe(true);
            expect(result.data.qualityGate).toBe('draft');
        }, 15000);

        test('should handle standard quality gate', async () => {
            const result = await coreEngineService.analyze(shortText, {
                qualityGate: 'standard'
            });
            
            expect(result.success).toBe(true);
            expect(result.data.qualityGate).toBe('standard');
        }, 20000);

        test('should handle rigorous quality gate', async () => {
            const result = await coreEngineService.analyze(shortText, {
                qualityGate: 'rigorous'
            });
            
            expect(result.success).toBe(true);
            expect(result.data.qualityGate).toBe('rigorous');
        }, 30000);
    });

    describe('Error Handling', () => {
        test('should handle empty text input', async () => {
            const result = await coreEngineService.analyze('');
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error.message).toContain('텍스트가 비어있습니다');
        });

        test('should handle invalid options', async () => {
            const result = await coreEngineService.analyze('test text', {
                qualityGate: 'invalid_gate'
            });
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle pipeline abort', async () => {
            // 긴 텍스트로 파이프라인 시작
            const longText = 'test text '.repeat(1000);
            const analysisPromise = coreEngineService.analyze(longText);
            
            // 즉시 중단
            setTimeout(() => {
                coreEngineService.abortPipeline();
            }, 100);
            
            const result = await analysisPromise;
            expect(result.success).toBe(false);
            expect(result.error.message).toContain('중단');
        });
    });

    describe('Performance', () => {
        test('should complete analysis within time budget', async () => {
            const startTime = Date.now();
            
            const result = await coreEngineService.analyze(
                "2024년 1월 15일 고혈압 진단. 아스피린 처방.",
                { qualityGate: 'standard' }
            );
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(5 * 60 * 1000); // 5분 이내
        }, 5 * 60 * 1000);

        test('should handle concurrent requests', async () => {
            const requests = Array(3).fill().map((_, i) => 
                coreEngineService.analyze(`테스트 텍스트 ${i + 1}`, {
                    qualityGate: 'draft'
                })
            );
            
            const results = await Promise.all(requests);
            
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        }, 30000);
    });

    describe('Pipeline Status', () => {
        test('should get pipeline status', () => {
            const status = coreEngineService.getPipelineStatus();
            
            expect(status).toBeDefined();
            expect(status.state).toBeDefined();
            expect(status.isRunning).toBeDefined();
        });

        test('should track processing stages', async () => {
            const analysisPromise = coreEngineService.analyze("테스트 텍스트");
            
            // 상태 확인
            setTimeout(() => {
                const status = coreEngineService.getPipelineStatus();
                expect(status.isRunning).toBe(true);
            }, 100);
            
            await analysisPromise;
            
            const finalStatus = coreEngineService.getPipelineStatus();
            expect(finalStatus.isRunning).toBe(false);
        });
    });

    describe('Integration with Existing System', () => {
        test('should maintain backward compatibility', async () => {
            // 기존 메서드들이 여전히 작동하는지 확인
            expect(typeof coreEngineService.analyzeDisclosure).toBe('function');
            expect(typeof coreEngineService.mapDiseaseRules).toBe('function');
            expect(typeof coreEngineService.generateReport).toBe('function');
        });

        test('should integrate with existing disclosure analysis', async () => {
            const disclosureResult = await coreEngineService.analyzeDisclosure({
                diagnoses: ['고혈압', '당뇨병'],
                procedures: ['관상동맥조영술'],
                medications: ['아스피린']
            });
            
            expect(disclosureResult).toBeDefined();
            expect(disclosureResult.riskLevel).toBeDefined();
        });

        test('should work with existing report generation', async () => {
            const reportData = {
                patientInfo: { name: '김철수', age: 65 },
                diagnoses: ['고혈압'],
                timeline: []
            };
            
            const report = await coreEngineService.generateReport(reportData);
            expect(report).toBeDefined();
        });
    });
});

// 헬퍼 함수들
function createSampleAnchor() {
    return DataContracts.DataFactory.createAnchor({
        date: '2024-01-15',
        dateString: '2024년 1월 15일',
        anchorType: 'visit',
        context: '외래 방문',
        confidence: 0.95
    });
}

function createSampleDiagnosis() {
    return DataContracts.DataFactory.createEntity({
        text: '고혈압',
        normalizedText: 'hypertension',
        entityType: 'diagnosis',
        icd10Code: 'I10',
        isPrimary: true,
        confidence: 0.9
    });
}

function createSampleMedication() {
    return DataContracts.DataFactory.createEntity({
        text: '아스피린 100mg',
        normalizedText: 'aspirin 100mg',
        entityType: 'medication',
        genericName: 'aspirin',
        dosage: '100mg',
        frequency: '1일 1회',
        confidence: 0.85
    });
}

module.exports = {
    createSampleAnchor,
    createSampleDiagnosis,
    createSampleMedication
};
