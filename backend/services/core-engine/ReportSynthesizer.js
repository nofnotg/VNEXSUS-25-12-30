// ReportSynthesizer.js - 최종 보고서 합성 및 스켈레톤 JSON 생성 엔진
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../utils/logger.js';
import { EpisodeBuilder } from './utils/EpisodeBuilder.js';
import medicalTermFormatter from './utils/MedicalTermFormatter.js';
import reportFormatter from './utils/ReportFormatter.js';

export default class ReportSynthesizer {
    constructor(options = {}) {
        this.options = {
            enableTemplateValidation: options.enableTemplateValidation || true,
            enableContentOptimization: options.enableContentOptimization || true,
            maxReportItems: options.maxReportItems || 10,
            minReportItems: options.minReportItems || 5,
            qualityThreshold: options.qualityThreshold || 0.7,
            ...options
        };

        // Phase 5: 의료 용어 포맷터
        this.formatter = medicalTermFormatter;

        // Phase 6: 보고서 포맷터
        this.reportFormatter = reportFormatter;

        // 스켈레톤 JSON 템플릿
        this.skeletonTemplate = {
            reportMetadata: {
                reportId: null,
                generatedAt: null,
                version: '1.0.0',
                processingTimeMs: null,
                qualityScore: null,
                confidenceLevel: null
            },
            patientInfo: {
                patientId: null,
                reportDate: null,
                reportType: null
            },
            clinicalSummary: {
                primaryDiagnoses: [],
                secondaryDiagnoses: [],
                procedures: [],
                medications: [],
                keyFindings: []
            },
            timeline: {
                events: [],
                keyDates: [],
                episodeOfCare: []
            },
            riskAssessment: {
                disclosureItems: [],
                riskLevel: null,
                recommendations: []
            },
            qualityMetrics: {
                dataCompleteness: null,
                confidenceScore: null,
                uncertaintyLevel: null,
                validationResults: []
            },
            evidenceBase: {
                sourceDocuments: [],
                extractedEntities: [],
                supportingEvidence: []
            },
            // Master Plan Phase 2: Investigator View (optional)
            investigatorView: {
                claimSummary: null,
                keyEpisodes: [],
                allEpisodes: [],
                generationHints: []
            }
        };

        // 보고서 아이템 우선순위
        this.itemPriorities = {
            primaryDiagnosis: 10,
            majorProcedure: 9,
            criticalMedication: 8,
            admissionDate: 7,
            dischargeDate: 7,
            surgeryDate: 6,
            secondaryDiagnosis: 5,
            minorProcedure: 4,
            routineMedication: 3,
            labResult: 2,
            observation: 1
        };

        logService.info('ReportSynthesizer initialized', { options: this.options });
    }

    /**
     * 메인 보고서 합성 함수
     * @param {Object} analysisResults - 모든 이전 단계의 분석 결과
     * @returns {Object} 합성된 스켈레톤 JSON 보고서
     */
    async synthesizeReport(analysisResults) {
        try {
            const startTime = Date.now();

            // 1. 입력 데이터 검증
            await this.validateInputData(analysisResults);

            // 2. 스켈레톤 JSON 초기화
            const skeletonReport = this.initializeSkeletonReport(analysisResults);

            // 3. 임상 요약 생성
            await this.generateClinicalSummary(skeletonReport, analysisResults);

            // 4. 타임라인 구성
            await this.constructTimeline(skeletonReport, analysisResults);

            // 5. 위험 평가 통합
            await this.integrateRiskAssessment(skeletonReport, analysisResults);

            // 6. 품질 메트릭 설정
            await this.setQualityMetrics(skeletonReport, analysisResults);

            // 7. 증거 기반 설정
            await this.setEvidenceBase(skeletonReport, analysisResults);

            // 8. Master Plan Phase 2: Investigator View 생성
            await this.buildInvestigatorView(skeletonReport, analysisResults);

            // 9. 보고서 최적화
            if (this.options.enableContentOptimization) {
                await this.optimizeReportContent(skeletonReport, analysisResults);
            }

            // 9. 템플릿 검증
            if (this.options.enableTemplateValidation) {
                await this.validateReportTemplate(skeletonReport);
            }

            // 10. 최종 메타데이터 설정
            await this.finalizeMetadata(skeletonReport, startTime);

            logService.info('Report synthesis completed', {
                reportId: skeletonReport.reportMetadata.reportId,
                processingTime: skeletonReport.reportMetadata.processingTimeMs,
                qualityScore: skeletonReport.reportMetadata.qualityScore,
                itemCount: this.countReportItems(skeletonReport)
            });

            // Phase 4: 전처리 결과(parsedRecords) 추가
            if (analysisResults.parsedRecords) {
                skeletonReport.parsedRecords = analysisResults.parsedRecords;
            }

            return skeletonReport;

        } catch (error) {
            logService.error('Report synthesis failed', { error: error.message });
            throw new Error(`ReportSynthesizer failed: ${error.message}`);
        }
    }

    /**
     * 입력 데이터 검증
     */
    async validateInputData(analysisResults) {
        // entities만 필수 필드로 설정 (나머지는 선택적)
        if (!analysisResults.entities) {
            throw new Error('Missing required field: entities');
        }

        // 선택적 필드 누락 시 경고만 출력
        const optionalFields = ['timeline', 'confidenceScore', 'disclosureAnalysis'];
        for (const field of optionalFields) {
            if (!analysisResults[field]) {
                logService.warn(`Optional field missing: ${field}`, {
                    field,
                    willUseDefaults: true
                });
            }
        }

        // 최소 품질 요구사항 확인 (confidenceScore가 있는 경우에만)
        if (analysisResults.confidenceScore?.overallConfidenceScore !== undefined) {
            if (analysisResults.confidenceScore.overallConfidenceScore < this.options.qualityThreshold) {
                logService.warn('Low confidence score detected', {
                    score: analysisResults.confidenceScore.overallConfidenceScore,
                    threshold: this.options.qualityThreshold
                });
            }
        }
    }

    /**
     * 스켈레톤 보고서 초기화
     */
    initializeSkeletonReport(analysisResults) {
        const skeleton = JSON.parse(JSON.stringify(this.skeletonTemplate));

        // 기본 메타데이터 설정
        skeleton.reportMetadata.reportId = this.generateReportId();
        skeleton.reportMetadata.generatedAt = new Date().toISOString();

        // 환자 정보 설정 (가능한 경우)
        if (analysisResults.patientInfo) {
            skeleton.patientInfo = {
                ...skeleton.patientInfo,
                ...analysisResults.patientInfo
            };
        }

        return skeleton;
    }

    /**
     * 임상 요약 생성
     */
    async generateClinicalSummary(skeletonReport, analysisResults) {
        const entities = analysisResults.entities || [];

        // 진단 분류
        const diagnoses = entities.filter(entity => entity.type === 'diagnosis');
        skeletonReport.clinicalSummary.primaryDiagnoses = this.categorizeDiagnoses(diagnoses, 'primary');
        skeletonReport.clinicalSummary.secondaryDiagnoses = this.categorizeDiagnoses(diagnoses, 'secondary');

        // 시술 분류
        const procedures = entities.filter(entity => entity.type === 'procedure');
        skeletonReport.clinicalSummary.procedures = this.categorizeProcedures(procedures);

        // 약물 분류
        const medications = entities.filter(entity => entity.type === 'medication');
        skeletonReport.clinicalSummary.medications = this.categorizeMedications(medications);

        // 주요 소견 추출
        skeletonReport.clinicalSummary.keyFindings = await this.extractKeyFindings(analysisResults);
    }

    /**
     * 진단 분류
     */
    categorizeDiagnoses(diagnoses, category) {
        return diagnoses
            .filter(diagnosis => {
                if (category === 'primary') {
                    return (diagnosis.confidence || 0) >= 0.8 ||
                        (diagnosis.priority || 0) >= 8;
                } else {
                    return (diagnosis.confidence || 0) >= 0.6 &&
                        (diagnosis.priority || 0) < 8;
                }
            })
            .map(diagnosis => ({
                code: diagnosis.code || null,
                description: diagnosis.normalizedText || diagnosis.originalText,
                confidence: diagnosis.confidence || 0,
                dateIdentified: diagnosis.dateIdentified || null,
                severity: diagnosis.severity || null,
                status: diagnosis.status || 'active',
                evidence: diagnosis.evidence || [],
                sourceLocation: diagnosis.sourceLocation || null
            }))
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
            .slice(0, category === 'primary' ? 3 : 5); // 주진단 최대 3개, 부진단 최대 5개
    }

    /**
     * 시술 분류
     */
    categorizeProcedures(procedures) {
        return procedures
            .filter(procedure => (procedure.confidence || 0) >= 0.6)
            .map(procedure => ({
                code: procedure.code || null,
                description: procedure.normalizedText || procedure.originalText,
                confidence: procedure.confidence || 0,
                datePerformed: procedure.datePerformed || null,
                provider: procedure.provider || null,
                location: procedure.location || null,
                outcome: procedure.outcome || null,
                complications: procedure.complications || [],
                evidence: procedure.evidence || [],
                sourceLocation: procedure.sourceLocation || null
            }))
            .sort((a, b) => {
                // 날짜순 정렬 (최신순)
                const dateA = new Date(a.datePerformed || '1900-01-01');
                const dateB = new Date(b.datePerformed || '1900-01-01');
                return dateB - dateA;
            })
            .slice(0, 8); // 최대 8개 시술
    }

    /**
     * 약물 분류
     */
    categorizeMedications(medications) {
        return medications
            .filter(medication => (medication.confidence || 0) >= 0.6)
            .map(medication => ({
                name: medication.normalizedText || medication.originalText,
                genericName: medication.genericName || null,
                dosage: medication.dosage || null,
                frequency: medication.frequency || null,
                route: medication.route || null,
                startDate: medication.startDate || null,
                endDate: medication.endDate || null,
                indication: medication.indication || null,
                prescriber: medication.prescriber || null,
                confidence: medication.confidence || 0,
                evidence: medication.evidence || [],
                sourceLocation: medication.sourceLocation || null
            }))
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
            .slice(0, 10); // 최대 10개 약물
    }

    /**
     * 주요 소견 추출
     */
    async extractKeyFindings(analysisResults) {
        const keyFindings = [];

        // 룰 엔진 결과에서 중요한 소견 추출
        if (analysisResults.ruleResults) {
            analysisResults.ruleResults.forEach(ruleResult => {
                if (ruleResult.triggered && ruleResult.severity === 'high') {
                    keyFindings.push({
                        type: 'rule_finding',
                        description: ruleResult.description,
                        severity: ruleResult.severity,
                        confidence: ruleResult.confidence,
                        evidence: ruleResult.evidence,
                        recommendations: ruleResult.recommendations
                    });
                }
            });
        }

        // 고신뢰도 엔티티에서 중요한 소견 추출
        const entities = analysisResults.entities || [];
        const highConfidenceEntities = entities.filter(entity =>
            (entity.confidence || 0) >= 0.9 &&
            ['diagnosis', 'procedure', 'test_result'].includes(entity.type)
        );

        highConfidenceEntities.forEach(entity => {
            keyFindings.push({
                type: 'high_confidence_entity',
                description: entity.normalizedText || entity.originalText,
                entityType: entity.type,
                confidence: entity.confidence,
                context: entity.context,
                dateIdentified: entity.dateIdentified
            });
        });

        // 중복 제거 및 우선순위 정렬
        return this.deduplicateAndPrioritizeFindings(keyFindings).slice(0, 5);
    }

    /**
     * 타임라인 구성
     */
    async constructTimeline(skeletonReport, analysisResults) {
        const timeline = analysisResults.timeline;

        if (!timeline || !timeline.events) {
            skeletonReport.timeline.events = [];
            skeletonReport.timeline.keyDates = [];
            skeletonReport.timeline.episodeOfCare = [];
            return;
        }

        // 이벤트 정리 및 구조화
        skeletonReport.timeline.events = timeline.events
            .filter(event => event.confidence >= 0.6)
            .map(event => {
                const mappedEvent = {
                    date: event.date,
                    type: event.type,
                    description: event.description,
                    entities: event.entities || [],
                    confidence: event.confidence,
                    importance: event.importance || 'medium',
                    evidence: event.evidence || []
                };

                // Master Plan Phase 1.2: DisputeTag 포함 (optional)
                if (event.disputeTag) {
                    mappedEvent.disputeTag = event.disputeTag;
                }

                return mappedEvent;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 15); // 최대 15개 이벤트

        // 주요 날짜 추출
        skeletonReport.timeline.keyDates = this.extractKeyDates(timeline);

        // 진료 에피소드 구성
        skeletonReport.timeline.episodeOfCare = this.constructEpisodesOfCare(timeline);
    }


    /**
     * 주요 날짜 추출
     */
    extractKeyDates(timeline) {
        const keyDateTypes = ['admission', 'discharge', 'surgery', 'diagnosis', 'procedure'];
        const keyDates = [];

        if (timeline.events) {
            timeline.events.forEach(event => {
                if (keyDateTypes.includes(event.type) && event.confidence >= 0.7) {
                    keyDates.push({
                        date: event.date,
                        type: event.type,
                        description: event.description,
                        confidence: event.confidence
                    });
                }
            });
        }

        // 날짜순 정렬 및 중복 제거
        return keyDates
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .filter((date, index, array) =>
                index === 0 || date.date !== array[index - 1].date
            )
            .slice(0, 10);
    }

    /**
     * 진료 에피소드 구성
     */
    constructEpisodesOfCare(timeline) {
        const episodes = [];

        if (!timeline.events || timeline.events.length === 0) {
            return episodes;
        }

        // 입원-퇴원 쌍 찾기
        const admissions = timeline.events.filter(event => event.type === 'admission');
        const discharges = timeline.events.filter(event => event.type === 'discharge');

        admissions.forEach(admission => {
            const correspondingDischarge = discharges.find(discharge =>
                new Date(discharge.date) > new Date(admission.date) &&
                Math.abs(new Date(discharge.date) - new Date(admission.date)) < 30 * 24 * 60 * 60 * 1000 // 30일 이내
            );

            const episode = {
                type: 'inpatient',
                startDate: admission.date,
                endDate: correspondingDischarge ? correspondingDischarge.date : null,
                duration: correspondingDischarge ?
                    Math.ceil((new Date(correspondingDischarge.date) - new Date(admission.date)) / (24 * 60 * 60 * 1000)) : null,
                events: timeline.events.filter(event => {
                    const eventDate = new Date(event.date);
                    const startDate = new Date(admission.date);
                    const endDate = correspondingDischarge ? new Date(correspondingDischarge.date) : new Date();
                    return eventDate >= startDate && eventDate <= endDate;
                }),
                primaryDiagnosis: null, // 추후 설정
                procedures: [],
                medications: []
            };

            episodes.push(episode);
        });

        return episodes.slice(0, 5); // 최대 5개 에피소드
    }

    /**
     * 위험 평가 통합
     */
    async integrateRiskAssessment(skeletonReport, analysisResults) {
        const disclosureAnalysis = analysisResults.disclosureAnalysis;

        if (!disclosureAnalysis) {
            skeletonReport.riskAssessment = {
                disclosureItems: [],
                riskLevel: 'unknown',
                recommendations: []
            };
            return;
        }

        // 고지의무 항목 설정
        skeletonReport.riskAssessment.disclosureItems = (disclosureAnalysis.disclosureItems || [])
            .map(item => ({
                category: item.category,
                description: item.description,
                riskLevel: item.riskLevel,
                confidence: item.confidence,
                evidence: item.evidence || [],
                recommendations: item.recommendations || [],
                impactScore: item.impactScore || 0
            }))
            .sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0))
            .slice(0, 8); // 최대 8개 고지의무 항목

        // 전체 위험 수준 설정
        skeletonReport.riskAssessment.riskLevel = disclosureAnalysis.overallRiskLevel || 'medium';

        // 권고사항 설정
        skeletonReport.riskAssessment.recommendations = (disclosureAnalysis.recommendations || [])
            .slice(0, 5); // 최대 5개 권고사항
    }

    /**
     * 품질 메트릭 설정
     */
    async setQualityMetrics(skeletonReport, analysisResults) {
        const confidenceScore = analysisResults.confidenceScore;

        // confidenceScore가 없는 경우 기본값 사용
        if (!confidenceScore) {
            skeletonReport.qualityMetrics = {
                dataCompleteness: 0,
                confidenceScore: 0,
                uncertaintyLevel: 'unknown',
                validationResults: []
            };
            return;
        }

        skeletonReport.qualityMetrics = {
            dataCompleteness: confidenceScore.componentScores?.dataCompleteness?.score || 0,
            confidenceScore: confidenceScore.overallConfidenceScore || 0,
            uncertaintyLevel: confidenceScore.uncertaintyAnalysis?.uncertaintyLevel || 'unknown',
            validationResults: this.summarizeValidationResults(confidenceScore)
        };
    }

    /**
     * 검증 결과 요약
     */
    summarizeValidationResults(confidenceScore) {
        const validationResults = [];

        if (confidenceScore.componentScores) {
            Object.entries(confidenceScore.componentScores).forEach(([component, result]) => {
                validationResults.push({
                    component,
                    score: result.score,
                    status: result.score >= 0.7 ? 'passed' : result.score >= 0.5 ? 'warning' : 'failed'
                });
            });
        }

        return validationResults;
    }

    /**
     * 증거 기반 설정
     */
    async setEvidenceBase(skeletonReport, analysisResults) {
        skeletonReport.evidenceBase = {
            sourceDocuments: this.summarizeSourceDocuments(analysisResults.textSegments),
            extractedEntities: this.summarizeExtractedEntities(analysisResults.entities),
            supportingEvidence: this.compileSupportingEvidence(analysisResults)
        };
    }

    /**
     * 소스 문서 요약
     */
    summarizeSourceDocuments(textSegments) {
        if (!textSegments || textSegments.length === 0) {
            return [];
        }

        const documentSummary = {};

        textSegments.forEach(segment => {
            const section = segment.section || 'unknown';
            if (!documentSummary[section]) {
                documentSummary[section] = {
                    section,
                    segmentCount: 0,
                    totalLength: 0,
                    confidence: 0
                };
            }

            documentSummary[section].segmentCount++;
            documentSummary[section].totalLength += (segment.text || '').length;
            documentSummary[section].confidence += (segment.confidence || 0.5);
        });

        return Object.values(documentSummary).map(summary => ({
            ...summary,
            averageConfidence: summary.confidence / summary.segmentCount,
            averageLength: Math.round(summary.totalLength / summary.segmentCount)
        }));
    }

    /**
     * 추출된 엔티티 요약
     */
    summarizeExtractedEntities(entities) {
        if (!entities || entities.length === 0) {
            return {};
        }

        const entitySummary = {};

        entities.forEach(entity => {
            const type = entity.type || 'unknown';
            if (!entitySummary[type]) {
                entitySummary[type] = {
                    count: 0,
                    averageConfidence: 0,
                    highConfidenceCount: 0
                };
            }

            entitySummary[type].count++;
            entitySummary[type].averageConfidence += (entity.confidence || 0);
            if ((entity.confidence || 0) >= 0.8) {
                entitySummary[type].highConfidenceCount++;
            }
        });

        Object.keys(entitySummary).forEach(type => {
            entitySummary[type].averageConfidence /= entitySummary[type].count;
        });

        return entitySummary;
    }

    /**
     * 지원 증거 편집
     */
    compileSupportingEvidence(analysisResults) {
        const evidence = [];

        // 앵커 증거
        if (analysisResults.anchors) {
            const highConfidenceAnchors = analysisResults.anchors.filter(anchor =>
                (anchor.confidence || 0) >= 0.8
            );

            evidence.push({
                type: 'temporal_anchors',
                count: highConfidenceAnchors.length,
                description: `${highConfidenceAnchors.length}개의 고신뢰도 시간적 앵커 식별`
            });
        }

        // 룰 증거
        if (analysisResults.ruleResults) {
            const triggeredRules = analysisResults.ruleResults.filter(rule => rule.triggered);

            evidence.push({
                type: 'rule_triggers',
                count: triggeredRules.length,
                description: `${triggeredRules.length}개의 질병별 룰 트리거됨`
            });
        }

        // 교차 검증 증거
        if (analysisResults.confidenceScore?.componentScores?.crossValidation) {
            const crossValidationScore = analysisResults.confidenceScore.componentScores.crossValidation.score;

            evidence.push({
                type: 'cross_validation',
                score: crossValidationScore,
                description: `교차 검증 점수: ${(crossValidationScore * 100).toFixed(1)}%`
            });
        }

        return evidence;
    }

    /**
     * 보고서 내용 최적화
     */
    async optimizeReportContent(skeletonReport, analysisResults) {
        // 1. 중복 제거
        await this.removeDuplicateContent(skeletonReport);

        // 2. 우선순위 기반 필터링
        await this.prioritizeContent(skeletonReport);

        // 3. 품질 기반 필터링
        await this.filterByQuality(skeletonReport);

        // 4. 길이 제한 적용
        await this.applyLengthLimits(skeletonReport);
    }

    /**
     * 중복 내용 제거
     */
    async removeDuplicateContent(skeletonReport) {
        // 진단 중복 제거
        skeletonReport.clinicalSummary.primaryDiagnoses = this.removeDuplicateDiagnoses(
            skeletonReport.clinicalSummary.primaryDiagnoses
        );
        skeletonReport.clinicalSummary.secondaryDiagnoses = this.removeDuplicateDiagnoses(
            skeletonReport.clinicalSummary.secondaryDiagnoses
        );

        // 시술 중복 제거
        skeletonReport.clinicalSummary.procedures = this.removeDuplicateProcedures(
            skeletonReport.clinicalSummary.procedures
        );

        // 약물 중복 제거
        skeletonReport.clinicalSummary.medications = this.removeDuplicateMedications(
            skeletonReport.clinicalSummary.medications
        );
    }

    /**
     * 우선순위 기반 내용 정렬
     */
    async prioritizeContent(skeletonReport) {
        // 진단 우선순위 정렬
        skeletonReport.clinicalSummary.primaryDiagnoses.sort((a, b) =>
            (b.confidence || 0) - (a.confidence || 0)
        );

        // 시술 우선순위 정렬 (날짜 + 신뢰도)
        skeletonReport.clinicalSummary.procedures.sort((a, b) => {
            const dateA = new Date(a.datePerformed || '1900-01-01');
            const dateB = new Date(b.datePerformed || '1900-01-01');
            const dateDiff = dateB - dateA;

            if (Math.abs(dateDiff) < 24 * 60 * 60 * 1000) { // 같은 날이면 신뢰도로 정렬
                return (b.confidence || 0) - (a.confidence || 0);
            }
            return dateDiff;
        });

        // 고지의무 항목 우선순위 정렬
        skeletonReport.riskAssessment.disclosureItems.sort((a, b) =>
            (b.impactScore || 0) - (a.impactScore || 0)
        );
    }

    /**
     * 품질 기반 필터링
     */
    async filterByQuality(skeletonReport) {
        const minConfidence = 0.6;

        // 낮은 신뢰도 항목 필터링
        skeletonReport.clinicalSummary.primaryDiagnoses =
            skeletonReport.clinicalSummary.primaryDiagnoses.filter(item =>
                (item.confidence || 0) >= minConfidence
            );

        skeletonReport.clinicalSummary.procedures =
            skeletonReport.clinicalSummary.procedures.filter(item =>
                (item.confidence || 0) >= minConfidence
            );

        skeletonReport.clinicalSummary.medications =
            skeletonReport.clinicalSummary.medications.filter(item =>
                (item.confidence || 0) >= minConfidence
            );
    }

    /**
     * 길이 제한 적용
     */
    async applyLengthLimits(skeletonReport) {
        // 최대 항목 수 제한
        skeletonReport.clinicalSummary.primaryDiagnoses =
            skeletonReport.clinicalSummary.primaryDiagnoses.slice(0, 3);

        skeletonReport.clinicalSummary.secondaryDiagnoses =
            skeletonReport.clinicalSummary.secondaryDiagnoses.slice(0, 5);

        skeletonReport.clinicalSummary.procedures =
            skeletonReport.clinicalSummary.procedures.slice(0, 8);

        skeletonReport.clinicalSummary.medications =
            skeletonReport.clinicalSummary.medications.slice(0, 10);

        skeletonReport.clinicalSummary.keyFindings =
            skeletonReport.clinicalSummary.keyFindings.slice(0, 5);

        skeletonReport.riskAssessment.disclosureItems =
            skeletonReport.riskAssessment.disclosureItems.slice(0, 8);

        // 전체 보고서 항목 수 확인
        const totalItems = this.countReportItems(skeletonReport);
        if (totalItems > this.options.maxReportItems) {
            await this.reduceReportItems(skeletonReport, this.options.maxReportItems);
        }
    }

    /**
     * 템플릿 검증
     */
    async validateReportTemplate(skeletonReport) {
        const validationErrors = [];

        // 필수 필드 검증
        if (!skeletonReport.reportMetadata.reportId) {
            validationErrors.push('Missing reportId');
        }

        if (!skeletonReport.reportMetadata.generatedAt) {
            validationErrors.push('Missing generatedAt');
        }

        // 최소 내용 요구사항 검증
        const totalItems = this.countReportItems(skeletonReport);
        if (totalItems < this.options.minReportItems) {
            validationErrors.push(`Insufficient report items: ${totalItems} < ${this.options.minReportItems}`);
        }

        // 품질 요구사항 검증
        if (skeletonReport.qualityMetrics.confidenceScore < this.options.qualityThreshold) {
            validationErrors.push(`Low confidence score: ${skeletonReport.qualityMetrics.confidenceScore}`);
        }

        if (validationErrors.length > 0) {
            logService.warn('Report template validation warnings', { errors: validationErrors });
        }

        return validationErrors;
    }

    /**
     * Investigator View 생성 (Phase 2)
     */
    async buildInvestigatorView(skeletonReport, analysisResults) {
        try {
            const timelineEvents = skeletonReport.timeline.events || [];
            const claimSpec = analysisResults.claimSpec || null;
            const contractInfo = analysisResults.contractInfo || null;

            // 1. 청구 요약 생성
            skeletonReport.investigatorView.claimSummary = {
                claimId: claimSpec?.claimId || null,
                claimDate: claimSpec?.claimDate || null,
                claimType: claimSpec?.claimType || null,
                claimDiagnoses: claimSpec?.claimDiagnosisCodes || [],
                insurer: contractInfo?.insurer || null,
                productName: contractInfo?.productName || null,
                issueDate: contractInfo?.issueDate || null
            };

            // 2. Episode 구성
            const episodeBuilder = new EpisodeBuilder();
            const episodes = episodeBuilder.groupEventsToEpisodes(timelineEvents);

            // 3. 중요도 기준 정렬
            const sortedEpisodes = episodes.sort((a, b) =>
                (b.disputeTag?.importanceScore || 0) - (a.disputeTag?.importanceScore || 0)
            );

            // 4. 상위 Episode 추출 (Top 5)
            skeletonReport.investigatorView.keyEpisodes = sortedEpisodes.slice(0, 5).map(ep => ({
                episodeId: ep.episodeId,
                dateRange: ep.dateRange,
                mainHospital: ep.mainHospital,
                mainDiagnosis: ep.mainDiagnosis,
                disputeTag: ep.disputeTag,
                summaryText: episodeBuilder.buildEpisodeSummaryText(ep)
            }));

            // 5. 전체 Episode 목록
            skeletonReport.investigatorView.allEpisodes = sortedEpisodes.map(ep => ({
                episodeId: ep.episodeId,
                rawEvents: ep.events,
                disputeTag: ep.disputeTag,
                summaryText: episodeBuilder.buildEpisodeSummaryText(ep),
                evidenceLinks: [] // 추후 EvidenceBinder 연동
            }));

            // 6. 조사자 힌트 생성
            skeletonReport.investigatorView.generationHints = [
                '상위 중요도 에피소드를 우선적으로 검토하세요.',
                'PRE_CONTRACT 기간의 고지의무 위반 가능성을 확인하세요.',
                '청구 상병과 인과관계가 있는 에피소드를 확인하세요.'
            ];

        } catch (error) {
            logService.warn('Failed to build Investigator View', { error: error.message });
            // 실패해도 전체 보고서 생성은 계속 진행
        }
    }

    /**
     * 최종 메타데이터 설정
     */
    async finalizeMetadata(skeletonReport, startTime) {
        skeletonReport.reportMetadata.processingTimeMs = Date.now() - startTime;
        skeletonReport.reportMetadata.qualityScore = skeletonReport.qualityMetrics.confidenceScore;
        skeletonReport.reportMetadata.confidenceLevel = this.determineConfidenceLevel(
            skeletonReport.qualityMetrics.confidenceScore
        );

        // 보고서 통계
        skeletonReport.reportMetadata.statistics = {
            totalItems: this.countReportItems(skeletonReport),
            primaryDiagnoses: skeletonReport.clinicalSummary.primaryDiagnoses.length,
            procedures: skeletonReport.clinicalSummary.procedures.length,
            medications: skeletonReport.clinicalSummary.medications.length,
            timelineEvents: skeletonReport.timeline.events.length,
            disclosureItems: skeletonReport.riskAssessment.disclosureItems.length
        };
    }

    /**
     * 유틸리티 메서드들
     */
    generateReportId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `RPT_${timestamp}_${random}`;
    }

    countReportItems(skeletonReport) {
        return (
            skeletonReport.clinicalSummary.primaryDiagnoses.length +
            skeletonReport.clinicalSummary.secondaryDiagnoses.length +
            skeletonReport.clinicalSummary.procedures.length +
            skeletonReport.clinicalSummary.medications.length +
            skeletonReport.clinicalSummary.keyFindings.length +
            skeletonReport.timeline.events.length +
            skeletonReport.riskAssessment.disclosureItems.length
        );
    }

    determineConfidenceLevel(score) {
        if (score >= 0.85) return 'very_high';
        if (score >= 0.7) return 'high';
        if (score >= 0.5) return 'medium';
        if (score >= 0.3) return 'low';
        return 'very_low';
    }

    deduplicateAndPrioritizeFindings(findings) {
        // 중복 제거 (설명 기준)
        const uniqueFindings = findings.filter((finding, index, array) =>
            index === array.findIndex(f => f.description === finding.description)
        );

        // 우선순위 정렬 (신뢰도 + 타입)
        return uniqueFindings.sort((a, b) => {
            const priorityA = this.getFindingPriority(a);
            const priorityB = this.getFindingPriority(b);

            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }

            return (b.confidence || 0) - (a.confidence || 0);
        });
    }

    getFindingPriority(finding) {
        const priorities = {
            'rule_finding': 10,
            'high_confidence_entity': 8,
            'temporal_finding': 6,
            'contextual_finding': 4
        };

        return priorities[finding.type] || 1;
    }

    removeDuplicateDiagnoses(diagnoses) {
        const seen = new Set();
        return diagnoses.filter(diagnosis => {
            const key = (diagnosis.code || diagnosis.description).toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    removeDuplicateProcedures(procedures) {
        const seen = new Set();
        return procedures.filter(procedure => {
            const key = `${procedure.code || procedure.description}_${procedure.datePerformed}`.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    removeDuplicateMedications(medications) {
        const seen = new Set();
        return medications.filter(medication => {
            const key = (medication.name || medication.genericName).toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async reduceReportItems(skeletonReport, maxItems) {
        const currentItems = this.countReportItems(skeletonReport);
        const reductionNeeded = currentItems - maxItems;

        if (reductionNeeded <= 0) return;

        // 우선순위가 낮은 항목부터 제거
        const reductionPlan = [
            { section: 'secondaryDiagnoses', maxReduce: Math.min(2, reductionNeeded) },
            { section: 'medications', maxReduce: Math.min(3, reductionNeeded) },
            { section: 'timelineEvents', maxReduce: Math.min(3, reductionNeeded) },
            { section: 'keyFindings', maxReduce: Math.min(2, reductionNeeded) }
        ];

        let totalReduced = 0;

        for (const plan of reductionPlan) {
            if (totalReduced >= reductionNeeded) break;

            const actualReduce = Math.min(plan.maxReduce, reductionNeeded - totalReduced);

            if (plan.section === 'secondaryDiagnoses') {
                skeletonReport.clinicalSummary.secondaryDiagnoses =
                    skeletonReport.clinicalSummary.secondaryDiagnoses.slice(0, -actualReduce);
            } else if (plan.section === 'medications') {
                skeletonReport.clinicalSummary.medications =
                    skeletonReport.clinicalSummary.medications.slice(0, -actualReduce);
            } else if (plan.section === 'timelineEvents') {
                skeletonReport.timeline.events =
                    skeletonReport.timeline.events.slice(0, -actualReduce);
            } else if (plan.section === 'keyFindings') {
                skeletonReport.clinicalSummary.keyFindings =
                    skeletonReport.clinicalSummary.keyFindings.slice(0, -actualReduce);
            }

            totalReduced += actualReduce;
        }
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        return {
            status: 'healthy',
            component: 'ReportSynthesizer',
            timestamp: new Date().toISOString(),
            configuration: {
                enableTemplateValidation: this.options.enableTemplateValidation,
                enableContentOptimization: this.options.enableContentOptimization,
                maxReportItems: this.options.maxReportItems,
                minReportItems: this.options.minReportItems,
                qualityThreshold: this.options.qualityThreshold
            },
            template: {
                skeletonStructure: Object.keys(this.skeletonTemplate),
                itemPriorities: this.itemPriorities
            }
        };
    }

    /**
     * 보고서 미리보기 생성
     */
    async generateReportPreview(skeletonReport) {
        return {
            reportId: skeletonReport.reportMetadata.reportId,
            generatedAt: skeletonReport.reportMetadata.generatedAt,
            qualityScore: skeletonReport.reportMetadata.qualityScore,
            confidenceLevel: skeletonReport.reportMetadata.confidenceLevel,
            statistics: skeletonReport.reportMetadata.statistics,
            summary: {
                primaryDiagnoses: skeletonReport.clinicalSummary.primaryDiagnoses.length,
                procedures: skeletonReport.clinicalSummary.procedures.length,
                medications: skeletonReport.clinicalSummary.medications.length,
                timelineEvents: skeletonReport.timeline.events.length,
                disclosureItems: skeletonReport.riskAssessment.disclosureItems.length,
                riskLevel: skeletonReport.riskAssessment.riskLevel
            }
        };
    }

    /**
     * Investigator View 생성
     * 타임라인 데이터를 사용하여 에피소드를 구성하고 Investigator View 구조를 채웁니다.
     */
    async buildInvestigatorView(skeletonReport, analysisResults) {
        try {
            const episodeBuilder = new EpisodeBuilder();

            // 1. 타임라인 이벤트 가져오기 (TimelineAssembler는 events를 최상위에 반환)
            const timelineEvents = analysisResults.events || [];

            // Phase 5: 타임라인 이벤트의 엔티티 필터링 및 포맷팅
            const filteredEvents = timelineEvents.map(event => {
                if (!event.entities || !Array.isArray(event.entities)) {
                    return event;
                }

                // 엔티티 필터링
                const filteredEntities = this.formatter.filterEntities(event.entities);

                // 진단 엔티티 포맷팅
                const formattedEntities = filteredEntities.map(entity => {
                    if (entity.type === 'diagnosis') {
                        return {
                            ...entity,
                            formattedText: this.formatter.formatDiagnosis(entity),
                            normalizedText: this.formatter.formatDiagnosis(entity)
                        };
                    }
                    return entity;
                });

                return {
                    ...event,
                    entities: formattedEntities
                };
            });

            // 2. 이벤트를 에피소드로 그룹화
            const episodes = episodeBuilder.groupEventsToEpisodes(filteredEvents);

            // Phase 5 + Phase 6: 에피소드 서술 개선
            const enhancedEpisodes = episodes.map(ep => {
                // 진단 엔티티 추출 및 포맷팅 (Phase 6: 강제 포맷팅 적용)
                const diagnoses = ep.events
                    .flatMap(event => event.entities || [])
                    .filter(e => e.type === 'diagnosis')
                    .map(e => {
                        // Phase 6: 이미 포맷팅된 텍스트가 있으면 우선 사용
                        if (e.formattedText) {
                            return e.formattedText;
                        }
                        // Phase 6: formatDiagnosisStrict 사용하여 강제 포맷팅
                        const formatted = this.formatter.formatDiagnosisStrict(e);
                        return formatted || e.normalizedText;
                    })
                    .filter((v, i, a) => a.indexOf(v) === i) // 중복 제거
                    .slice(0, 3); // 최대 3개

                // Phase 6: 상세 정보 추출 (내용 풍부화)
                const procedures = ep.events
                    .flatMap(event => event.entities || [])
                    .filter(e => e.type === 'procedure')
                    .map(e => e.normalizedText)
                    .filter((v, i, a) => a.indexOf(v) === i);

                const tests = ep.events
                    .flatMap(event => event.entities || [])
                    .filter(e => e.type === 'test')
                    .map(e => e.normalizedText)
                    .filter((v, i, a) => a.indexOf(v) === i);

                // Phase 6: 항목 구분 기호(●) 적용한 상세 서술
                const diagnosisText = diagnoses.length > 0 ? diagnoses.join(', ') : ep.mainDiagnosis;

                let summary = `[${ep.dateRange}] ${diagnosisText}`;

                // 추가 정보가 있으면 포함 (Phase 6: 내용 풍부화)
                const additionalInfo = [];
                if (procedures.length > 0) {
                    additionalInfo.push(`시술: ${procedures.join(', ')}`);
                }
                if (tests.length > 0) {
                    additionalInfo.push(`검사: ${tests.join(', ')}`);
                }

                if (additionalInfo.length > 0) {
                    summary += '\n' + additionalInfo.map(info => `  ● ${info}`).join('\n');
                }

                return {
                    ...ep,
                    summary,
                    mainDiagnosis: diagnoses[0] || ep.mainDiagnosis,
                    procedures,  // Phase 6: 상세 정보 보존
                    tests        // Phase 6: 상세 정보 보존
                };
            });

            // 3. Investigator View 구조 채우기
            skeletonReport.investigatorView = {
                claimInfo: this.generateClaimSummary(analysisResults), // claimSummary -> claimInfo 변경
                disputeInfo: { // disputeInfo 추가
                    score: analysisResults.confidenceScore?.overallScore || 0,
                    phase: 'analysis',
                    role: 'investigator'
                },
                keyEpisodes: this.selectKeyEpisodes(enhancedEpisodes),
                episodes: enhancedEpisodes.map(ep => ({
                    episodeId: ep.episodeId,
                    dateRange: ep.dateRange,
                    startDate: ep.startDate,
                    endDate: ep.endDate,
                    mainDiagnosis: ep.mainDiagnosis,
                    mainHospital: ep.mainHospital,
                    eventCount: ep.eventCount,
                    summary: ep.summary,
                    events: ep.events
                })),
                timeline: filteredEvents,
                generationHints: this.generateInvestigatorHints(analysisResults, enhancedEpisodes)
            };

            logService.info('Investigator View generated', {
                episodeCount: enhancedEpisodes.length,
                keyEpisodeCount: skeletonReport.investigatorView.keyEpisodes.length
            });

        } catch (error) {
            logService.error('Failed to build Investigator View', { error: error.message });
            // Fallback: 빈 구조 유지
            skeletonReport.investigatorView = {
                claimSummary: null,
                keyEpisodes: [],
                allEpisodes: [],
                generationHints: ['Investigator View 생성 실패: ' + error.message]
            };
        }
    }

    /**
     * 청구 요약 생성
     */
    generateClaimSummary(analysisResults) {
        const entities = analysisResults.entities || [];
        const diagnoses = entities.filter(e => e.type === 'diagnosis');
        const procedures = entities.filter(e => e.type === 'procedure');

        return {
            totalDiagnoses: diagnoses.length,
            totalProcedures: procedures.length,
            primaryDiagnosis: diagnoses.length > 0 ? diagnoses[0].normalizedText || diagnoses[0].originalText : null,
            analysisDate: new Date().toISOString()
        };
    }

    /**
     * 주요 에피소드 선택 (최대 5개)
     */
    selectKeyEpisodes(episodes) {
        if (!episodes || episodes.length === 0) return [];

        // 이벤트 수가 많은 순으로 정렬하여 상위 5개 선택
        return episodes
            .sort((a, b) => (b.eventCount || 0) - (a.eventCount || 0))
            .slice(0, 5)
            .map(ep => ({
                episodeId: ep.episodeId,
                dateRange: ep.dateRange,
                mainDiagnosis: ep.mainDiagnosis,
                eventCount: ep.eventCount
            }));
    }

    /**
     * Investigator 힌트 생성
     */
    generateInvestigatorHints(analysisResults, episodes) {
        const hints = [];

        if (episodes.length === 0) {
            hints.push('타임라인 이벤트가 없어 에피소드를 생성할 수 없습니다.');
        }

        if (analysisResults.confidenceScore?.overallConfidenceScore < 0.6) {
            hints.push('전체 신뢰도가 낮습니다. 추가 검토가 필요할 수 있습니다.');
        }

        const entities = analysisResults.entities || [];
        if (entities.length < 5) {
            hints.push('추출된 엔티티가 적습니다. 원본 문서를 확인하세요.');
        }

        return hints;
    }
}