import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MCP(Model Context Protocol) 기반 자가 학습 엔진
 * - 반복 학습을 통한 성능 개선
 * - 패턴 인식 및 적응적 처리
 * - 문맥 이해 능력 향상
 * - 도메인 특화 지식 축적
 */
class MCPLearningEngine {
    constructor() {
        this.baseURL = 'http://localhost:3030';
        this.learningPath = path.join(__dirname, '../temp/mcp-learning');
        this.knowledgePath = path.join(__dirname, '../temp/knowledge-base');
        this.modelsPath = path.join(__dirname, '../temp/adaptive-models');
        
        // 학습 데이터 구조
        this.knowledgeBase = {
            patterns: new Map(),
            contexts: new Map(),
            adaptations: new Map(),
            performance: new Map(),
            feedback: new Map()
        };
        
        // MCP 설정
        this.mcpConfig = {
            learningRate: 0.1,
            adaptationThreshold: 0.8,
            contextWindow: 5,
            patternMinOccurrence: 3,
            feedbackWeight: 0.3
        };
        
        this.ensureDirectories();
        this.loadExistingKnowledge();
    }
    
    ensureDirectories() {
        const dirs = [
            this.learningPath,
            this.knowledgePath,
            this.modelsPath,
            path.join(this.learningPath, 'sessions'),
            path.join(this.learningPath, 'patterns'),
            path.join(this.learningPath, 'adaptations'),
            path.join(this.knowledgePath, 'medical'),
            path.join(this.knowledgePath, 'insurance'),
            path.join(this.knowledgePath, 'temporal'),
            path.join(this.modelsPath, 'extraction'),
            path.join(this.modelsPath, 'classification'),
            path.join(this.modelsPath, 'validation')
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    /**
     * 기존 지식 로드
     */
    loadExistingKnowledge() {
        try {
            const knowledgeFiles = [
                'patterns.json',
                'contexts.json',
                'adaptations.json',
                'performance.json',
                'feedback.json'
            ];
            
            knowledgeFiles.forEach(file => {
                const filePath = path.join(this.knowledgePath, file);
                if (fs.existsSync(filePath)) {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    const key = file.replace('.json', '');
                    this.knowledgeBase[key] = new Map(Object.entries(data));
                }
            });
            
            console.log('📚 기존 지식베이스 로드 완료');
        } catch (error) {
            console.log('📚 새로운 지식베이스 초기화');
        }
    }
    
    /**
     * 자가 학습 세션 시작
     */
    async startLearningSession(caseData, iterations = 3) {
        console.log('🧠 MCP 자가 학습 세션 시작');
        console.log(`🔄 반복 횟수: ${iterations}회`);
        
        const sessionId = `session_${Date.now()}`;
        const sessionData = {
            sessionId,
            startTime: new Date().toISOString(),
            caseData,
            iterations: [],
            learningProgress: [],
            adaptations: [],
            finalModel: null
        };
        
        let currentModel = await this.initializeModel();
        
        for (let i = 0; i < iterations; i++) {
            console.log(`\n🔄 반복 ${i + 1}/${iterations}`);
            
            const iterationResult = await this.runLearningIteration(
                currentModel,
                caseData,
                i
            );
            
            sessionData.iterations.push(iterationResult);
            
            // 모델 적응 및 개선
            currentModel = await this.adaptModel(
                currentModel,
                iterationResult,
                sessionData.learningProgress
            );
            
            // 학습 진행도 기록
            const progress = await this.evaluateProgress(
                iterationResult,
                sessionData.learningProgress
            );
            sessionData.learningProgress.push(progress);
            
            console.log(`   📈 성능 개선: ${progress.improvementRate.toFixed(2)}%`);
            
            // 조기 종료 조건 확인
            if (progress.convergence > 0.95) {
                console.log('   ✅ 수렴 조건 달성, 조기 종료');
                break;
            }
        }
        
        sessionData.finalModel = currentModel;
        sessionData.endTime = new Date().toISOString();
        
        // 세션 결과 저장
        await this.saveLearningSession(sessionData);
        
        // 지식베이스 업데이트
        await this.updateKnowledgeBase(sessionData);
        
        console.log('🎉 학습 세션 완료');
        return sessionData;
    }
    
    /**
     * 모델 초기화
     */
    async initializeModel() {
        const model = {
            id: `model_${Date.now()}`,
            version: '1.0.0',
            extractionRules: await this.loadExtractionRules(),
            classificationPatterns: await this.loadClassificationPatterns(),
            validationCriteria: await this.loadValidationCriteria(),
            contextualWeights: await this.loadContextualWeights(),
            adaptiveParameters: {
                sensitivity: 0.5,
                specificity: 0.5,
                contextAwareness: 0.5,
                temporalAccuracy: 0.5
            },
            performance: {
                accuracy: 0,
                precision: 0,
                recall: 0,
                f1Score: 0
            }
        };
        
        return model;
    }
    
    /**
     * 학습 반복 실행
     */
    async runLearningIteration(model, caseData, iterationIndex) {
        const startTime = Date.now();
        
        const iteration = {
            index: iterationIndex,
            startTime: new Date().toISOString(),
            model: JSON.parse(JSON.stringify(model)), // 깊은 복사
            results: [],
            patterns: [],
            adaptations: [],
            performance: {},
            insights: []
        };
        
        // 각 케이스에 대해 처리
        for (const caseItem of caseData) {
            const caseResult = await this.processCaseWithModel(
                model,
                caseItem,
                iterationIndex
            );
            
            iteration.results.push(caseResult);
            
            // 패턴 학습
            const patterns = await this.learnPatterns(
                caseResult,
                caseItem,
                model
            );
            iteration.patterns.push(...patterns);
            
            // 실시간 적응
            const adaptations = await this.performRealTimeAdaptation(
                model,
                caseResult,
                patterns
            );
            iteration.adaptations.push(...adaptations);
        }
        
        // 반복 성능 평가
        iteration.performance = await this.evaluateIterationPerformance(
            iteration.results
        );
        
        // 인사이트 생성
        iteration.insights = await this.generateIterationInsights(
            iteration
        );
        
        iteration.endTime = new Date().toISOString();
        iteration.duration = Date.now() - startTime;
        
        return iteration;
    }
    
    /**
     * 모델로 케이스 처리
     */
    async processCaseWithModel(model, caseItem, iterationIndex) {
        const startTime = Date.now();
        
        try {
            // 모델 기반 처리 요청
            const response = await fetch(`${this.baseURL}/api/mcp-processing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: caseItem.content,
                    model: model,
                    iteration: iterationIndex,
                    learningMode: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`MCP 처리 실패: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            return {
                caseId: caseItem.id,
                processingTime: Date.now() - startTime,
                extractedData: result.extractedData,
                confidence: result.confidence,
                contextualInfo: result.contextualInfo,
                temporalStructure: result.temporalStructure,
                qualityMetrics: result.qualityMetrics,
                adaptiveFeatures: result.adaptiveFeatures
            };
            
        } catch (error) {
            console.error(`케이스 ${caseItem.id} 처리 실패:`, error.message);
            return {
                caseId: caseItem.id,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }
    
    /**
     * 패턴 학습
     */
    async learnPatterns(caseResult, caseItem, model) {
        const patterns = [];
        
        if (caseResult.error) return patterns;
        
        // 1. 텍스트 패턴 학습
        const textPatterns = this.identifyTextPatterns(
            caseItem.content,
            caseResult.extractedData
        );
        patterns.push(...textPatterns);
        
        // 2. 구조적 패턴 학습
        const structuralPatterns = this.identifyStructuralPatterns(
            caseResult.temporalStructure
        );
        patterns.push(...structuralPatterns);
        
        // 3. 문맥적 패턴 학습
        const contextualPatterns = this.identifyContextualPatterns(
            caseResult.contextualInfo
        );
        patterns.push(...contextualPatterns);
        
        // 4. 성능 패턴 학습
        const performancePatterns = this.identifyPerformancePatterns(
            caseResult.qualityMetrics,
            model.performance
        );
        patterns.push(...performancePatterns);
        
        // 패턴 가중치 계산
        patterns.forEach(pattern => {
            pattern.weight = this.calculatePatternWeight(pattern, caseResult);
            pattern.confidence = this.calculatePatternConfidence(pattern);
            pattern.timestamp = new Date().toISOString();
        });
        
        return patterns;
    }
    
    /**
     * 실시간 모델 적응
     */
    async performRealTimeAdaptation(model, caseResult, patterns) {
        const adaptations = [];
        
        // 1. 추출 규칙 적응
        const extractionAdaptations = await this.adaptExtractionRules(
            model.extractionRules,
            caseResult,
            patterns
        );
        adaptations.push(...extractionAdaptations);
        
        // 2. 분류 패턴 적응
        const classificationAdaptations = await this.adaptClassificationPatterns(
            model.classificationPatterns,
            caseResult,
            patterns
        );
        adaptations.push(...classificationAdaptations);
        
        // 3. 검증 기준 적응
        const validationAdaptations = await this.adaptValidationCriteria(
            model.validationCriteria,
            caseResult,
            patterns
        );
        adaptations.push(...validationAdaptations);
        
        // 4. 문맥적 가중치 적응
        const weightAdaptations = await this.adaptContextualWeights(
            model.contextualWeights,
            caseResult,
            patterns
        );
        adaptations.push(...weightAdaptations);
        
        // 적응 사항 모델에 적용
        this.applyAdaptations(model, adaptations);
        
        return adaptations;
    }
    
    /**
     * 모델 적응
     */
    async adaptModel(model, iterationResult, learningProgress) {
        const adaptedModel = JSON.parse(JSON.stringify(model)); // 깊은 복사
        
        // 1. 성능 기반 적응
        await this.performanceBasedAdaptation(
            adaptedModel,
            iterationResult.performance
        );
        
        // 2. 패턴 기반 적응
        await this.patternBasedAdaptation(
            adaptedModel,
            iterationResult.patterns
        );
        
        // 3. 피드백 기반 적응
        await this.feedbackBasedAdaptation(
            adaptedModel,
            iterationResult.insights
        );
        
        // 4. 진화적 적응
        await this.evolutionaryAdaptation(
            adaptedModel,
            learningProgress
        );
        
        // 모델 버전 업데이트
        adaptedModel.version = this.incrementVersion(adaptedModel.version);
        adaptedModel.lastAdaptation = new Date().toISOString();
        
        return adaptedModel;
    }
    
    /**
     * 학습 진행도 평가
     */
    async evaluateProgress(iterationResult, previousProgress) {
        const currentPerformance = iterationResult.performance;
        const previousPerformance = previousProgress.length > 0 
            ? previousProgress[previousProgress.length - 1].performance 
            : { accuracy: 0, precision: 0, recall: 0, f1Score: 0 };
        
        const progress = {
            iteration: iterationResult.index,
            timestamp: new Date().toISOString(),
            performance: currentPerformance,
            improvementRate: this.calculateImprovementRate(
                currentPerformance,
                previousPerformance
            ),
            convergence: this.calculateConvergence(previousProgress),
            stability: this.calculateStability(previousProgress),
            adaptationEffectiveness: this.calculateAdaptationEffectiveness(
                iterationResult.adaptations
            ),
            learningVelocity: this.calculateLearningVelocity(previousProgress)
        };
        
        return progress;
    }
    
    /**
     * 지식베이스 업데이트
     */
    async updateKnowledgeBase(sessionData) {
        // 패턴 업데이트
        sessionData.iterations.forEach(iteration => {
            iteration.patterns.forEach(pattern => {
                const key = `${pattern.type}_${pattern.context}`;
                if (!this.knowledgeBase.patterns.has(key)) {
                    this.knowledgeBase.patterns.set(key, []);
                }
                this.knowledgeBase.patterns.get(key).push(pattern);
            });
        });
        
        // 성능 데이터 업데이트
        sessionData.learningProgress.forEach(progress => {
            const key = `session_${sessionData.sessionId}_iter_${progress.iteration}`;
            this.knowledgeBase.performance.set(key, progress);
        });
        
        // 적응 데이터 업데이트
        sessionData.iterations.forEach(iteration => {
            iteration.adaptations.forEach(adaptation => {
                const key = `${adaptation.type}_${adaptation.target}`;
                if (!this.knowledgeBase.adaptations.has(key)) {
                    this.knowledgeBase.adaptations.set(key, []);
                }
                this.knowledgeBase.adaptations.get(key).push(adaptation);
            });
        });
        
        // 지식베이스 저장
        await this.saveKnowledgeBase();
    }
    
    /**
     * 지식베이스 저장
     */
    async saveKnowledgeBase() {
        const knowledgeData = {
            patterns: Object.fromEntries(this.knowledgeBase.patterns),
            contexts: Object.fromEntries(this.knowledgeBase.contexts),
            adaptations: Object.fromEntries(this.knowledgeBase.adaptations),
            performance: Object.fromEntries(this.knowledgeBase.performance),
            feedback: Object.fromEntries(this.knowledgeBase.feedback)
        };
        
        Object.entries(knowledgeData).forEach(([key, data]) => {
            fs.writeFileSync(
                path.join(this.knowledgePath, `${key}.json`),
                JSON.stringify(data, null, 2),
                'utf-8'
            );
        });
    }
    
    /**
     * 학습 세션 저장
     */
    async saveLearningSession(sessionData) {
        const sessionFile = path.join(
            this.learningPath,
            'sessions',
            `${sessionData.sessionId}.json`
        );
        
        fs.writeFileSync(
            sessionFile,
            JSON.stringify(sessionData, null, 2),
            'utf-8'
        );
        
        // 요약 보고서 생성
        const summaryReport = this.generateSessionSummary(sessionData);
        const summaryFile = path.join(
            this.learningPath,
            'sessions',
            `${sessionData.sessionId}_summary.md`
        );
        
        fs.writeFileSync(summaryFile, summaryReport, 'utf-8');
    }
    
    /**
     * 세션 요약 보고서 생성
     */
    generateSessionSummary(sessionData) {
        const finalProgress = sessionData.learningProgress[sessionData.learningProgress.length - 1];
        const totalImprovement = finalProgress ? finalProgress.improvementRate : 0;
        
        return `
# MCP 학습 세션 보고서

## 세션 정보
- 세션 ID: ${sessionData.sessionId}
- 시작 시간: ${sessionData.startTime}
- 종료 시간: ${sessionData.endTime}
- 총 반복 횟수: ${sessionData.iterations.length}

## 학습 성과
- 최종 성능 개선율: ${totalImprovement.toFixed(2)}%
- 수렴도: ${finalProgress ? finalProgress.convergence.toFixed(3) : 'N/A'}
- 안정성: ${finalProgress ? finalProgress.stability.toFixed(3) : 'N/A'}

## 주요 패턴
${sessionData.iterations.flatMap(i => i.patterns).slice(0, 5).map(p => `- ${p.type}: ${p.description || 'N/A'}`).join('\n')}

## 적응 사항
${sessionData.iterations.flatMap(i => i.adaptations).slice(0, 5).map(a => `- ${a.type}: ${a.description || 'N/A'}`).join('\n')}
`;
    }
    
    // 헬퍼 메서드들 (실제 구현 필요)
    async loadExtractionRules() { return {}; }
    async loadClassificationPatterns() { return {}; }
    async loadValidationCriteria() { return {}; }
    async loadContextualWeights() { return {}; }
    
    identifyTextPatterns(content, extractedData) { return []; }
    identifyStructuralPatterns(temporalStructure) { return []; }
    identifyContextualPatterns(contextualInfo) { return []; }
    identifyPerformancePatterns(qualityMetrics, performance) { return []; }
    
    calculatePatternWeight(pattern, caseResult) { return 1.0; }
    calculatePatternConfidence(pattern) { return 0.8; }
    
    async adaptExtractionRules(rules, caseResult, patterns) { return []; }
    async adaptClassificationPatterns(patterns, caseResult, learnedPatterns) { return []; }
    async adaptValidationCriteria(criteria, caseResult, patterns) { return []; }
    async adaptContextualWeights(weights, caseResult, patterns) { return []; }
    
    applyAdaptations(model, adaptations) {}
    
    async performanceBasedAdaptation(model, performance) {}
    async patternBasedAdaptation(model, patterns) {}
    async feedbackBasedAdaptation(model, insights) {}
    async evolutionaryAdaptation(model, learningProgress) {}
    
    incrementVersion(version) {
        const parts = version.split('.');
        parts[2] = (parseInt(parts[2]) + 1).toString();
        return parts.join('.');
    }
    
    calculateImprovementRate(current, previous) {
        const currentAvg = (current.accuracy + current.precision + current.recall + current.f1Score) / 4;
        const previousAvg = (previous.accuracy + previous.precision + previous.recall + previous.f1Score) / 4;
        return previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
    }
    
    calculateConvergence(progress) {
        if (progress.length < 3) return 0;
        const recent = progress.slice(-3).map(p => p.performance.f1Score);
        const variance = this.calculateVariance(recent);
        return Math.max(0, 1 - variance);
    }
    
    calculateStability(progress) {
        if (progress.length < 2) return 0;
        const improvements = progress.slice(1).map(p => p.improvementRate);
        return 1 - this.calculateVariance(improvements) / 100;
    }
    
    calculateAdaptationEffectiveness(adaptations) {
        return adaptations.length > 0 ? adaptations.reduce((sum, a) => sum + (a.effectiveness || 0.5), 0) / adaptations.length : 0;
    }
    
    calculateLearningVelocity(progress) {
        if (progress.length < 2) return 0;
        const recent = progress.slice(-2);
        return recent[1].improvementRate - recent[0].improvementRate;
    }
    
    calculateVariance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return variance;
    }
    
    async evaluateIterationPerformance(results) {
        const validResults = results.filter(r => !r.error);
        if (validResults.length === 0) {
            return { accuracy: 0, precision: 0, recall: 0, f1Score: 0 };
        }
        
        const avgMetrics = validResults.reduce((sum, r) => {
            const metrics = r.qualityMetrics || { accuracy: 0, precision: 0, recall: 0, f1Score: 0 };
            return {
                accuracy: sum.accuracy + metrics.accuracy,
                precision: sum.precision + metrics.precision,
                recall: sum.recall + metrics.recall,
                f1Score: sum.f1Score + metrics.f1Score
            };
        }, { accuracy: 0, precision: 0, recall: 0, f1Score: 0 });
        
        return {
            accuracy: avgMetrics.accuracy / validResults.length,
            precision: avgMetrics.precision / validResults.length,
            recall: avgMetrics.recall / validResults.length,
            f1Score: avgMetrics.f1Score / validResults.length
        };
    }
    
    async generateIterationInsights(iteration) {
        return [
            `반복 ${iteration.index + 1} 완료`,
            `처리된 케이스: ${iteration.results.length}개`,
            `학습된 패턴: ${iteration.patterns.length}개`,
            `적용된 적응: ${iteration.adaptations.length}개`
        ];
    }
}

// 실행 함수
async function runMCPLearning(caseData, iterations = 3) {
    try {
        const engine = new MCPLearningEngine();
        const sessionResult = await engine.startLearningSession(caseData, iterations);
        
        console.log('\n🎉 MCP 학습 완료!');
        console.log(`📈 최종 개선율: ${sessionResult.learningProgress[sessionResult.learningProgress.length - 1]?.improvementRate.toFixed(2) || 0}%`);
        
        return sessionResult;
    } catch (error) {
        console.error('💥 MCP 학습 실패:', error);
        throw error;
    }
}

export { MCPLearningEngine, runMCPLearning };