// PipelineStateMachine.js - 코어 엔진 파이프라인 상태 머신
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../utils/logger.js';

// 컴포넌트 임포트
import TextIngestor from './TextIngestor.js';
import AnchorDetector from './AnchorDetector.js';
import EntityNormalizer from './EntityNormalizer.js';
import TimelineAssembler from './TimelineAssembler.js';
import DiseaseRuleEngine from './DiseaseRuleEngine.js';
import DisclosureAnalyzer from './DisclosureAnalyzer.js';
import ConfidenceScorer from './ConfidenceScorer.js';
import ReportSynthesizer from './ReportSynthesizer.js';
import EvidenceBinder from './EvidenceBinder.js';

export default class PipelineStateMachine {
    constructor(options = {}) {
        this.options = {
            qualityGate: options.qualityGate || 'standard', // draft, standard, rigorous
            maxRetries: options.maxRetries || 2,
            timeoutMs: options.timeoutMs || 300000, // 5분 (기본값)
            enableCaching: options.enableCaching !== false,
            enableFallback: options.enableFallback !== false,
            enableDetailedLogging: options.enableDetailedLogging || false,
            enableDynamicTimeout: options.enableDynamicTimeout !== false,
            ...options
        };

        // 동적 타임아웃 설정
        this.timeoutConfig = {
            baseTimeout: this.options.timeoutMs,
            minTimeout: 30000, // 30초
            maxTimeout: 600000, // 10분
            complexityMultiplier: 1.5,
            loadMultiplier: 1.3,
            retryMultiplier: 0.8
        };

        // 처리 복잡도 가중치
        this.complexityWeights = {
            textLength: 0.3,
            entityCount: 0.2,
            timelineEvents: 0.2,
            ruleComplexity: 0.15,
            evidenceCount: 0.15
        };

        // 파이프라인 상태 정의
        this.states = {
            INIT: 'INIT',
            INGEST: 'INGEST',
            ANCHOR: 'ANCHOR',
            NORMALIZE: 'NORMALIZE',
            TIMELINE: 'TIMELINE',
            RULES: 'RULES',
            DISCLOSURE: 'DISCLOSURE',
            SCORE: 'SCORE',
            EVIDENCE: 'EVIDENCE',
            SYNTHESIZE: 'SYNTHESIZE',
            OUTPUT: 'OUTPUT',
            ERROR: 'ERROR',
            COMPLETE: 'COMPLETE'
        };

        // 품질 게이트 설정
        this.qualityGates = {
            draft: {
                minConfidence: 0.3,
                maxProcessingTime: 60000, // 1분
                requiredComponents: ['INGEST', 'ANCHOR', 'NORMALIZE', 'SYNTHESIZE'],
                skipOptionalSteps: true
            },
            standard: {
                minConfidence: 0.6,
                maxProcessingTime: 180000, // 3분
                requiredComponents: ['INGEST', 'ANCHOR', 'NORMALIZE', 'TIMELINE', 'RULES', 'SCORE', 'SYNTHESIZE'],
                skipOptionalSteps: false
            },
            rigorous: {
                minConfidence: 0.8,
                maxProcessingTime: 300000, // 5분
                requiredComponents: ['INGEST', 'ANCHOR', 'NORMALIZE', 'TIMELINE', 'RULES', 'DISCLOSURE', 'SCORE', 'EVIDENCE', 'SYNTHESIZE'],
                skipOptionalSteps: false
            }
        };

        // 컴포넌트 초기화
        // TextIngestor와 AnchorDetector는 static 메서드만 제공하므로 클래스 참조만 저장
        this.components = {
            textIngestor: TextIngestor,
            anchorDetector: AnchorDetector,
            entityNormalizer: new EntityNormalizer(options.entityNormalizer),
            timelineAssembler: new TimelineAssembler(options.timelineAssembler),
            diseaseRuleEngine: new DiseaseRuleEngine(options.diseaseRuleEngine),
            disclosureAnalyzer: new DisclosureAnalyzer(options.disclosureAnalyzer),
            confidenceScorer: new ConfidenceScorer(options.confidenceScorer),
            reportSynthesizer: new ReportSynthesizer(options.reportSynthesizer),
            evidenceBinder: new EvidenceBinder(options.evidenceBinder)
        };

        // 상태 전환 맵
        this.stateTransitions = {
            INIT: 'INGEST',
            INGEST: 'ANCHOR',
            ANCHOR: 'NORMALIZE',
            NORMALIZE: 'TIMELINE',
            TIMELINE: 'RULES',
            RULES: 'DISCLOSURE',
            DISCLOSURE: 'SCORE',
            SCORE: 'EVIDENCE',
            EVIDENCE: 'SYNTHESIZE',
            SYNTHESIZE: 'OUTPUT',
            OUTPUT: 'COMPLETE'
        };

        // 실행 컨텍스트 초기화
        this.resetExecutionContext();

        logService.info('PipelineStateMachine initialized', {
            qualityGate: this.options.qualityGate,
            components: Object.keys(this.components).length
        });
    }

    /**
     * 실행 컨텍스트 초기화
     */
    resetExecutionContext() {
        this.executionContext = {
            currentState: this.states.INIT,
            startTime: null,
            endTime: null,
            processingTimeMs: 0,
            retryCount: 0,
            errors: [],
            stateHistory: [],
            qualityMetrics: {},
            intermediateResults: {},
            finalResult: null,
            cacheKey: null,
            fallbackUsed: false
        };
    }

    /**
     * 메인 파이프라인 실행 함수
     * @param {Object} input - 입력 데이터 (텍스트, 설정 등)
     * @returns {Object} 처리된 결과
     */
    async execute(input) {
        try {
            this.resetExecutionContext();
            this.executionContext.startTime = Date.now();

            // 1. 입력 검증
            await this.validateInput(input);

            // 2. 캐시 확인
            if (this.options.enableCaching) {
                const cachedResult = await this.checkCache(input);
                if (cachedResult) {
                    logService.info('Cache hit - returning cached result');
                    return cachedResult;
                }
            }

            // 3. 품질 게이트 설정 적용
            const qualityGateConfig = this.qualityGates[this.options.qualityGate];

            // 4. 파이프라인 실행
            const result = await this.runPipeline(input, qualityGateConfig);

            // 5. 품질 검증
            await this.validateQuality(result, qualityGateConfig);

            // 6. 캐시 저장
            if (this.options.enableCaching && result) {
                await this.saveToCache(input, result);
            }

            // 7. 실행 컨텍스트 완료
            this.executionContext.endTime = Date.now();
            this.executionContext.processingTimeMs = this.executionContext.endTime - this.executionContext.startTime;
            this.executionContext.finalResult = result;
            this.executionContext.currentState = this.states.COMPLETE;

            logService.info('Pipeline execution completed successfully', {
                processingTime: this.executionContext.processingTimeMs,
                qualityGate: this.options.qualityGate,
                statesExecuted: this.executionContext.stateHistory.length,
                retryCount: this.executionContext.retryCount
            });

            return {
                ...result,
                executionMetadata: {
                    processingTimeMs: this.executionContext.processingTimeMs,
                    qualityGate: this.options.qualityGate,
                    stateHistory: this.executionContext.stateHistory,
                    retryCount: this.executionContext.retryCount,
                    cacheUsed: false,
                    fallbackUsed: this.executionContext.fallbackUsed,
                    qualityMetrics: this.executionContext.qualityMetrics
                }
            };

        } catch (error) {
            logService.error('Pipeline execution failed', {
                error: error.message,
                currentState: this.executionContext.currentState,
                processingTime: Date.now() - (this.executionContext.startTime || Date.now())
            });

            // 폴백 처리
            if (this.options.enableFallback && !this.executionContext.fallbackUsed) {
                return await this.handleFallback(input, error);
            }

            throw error;
        }
    }

    /**
     * 파이프라인 실행
     */
    async runPipeline(input, qualityGateConfig, retryCount = 0) {
        let currentData = { ...input };
        const requiredComponents = qualityGateConfig.requiredComponents;

        // 동적 타임아웃 계산
        const dynamicTimeout = this.calculateDynamicTimeout(input, qualityGateConfig, retryCount);

        if (this.options.enableDetailedLogging) {
            logService.info('Pipeline timeout calculated', {
                originalTimeout: qualityGateConfig.maxProcessingTime,
                dynamicTimeout,
                retryCount,
                complexityFactors: this.calculateProcessingComplexity(input)
            });
        }

        // 타임아웃 설정
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Pipeline execution timeout (${dynamicTimeout}ms)`)),
                dynamicTimeout);
        });

        const pipelinePromise = this.executePipelineSteps(currentData, requiredComponents);

        return await Promise.race([pipelinePromise, timeoutPromise]);
    }

    /**
     * 파이프라인 단계별 실행 (최적화된 버전)
     */
    async executePipelineSteps(currentData, requiredComponents) {
        // 병렬 처리 가능한 단계들을 그룹화
        const parallelGroups = this.getParallelExecutionGroups(requiredComponents);

        let processedData = currentData;

        for (const group of parallelGroups) {
            if (group.length === 1) {
                // 단일 단계 실행
                processedData = await this.executeState(group[0], processedData);
            } else {
                // 병렬 실행 가능한 단계들
                processedData = await this.executeParallelStates(group, processedData);
            }

            // 메모리 최적화 - 각 그룹 완료 후 중간 정리
            if (global.gc && process.memoryUsage().heapUsed > 100 * 1024 * 1024) { // 100MB 초과시
                global.gc();
            }
        }

        return processedData;
    }

    /**
     * 병렬 실행 그룹 생성
     */
    getParallelExecutionGroups(requiredComponents) {
        const groups = [];

        // 순차 실행이 필요한 단계들
        const sequentialStages = ['INGEST', 'ANCHOR', 'NORMALIZE'];
        const analysisStages = ['TIMELINE', 'RULES', 'DISCLOSURE']; // 병렬 처리 가능
        const finalStages = ['SCORE', 'EVIDENCE', 'SYNTHESIZE'];

        // 순차 단계들 추가
        sequentialStages.forEach(stage => {
            if (requiredComponents.includes(stage)) {
                groups.push([stage]);
            }
        });

        // 분석 단계들을 병렬 그룹으로 추가
        const parallelAnalysis = analysisStages.filter(stage => requiredComponents.includes(stage));
        if (parallelAnalysis.length > 0) {
            groups.push(parallelAnalysis);
        }

        // 최종 단계들 추가
        finalStages.forEach(stage => {
            if (requiredComponents.includes(stage)) {
                groups.push([stage]);
            }
        });

        return groups;
    }

    /**
     * 병렬 상태 실행
     */
    async executeParallelStates(states, inputData) {
        const promises = states.map(state => this.executeState(state, inputData));
        const results = await Promise.allSettled(promises);

        // 결과 병합 및 에러 처리
        let mergedData = { ...inputData };
        const errors = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                // 성공한 결과를 병합
                mergedData = { ...mergedData, ...result.value };
            } else {
                errors.push({
                    state: states[index],
                    error: result.reason.message
                });
            }
        });

        // 일부 실패가 있어도 계속 진행 (품질 게이트에서 최종 판단)
        if (errors.length > 0) {
            logService.warn('Some parallel states failed', { errors });
            this.executionContext.errors.push(...errors);
        }

        return mergedData;
    }

    /**
     * 개별 상태 실행
     */
    async executeState(stateName, inputData) {
        const stateStartTime = Date.now();
        this.executionContext.currentState = stateName;

        try {
            let result;

            switch (stateName) {
                case 'INGEST':
                    // TextIngestor.process는 static 메서드
                    const textSegments = await this.components.textIngestor.process(inputData.text || inputData.textSegments);
                    result = { ...inputData, textSegments };
                    break;

                case 'ANCHOR':
                    // AnchorDetector.detect는 static 메서드
                    const anchors = await this.components.anchorDetector.detect(inputData.textSegments || []);
                    result = { ...inputData, anchors };
                    break;

                case 'NORMALIZE':
                    // EntityNormalizer.normalize는 instance 메서드
                    const normalized = await this.components.entityNormalizer.normalize(
                        inputData.textSegments || [],
                        inputData.anchors || []
                    );
                    result = { ...inputData, entities: normalized.entities, ...normalized };
                    break;

                case 'TIMELINE':
                    const timelineResult = await this.components.timelineAssembler.assemble(
                        inputData.anchors || [],
                        inputData.entities || []
                    );
                    result = { ...inputData, timeline: timelineResult.timeline, ...timelineResult };
                    break;

                case 'RULES':
                    const ruleResult = await this.components.diseaseRuleEngine.executeRules(
                        inputData.timeline || [],
                        inputData.entities || []
                    );
                    result = { ...inputData, ruleResults: ruleResult.ruleResults, ...ruleResult };
                    break;

                case 'DISCLOSURE':
                    const disclosureResult = await this.components.disclosureAnalyzer.analyzeDisclosure(
                        inputData.ruleResults || [],
                        inputData.entities || [],
                        inputData.timeline || [],
                        inputData.contractInfo,
                        inputData.claimSpec
                    );
                    result = { ...inputData, disclosureAnalysis: disclosureResult };
                    break;

                case 'SCORE':
                    const scoreResult = await this.components.confidenceScorer.calculateConfidenceScore(inputData);
                    result = { ...inputData, confidenceScore: scoreResult };
                    break;

                case 'EVIDENCE':
                    result = await this.components.evidenceBinder.bindEvidence(inputData);
                    break;

                case 'SYNTHESIZE':
                    result = await this.components.reportSynthesizer.synthesizeReport(inputData);
                    break;

                default:
                    throw new Error(`Unknown state: ${stateName}`);
            }

            // 상태 실행 기록
            const stateExecutionTime = Date.now() - stateStartTime;
            this.executionContext.stateHistory.push({
                state: stateName,
                executionTimeMs: stateExecutionTime,
                success: true,
                timestamp: new Date().toISOString()
            });

            // 중간 결과 저장
            this.executionContext.intermediateResults[stateName] = {
                executionTime: stateExecutionTime,
                dataSize: this.calculateDataSize(result),
                timestamp: new Date().toISOString()
            };

            if (this.options.enableDetailedLogging) {
                logService.debug(`State ${stateName} completed`, {
                    executionTime: stateExecutionTime,
                    dataSize: this.calculateDataSize(result)
                });
            }

            return result;

        } catch (error) {
            const stateExecutionTime = Date.now() - stateStartTime;

            // 에러 기록
            this.executionContext.stateHistory.push({
                state: stateName,
                executionTimeMs: stateExecutionTime,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            this.executionContext.errors.push({
                state: stateName,
                error: error.message,
                timestamp: new Date().toISOString()
            });

            logService.error(`State ${stateName} failed`, {
                error: error.message,
                executionTime: stateExecutionTime
            });

            // 재시도 로직
            if (this.executionContext.retryCount < this.options.maxRetries) {
                this.executionContext.retryCount++;
                logService.info(`Retrying state ${stateName} (attempt ${this.executionContext.retryCount})`);
                return await this.executeState(stateName, inputData);
            }

            throw error;
        }
    }

    /**
     * 입력 검증
     */
    async validateInput(input) {
        if (!input) {
            throw new Error('Input data is required');
        }

        if (!input.text && !input.textSegments) {
            throw new Error('Text or textSegments is required');
        }

        if (input.text && typeof input.text !== 'string') {
            throw new Error('Text must be a string');
        }

        if (input.textSegments && !Array.isArray(input.textSegments)) {
            throw new Error('TextSegments must be an array');
        }

        // 텍스트 길이 제한 확인
        const textLength = input.text ? input.text.length :
            input.textSegments.reduce((sum, segment) => sum + (segment.text || '').length, 0);

        if (textLength > 100000) { // 100KB 제한
            throw new Error('Input text is too large (max 100KB)');
        }

        if (textLength === 0) {
            throw new Error('Input text is empty');
        }
    }

    /**
     * 품질 검증
     */
    async validateQuality(result, qualityGateConfig) {
        const qualityMetrics = {
            overallConfidence: 0,
            reportItemCount: 0,
            processingTime: this.executionContext.processingTimeMs,
            qualityGatePassed: false
        };

        // 전체 신뢰도 계산
        if (result.entities && result.entities.length > 0) {
            const totalConfidence = result.entities.reduce((sum, entity) =>
                sum + (entity.confidence || 0), 0
            );
            qualityMetrics.overallConfidence = totalConfidence / result.entities.length;
        }

        // 보고서 항목 수 계산
        if (result.skeletonJson && result.skeletonJson.reportItems) {
            qualityMetrics.reportItemCount = result.skeletonJson.reportItems.length;
        }

        // 품질 게이트 검증
        const minConfidenceMet = qualityMetrics.overallConfidence >= qualityGateConfig.minConfidence;
        const maxTimeMet = qualityMetrics.processingTime <= qualityGateConfig.maxProcessingTime;
        const minItemsMet = qualityMetrics.reportItemCount >= 1; // 최소 1개 항목

        qualityMetrics.qualityGatePassed = minConfidenceMet && maxTimeMet && minItemsMet;

        // 품질 메트릭 저장
        this.executionContext.qualityMetrics = qualityMetrics;

        if (!qualityMetrics.qualityGatePassed) {
            const issues = [];
            if (!minConfidenceMet) issues.push(`신뢰도 부족 (${qualityMetrics.overallConfidence.toFixed(2)} < ${qualityGateConfig.minConfidence})`);
            if (!maxTimeMet) issues.push(`처리 시간 초과 (${qualityMetrics.processingTime}ms > ${qualityGateConfig.maxProcessingTime}ms)`);
            if (!minItemsMet) issues.push(`보고서 항목 부족 (${qualityMetrics.reportItemCount} < 1)`);

            logService.warn('Quality gate validation failed', {
                qualityGate: this.options.qualityGate,
                issues,
                metrics: qualityMetrics
            });

            // 엄격한 품질 게이트에서만 실패 처리
            if (this.options.qualityGate === 'rigorous') {
                throw new Error(`Quality gate failed: ${issues.join(', ')}`);
            }
        }

        logService.info('Quality validation completed', {
            qualityGate: this.options.qualityGate,
            passed: qualityMetrics.qualityGatePassed,
            metrics: qualityMetrics
        });
    }

    /**
     * 캐시 확인
     */
    async checkCache(input) {
        try {
            // 캐시 키 생성
            this.executionContext.cacheKey = this.generateCacheKey(input);

            // 실제 캐시 구현은 별도 캐시 서비스에서 처리
            // 여기서는 인터페이스만 정의
            return null; // 캐시 미스

        } catch (error) {
            logService.warn('Cache check failed', { error: error.message });
            return null;
        }
    }

    /**
     * 캐시 저장
     */
    async saveToCache(input, result) {
        try {
            if (!this.executionContext.cacheKey) {
                this.executionContext.cacheKey = this.generateCacheKey(input);
            }

            // 실제 캐시 구현은 별도 캐시 서비스에서 처리
            // 여기서는 인터페이스만 정의

            logService.debug('Result saved to cache', {
                cacheKey: this.executionContext.cacheKey
            });

        } catch (error) {
            logService.warn('Cache save failed', { error: error.message });
        }
    }

    /**
     * 폴백 처리
     */
    async handleFallback(input, originalError) {
        try {
            this.executionContext.fallbackUsed = true;
            logService.info('Executing fallback pipeline', {
                originalError: originalError.message
            });

            // 간단한 폴백 파이프라인 (draft 품질 게이트 사용)
            const fallbackOptions = {
                ...this.options,
                qualityGate: 'draft',
                maxRetries: 0,
                enableCaching: false
            };

            const fallbackPipeline = new PipelineStateMachine(fallbackOptions);
            const fallbackResult = await fallbackPipeline.execute(input);

            // 폴백 결과에 메타데이터 추가
            return {
                ...fallbackResult,
                executionMetadata: {
                    ...fallbackResult.executionMetadata,
                    fallbackUsed: true,
                    originalError: originalError.message,
                    fallbackReason: 'Original pipeline failed'
                }
            };

        } catch (fallbackError) {
            logService.error('Fallback pipeline also failed', {
                fallbackError: fallbackError.message,
                originalError: originalError.message
            });

            // 최종 폴백: 기본 응답 생성
            return this.generateMinimalFallbackResponse(input, originalError, fallbackError);
        }
    }

    /**
     * 최소 폴백 응답 생성
     */
    generateMinimalFallbackResponse(input, originalError, fallbackError) {
        return {
            skeletonJson: {
                reportItems: [{
                    type: 'error',
                    title: '처리 오류',
                    description: '텍스트 처리 중 오류가 발생했습니다.',
                    confidence: 0.1,
                    evidence: [],
                    metadata: {
                        error: true,
                        originalError: originalError.message,
                        fallbackError: fallbackError.message
                    }
                }],
                metadata: {
                    processingDate: new Date().toISOString(),
                    version: '1.0.0',
                    qualityGate: 'fallback',
                    confidence: 0.1,
                    itemCount: 1
                }
            },
            executionMetadata: {
                processingTimeMs: Date.now() - (this.executionContext.startTime || Date.now()),
                qualityGate: 'fallback',
                stateHistory: this.executionContext.stateHistory,
                retryCount: this.executionContext.retryCount,
                cacheUsed: false,
                fallbackUsed: true,
                errors: [originalError.message, fallbackError.message]
            }
        };
    }

    /**
     * 유틸리티 메서드들
     */
    generateCacheKey(input) {
        const keyData = {
            text: input.text || '',
            textSegments: input.textSegments || [],
            qualityGate: this.options.qualityGate,
            version: '1.0.0'
        };

        return crypto.createHash('sha256')
            .update(JSON.stringify(keyData))
            .digest('hex');
    }

    calculateDataSize(data) {
        try {
            return JSON.stringify(data).length;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 현재 실행 상태 조회
     */
    getExecutionStatus() {
        return {
            currentState: this.executionContext.currentState,
            processingTimeMs: this.executionContext.startTime ?
                Date.now() - this.executionContext.startTime : 0,
            stateHistory: this.executionContext.stateHistory,
            retryCount: this.executionContext.retryCount,
            errors: this.executionContext.errors,
            qualityMetrics: this.executionContext.qualityMetrics
        };
    }

    /**
     * 파이프라인 중단
     */
    async abort() {
        logService.info('Pipeline execution aborted', {
            currentState: this.executionContext.currentState,
            processingTime: this.executionContext.startTime ?
                Date.now() - this.executionContext.startTime : 0
        });

        this.executionContext.currentState = this.states.ERROR;
        this.executionContext.errors.push({
            state: this.executionContext.currentState,
            error: 'Pipeline aborted by user',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        const componentHealth = {};

        // 각 컴포넌트의 헬스 체크
        for (const [name, component] of Object.entries(this.components)) {
            try {
                if (component.healthCheck) {
                    componentHealth[name] = await component.healthCheck();
                } else {
                    componentHealth[name] = { status: 'unknown' };
                }
            } catch (error) {
                componentHealth[name] = {
                    status: 'error',
                    error: error.message
                };
            }
        }

        return {
            status: 'healthy',
            component: 'PipelineStateMachine',
            timestamp: new Date().toISOString(),
            configuration: {
                qualityGate: this.options.qualityGate,
                maxRetries: this.options.maxRetries,
                timeoutMs: this.options.timeoutMs,
                enableCaching: this.options.enableCaching,
                enableFallback: this.options.enableFallback
            },
            states: this.states,
            qualityGates: this.qualityGates,
            components: componentHealth,
            executionContext: this.getExecutionStatus()
        };
    }

    /**
     * 처리 복잡도 계산
     */
    calculateProcessingComplexity(input) {
        const complexity = {
            textLength: 0,
            entityCount: 0,
            timelineEvents: 0,
            ruleComplexity: 0,
            evidenceCount: 0
        };

        // 텍스트 길이 복잡도
        if (input.text) {
            complexity.textLength = Math.min(input.text.length / 10000, 5); // 최대 5점
        }

        // 엔티티 수 복잡도
        if (input.entities) {
            complexity.entityCount = Math.min(input.entities.length / 50, 3); // 최대 3점
        }

        // 타임라인 이벤트 복잡도
        if (input.timeline && input.timeline.events) {
            complexity.timelineEvents = Math.min(input.timeline.events.length / 20, 3); // 최대 3점
        }

        // 룰 복잡도 (기본값)
        complexity.ruleComplexity = 1;

        // 증거 수 복잡도
        if (input.evidence) {
            complexity.evidenceCount = Math.min(input.evidence.length / 10, 2); // 최대 2점
        }

        return complexity;
    }

    /**
     * 동적 타임아웃 계산
     */
    calculateDynamicTimeout(input, qualityGateConfig, retryCount = 0) {
        if (!this.options.enableDynamicTimeout) {
            return qualityGateConfig.maxProcessingTime;
        }

        const complexity = this.calculateProcessingComplexity(input);

        // 복잡도 점수 계산
        let complexityScore = 0;
        for (const [key, weight] of Object.entries(this.complexityWeights)) {
            complexityScore += (complexity[key] || 0) * weight;
        }

        // 시스템 부하 계산
        const memoryUsage = process.memoryUsage();
        const memoryLoadFactor = memoryUsage.heapUsed / memoryUsage.heapTotal;

        // 기본 타임아웃에서 시작
        let dynamicTimeout = qualityGateConfig.maxProcessingTime;

        // 복잡도에 따른 조정
        if (complexityScore > 2) {
            dynamicTimeout *= this.timeoutConfig.complexityMultiplier;
        }

        // 시스템 부하에 따른 조정
        if (memoryLoadFactor > 0.7) {
            dynamicTimeout *= this.timeoutConfig.loadMultiplier;
        }

        // 재시도 횟수에 따른 조정 (재시도 시 더 짧은 타임아웃)
        if (retryCount > 0) {
            dynamicTimeout *= Math.pow(this.timeoutConfig.retryMultiplier, retryCount);
        }

        // 최소/최대 타임아웃 제한
        dynamicTimeout = Math.max(this.timeoutConfig.minTimeout, dynamicTimeout);
        dynamicTimeout = Math.min(this.timeoutConfig.maxTimeout, dynamicTimeout);

        return Math.round(dynamicTimeout);
    }
}