// EntityNormalizer.js - 의료 엔티티 정규화 및 표준화 컴포넌트
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../utils/logger.js';

export default class EntityNormalizer {
    constructor(options = {}) {
        this.options = {
            enableFuzzyMatching: options.enableFuzzyMatching || true,
            confidenceThreshold: options.confidenceThreshold || 0.7,
            maxSuggestions: options.maxSuggestions || 3,
            ...options
        };
        
        // 의료 용어 표준화 매핑
        this.medicalTermMappings = this.initializeMedicalMappings();
        this.anatomyMappings = this.initializeAnatomyMappings();
        this.procedureMappings = this.initializeProcedureMappings();
        this.medicationMappings = this.initializeMedicationMappings();
        
        logService.info('EntityNormalizer initialized', { options: this.options });
    }

    /**
     * 메인 정규화 함수
     * @param {Array} segments - TextIngestor에서 처리된 세그먼트들
     * @param {Array} anchors - AnchorDetector에서 탐지된 앵커들
     * @returns {Object} 정규화된 엔티티 결과
     */
    async normalize(segments, anchors) {
        try {
            const startTime = Date.now();
            
            // 1. 의료 엔티티 추출
            const extractedEntities = await this.extractMedicalEntities(segments);
            
            // 2. 엔티티 정규화 및 표준화
            const normalizedEntities = await this.normalizeEntities(extractedEntities);
            
            // 3. 앵커와 엔티티 연결
            const linkedEntities = await this.linkEntitiesWithAnchors(normalizedEntities, anchors);
            
            // 4. 신뢰도 점수 계산
            const scoredEntities = await this.calculateConfidenceScores(linkedEntities);
            
            const processingTime = Date.now() - startTime;
            
            const result = {
                entities: scoredEntities,
                statistics: {
                    totalEntities: scoredEntities.length,
                    highConfidence: scoredEntities.filter(e => e.confidence >= 0.8).length,
                    mediumConfidence: scoredEntities.filter(e => e.confidence >= 0.6 && e.confidence < 0.8).length,
                    lowConfidence: scoredEntities.filter(e => e.confidence < 0.6).length,
                    processingTimeMs: processingTime
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '1.0.0',
                    component: 'EntityNormalizer'
                }
            };
            
            logService.info('Entity normalization completed', {
                totalEntities: result.statistics.totalEntities,
                processingTime 
            });
            
            return result;
            
        } catch (error) {
            logService.error('Entity normalization failed', { error: error.message });
            throw new Error(`EntityNormalizer failed: ${error.message}`);
        }
    }

    /**
     * 의료 엔티티 추출
     */
    async extractMedicalEntities(segments) {
        const entities = [];
        
        for (const segment of segments) {
            // 진단명 추출
            const diagnoses = this.extractDiagnoses(segment);
            entities.push(...diagnoses);
            
            // 시술/수술명 추출
            const procedures = this.extractProcedures(segment);
            entities.push(...procedures);
            
            // 약물명 추출
            const medications = this.extractMedications(segment);
            entities.push(...medications);
            
            // 해부학적 부위 추출
            const anatomy = this.extractAnatomicalSites(segment);
            entities.push(...anatomy);
            
            // 검사명 추출
            const tests = this.extractTests(segment);
            entities.push(...tests);
        }
        
        return entities;
    }

    /**
     * 진단명 추출
     */
    extractDiagnoses(segment) {
        const diagnoses = [];
        const diagnosisPatterns = [
            /(?:진단|병명|질환|질병)\s*[:：]\s*([^.\n]+)/gi,
            /([가-힣]+(?:증|염|병|암|종양|질환))/gi,
            /ICD[-\s]*(?:10|9)\s*[:：]\s*([A-Z]\d{2}(?:\.\d{1,2})?)/gi
        ];
        
        diagnosisPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(segment.text)) !== null) {
                diagnoses.push({
                    type: 'diagnosis',
                    originalText: match[1] || match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    segmentId: segment.id,
                    context: this.extractContext(segment.text, match.index, 50)
                });
            }
        });
        
        return diagnoses;
    }

    /**
     * 시술/수술명 추출
     */
    extractProcedures(segment) {
        const procedures = [];
        const procedurePatterns = [
            /(?:수술|시술|처치|치료)\s*[:：]\s*([^.\n]+)/gi,
            /([가-힣]+(?:술|법|요법|치료))/gi,
            /(?:CPT|KCD)\s*[:：]\s*([A-Z0-9]+)/gi
        ];
        
        procedurePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(segment.text)) !== null) {
                procedures.push({
                    type: 'procedure',
                    originalText: match[1] || match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    segmentId: segment.id,
                    context: this.extractContext(segment.text, match.index, 50)
                });
            }
        });
        
        return procedures;
    }

    /**
     * 약물명 추출
     */
    extractMedications(segment) {
        const medications = [];
        const medicationPatterns = [
            /(?:약물|투약|처방|복용)\s*[:：]\s*([^.\n]+)/gi,
            /([가-힣]+(?:정|캡슐|시럽|주사|연고))/gi,
            /(\d+mg|\d+ml|\d+정|\d+회)/gi
        ];
        
        medicationPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(segment.text)) !== null) {
                medications.push({
                    type: 'medication',
                    originalText: match[1] || match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    segmentId: segment.id,
                    context: this.extractContext(segment.text, match.index, 50)
                });
            }
        });
        
        return medications;
    }

    /**
     * 해부학적 부위 추출
     */
    extractAnatomicalSites(segment) {
        const anatomy = [];
        const anatomyPatterns = [
            /(?:부위|위치|장기)\s*[:：]\s*([^.\n]+)/gi,
            /(머리|목|가슴|복부|팔|다리|심장|폐|간|신장|위|장)/gi
        ];
        
        anatomyPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(segment.text)) !== null) {
                anatomy.push({
                    type: 'anatomy',
                    originalText: match[1] || match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    segmentId: segment.id,
                    context: this.extractContext(segment.text, match.index, 50)
                });
            }
        });
        
        return anatomy;
    }

    /**
     * 검사명 추출
     */
    extractTests(segment) {
        const tests = [];
        const testPatterns = [
            /(?:검사|촬영|진단)\s*[:：]\s*([^.\n]+)/gi,
            /(CT|MRI|X-ray|초음파|혈액검사|소변검사)/gi,
            /([가-힣]+(?:검사|촬영|스캔))/gi
        ];
        
        testPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(segment.text)) !== null) {
                tests.push({
                    type: 'test',
                    originalText: match[1] || match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    segmentId: segment.id,
                    context: this.extractContext(segment.text, match.index, 50)
                });
            }
        });
        
        return tests;
    }

    /**
     * 엔티티 정규화 및 표준화
     */
    async normalizeEntities(entities) {
        const normalized = [];
        
        for (const entity of entities) {
            const normalizedEntity = await this.normalizeEntity(entity);
            if (normalizedEntity) {
                normalized.push(normalizedEntity);
            }
        }
        
        // 중복 제거
        return this.deduplicateEntities(normalized);
    }

    /**
     * 개별 엔티티 정규화
     */
    async normalizeEntity(entity) {
        try {
            const mappings = this.getMappingsForType(entity.type);
            const normalizedText = this.normalizeText(entity.originalText);
            
            // 표준 용어 매핑 시도
            const standardTerm = this.findStandardTerm(normalizedText, mappings);
            
            return {
                ...entity,
                normalizedText,
                standardTerm: standardTerm || normalizedText,
                mappingConfidence: standardTerm ? 0.9 : 0.5,
                aliases: this.findAliases(normalizedText, mappings)
            };
            
        } catch (error) {
            logService.warn('Entity normalization failed for entity', { 
                entity: entity.originalText, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * 앵커와 엔티티 연결
     */
    async linkEntitiesWithAnchors(entities, anchors) {
        return entities.map(entity => {
            // 가장 가까운 앵커 찾기
            const nearestAnchor = this.findNearestAnchor(entity, anchors);
            
            return {
                ...entity,
                linkedAnchor: nearestAnchor,
                temporalContext: nearestAnchor ? {
                    date: nearestAnchor.normalizedDate,
                    type: nearestAnchor.type,
                    confidence: nearestAnchor.confidence
                } : null
            };
        });
    }

    /**
     * 신뢰도 점수 계산
     */
    async calculateConfidenceScores(entities) {
        return entities.map(entity => {
            let confidence = 0.5; // 기본 신뢰도
            
            // 매핑 신뢰도 반영
            if (entity.mappingConfidence) {
                confidence += entity.mappingConfidence * 0.3;
            }
            
            // 컨텍스트 품질 반영
            if (entity.context && entity.context.length > 20) {
                confidence += 0.1;
            }
            
            // 시간적 앵커 연결 반영
            if (entity.linkedAnchor) {
                confidence += entity.linkedAnchor.confidence * 0.2;
            }
            
            // 표준 용어 매핑 반영
            if (entity.standardTerm !== entity.normalizedText) {
                confidence += 0.1;
            }
            
            return {
                ...entity,
                confidence: Math.min(confidence, 1.0)
            };
        });
    }

    /**
     * 유틸리티 메서드들
     */
    extractContext(text, index, radius) {
        const start = Math.max(0, index - radius);
        const end = Math.min(text.length, index + radius);
        return text.substring(start, end).trim();
    }

    normalizeText(text) {
        return text.trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s가-힣]/g, '')
            .toLowerCase();
    }

    findNearestAnchor(entity, anchors) {
        if (!anchors || anchors.length === 0) return null;
        
        // 같은 세그먼트 내의 앵커 우선
        const sameSegmentAnchors = anchors.filter(anchor => 
            anchor.segmentId === entity.segmentId
        );
        
        if (sameSegmentAnchors.length > 0) {
            return sameSegmentAnchors[0];
        }
        
        // 가장 가까운 앵커 반환
        return anchors.reduce((nearest, current) => {
            const nearestDistance = Math.abs(nearest.startIndex - entity.startIndex);
            const currentDistance = Math.abs(current.startIndex - entity.startIndex);
            return currentDistance < nearestDistance ? current : nearest;
        });
    }

    deduplicateEntities(entities) {
        const seen = new Set();
        return entities.filter(entity => {
            const key = `${entity.type}-${entity.normalizedText}-${entity.segmentId}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    getMappingsForType(type) {
        switch (type) {
            case 'diagnosis': return this.medicalTermMappings;
            case 'anatomy': return this.anatomyMappings;
            case 'procedure': return this.procedureMappings;
            case 'medication': return this.medicationMappings;
            default: return {};
        }
    }

    findStandardTerm(text, mappings) {
        return mappings[text] || null;
    }

    findAliases(text, mappings) {
        const aliases = [];
        for (const [key, value] of Object.entries(mappings)) {
            if (value === text && key !== text) {
                aliases.push(key);
            }
        }
        return aliases;
    }

    /**
     * 의료 용어 매핑 초기화
     */
    initializeMedicalMappings() {
        return {
            '고혈압': '본태성 고혈압',
            '당뇨': '당뇨병',
            '당뇨병': '제2형 당뇨병',
            '심근경색': '급성 심근경색증',
            '뇌졸중': '뇌혈관 질환',
            '폐렴': '세균성 폐렴',
            '위염': '만성 위염',
            '간염': '바이러스성 간염'
        };
    }

    initializeAnatomyMappings() {
        return {
            '머리': '두부',
            '목': '경부',
            '가슴': '흉부',
            '배': '복부',
            '팔': '상지',
            '다리': '하지'
        };
    }

    initializeProcedureMappings() {
        return {
            '수술': '외과적 처치',
            '시술': '의료 시술',
            '치료': '치료적 처치',
            '검사': '진단적 검사'
        };
    }

    initializeMedicationMappings() {
        return {
            '아스피린': '아세틸살리실산',
            '타이레놀': '아세트아미노펜',
            '부루펜': '이부프로펜',
            '게보린': '이부프로펜'
        };
    }

    /**
     * 헬스 체크
     */
    async healthCheck() {
        return {
            status: 'healthy',
            component: 'EntityNormalizer',
            timestamp: new Date().toISOString(),
            mappings: {
                medical: Object.keys(this.medicalTermMappings).length,
                anatomy: Object.keys(this.anatomyMappings).length,
                procedure: Object.keys(this.procedureMappings).length,
                medication: Object.keys(this.medicationMappings).length
            }
        };
    }
}