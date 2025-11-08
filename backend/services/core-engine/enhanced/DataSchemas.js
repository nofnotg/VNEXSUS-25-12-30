// DataSchemas.js - 고도화된 코어엔진 데이터 스키마 정의

/**
 * 고도화된 코어 엔진 데이터 스키마
 * 새로운 아키텍처를 위한 데이터 구조 정의
 */

/**
 * 컨텍스트 기반 세그먼트
 */
class Segment {
    constructor(data = {}) {
        this.id = data.id || this.generateId('seg');
        this.text = data.text || '';
        this.sourceIndex = data.sourceIndex || 0;
        this.contextType = data.contextType || 'unknown'; // hospital, department, visit, procedure
        this.medicalDomain = data.medicalDomain || 'general'; // cardiology, oncology, surgery, etc.
        this.confidence = data.confidence || 0;
        this.position = data.position || { start: 0, end: 0 };
        this.metadata = {
            length: this.text.length,
            wordCount: this.text.split(/\s+/).length,
            hasDatePattern: /\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(this.text),
            hasMedicalTerms: this.detectMedicalTerms(this.text),
            ...data.metadata
        };
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    detectMedicalTerms(text) {
        const medicalKeywords = ['진단', '처방', '수술', '검사', '치료', '병원', '의사', '환자'];
        return medicalKeywords.some(keyword => text.includes(keyword));
    }

    toJSON() {
        return {
            id: this.id,
            text: this.text,
            sourceIndex: this.sourceIndex,
            contextType: this.contextType,
            medicalDomain: this.medicalDomain,
            confidence: this.confidence,
            position: this.position,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}

/**
 * 시간적 이벤트
 */
class Event {
    constructor(data = {}) {
        this.id = data.id || this.generateId('evt');
        this.type = data.type || 'unknown'; // visit, diagnosis, procedure, medication, test
        this.date = data.date || null;
        this.normalizedDate = data.normalizedDate || null;
        this.dateConfidence = data.dateConfidence || 0;
        this.description = data.description || '';
        this.entities = data.entities || []; // 관련 엔티티 ID 배열
        this.evidence = data.evidence || []; // 근거 정보
        this.relevanceScore = data.relevanceScore || 0;
        this.temporalRelations = data.temporalRelations || []; // before, after, during, concurrent
        this.metadata = {
            source: data.source || 'unknown',
            extractionMethod: data.extractionMethod || 'rule-based',
            validationStatus: data.validationStatus || 'pending',
            ...data.metadata
        };
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    addTemporalRelation(relationId, relationType, confidence = 0.5) {
        this.temporalRelations.push({
            relatedEventId: relationId,
            relationType: relationType,
            confidence: confidence,
            createdAt: new Date().toISOString()
        });
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            date: this.date,
            normalizedDate: this.normalizedDate,
            dateConfidence: this.dateConfidence,
            description: this.description,
            entities: this.entities,
            evidence: this.evidence,
            relevanceScore: this.relevanceScore,
            temporalRelations: this.temporalRelations,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}

/**
 * 향상된 엔티티
 */
class Entity {
    constructor(data = {}) {
        this.id = data.id || this.generateId('ent');
        this.type = data.type || 'unknown'; // diagnosis, procedure, medication, anatomy, value
        this.subtype = data.subtype || null; // primary_diagnosis, surgical_procedure, etc.
        this.text = data.text || '';
        this.normalizedText = data.normalizedText || this.text;
        this.value = data.value || null; // 수치값이나 표준화된 값
        this.unit = data.unit || null; // 단위
        this.confidence = data.confidence || 0;
        this.position = data.position || { start: 0, end: 0 };
        this.context = data.context || ''; // 주변 텍스트 컨텍스트
        this.attributes = data.attributes || {}; // 추가 속성들
        this.relations = data.relations || []; // 다른 엔티티와의 관계
        this.evidence = data.evidence || []; // 추출 근거
        this.validationStatus = data.validationStatus || 'pending';
        this.metadata = {
            extractionMethod: data.extractionMethod || 'rule-based',
            medicalCode: data.medicalCode || null, // ICD-10, SNOMED 등
            synonyms: data.synonyms || [],
            ...data.metadata
        };
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    addRelation(entityId, relationType, confidence = 0.5) {
        this.relations.push({
            relatedEntityId: entityId,
            relationType: relationType,
            confidence: confidence,
            createdAt: new Date().toISOString()
        });
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            subtype: this.subtype,
            text: this.text,
            normalizedText: this.normalizedText,
            value: this.value,
            unit: this.unit,
            confidence: this.confidence,
            position: this.position,
            context: this.context,
            attributes: this.attributes,
            relations: this.relations,
            evidence: this.evidence,
            validationStatus: this.validationStatus,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}

/**
 * 증거 정보
 */
class Evidence {
    constructor(data = {}) {
        this.id = data.id || this.generateId('evd');
        this.type = data.type || 'textual'; // textual, pattern, rule, inference
        this.source = data.source || 'unknown';
        this.content = data.content || '';
        this.position = data.position || { start: 0, end: 0 };
        this.confidence = data.confidence || 0;
        this.supportedClaim = data.supportedClaim || '';
        this.extractionRule = data.extractionRule || null;
        this.metadata = {
            method: data.method || 'manual',
            validator: data.validator || null,
            ...data.metadata
        };
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            source: this.source,
            content: this.content,
            position: this.position,
            confidence: this.confidence,
            supportedClaim: this.supportedClaim,
            extractionRule: this.extractionRule,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}

/**
 * 태그된 블록
 */
class TaggedBlock {
    constructor(data = {}) {
        this.id = data.id || this.generateId('tag');
        this.segmentId = data.segmentId || null;
        this.tags = data.tags || []; // 의미론적 태그들
        this.priority = data.priority || 'medium'; // high, medium, low
        this.medicalCategory = data.medicalCategory || 'general';
        this.temporalRelevance = data.temporalRelevance || 'unknown'; // past, present, future
        this.clinicalSignificance = data.clinicalSignificance || 0; // 0-1 점수
        this.processingHints = data.processingHints || []; // AI 처리를 위한 힌트
        this.metadata = {
            autoTagged: data.autoTagged || true,
            reviewRequired: data.reviewRequired || false,
            ...data.metadata
        };
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    addTag(tag, confidence = 0.5) {
        this.tags.push({
            name: tag,
            confidence: confidence,
            addedAt: new Date().toISOString()
        });
    }

    toJSON() {
        return {
            id: this.id,
            segmentId: this.segmentId,
            tags: this.tags,
            priority: this.priority,
            medicalCategory: this.medicalCategory,
            temporalRelevance: this.temporalRelevance,
            clinicalSignificance: this.clinicalSignificance,
            processingHints: this.processingHints,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}

/**
 * 관련성 점수
 */
class Relevance {
    constructor(data = {}) {
        this.id = data.id || this.generateId('rel');
        this.targetId = data.targetId || null; // 평가 대상 ID
        this.targetType = data.targetType || 'unknown'; // segment, entity, event
        this.overallScore = data.overallScore || 0; // 0-1 전체 관련성 점수
        this.componentScores = {
            medicalImportance: data.medicalImportance || 0,
            temporalRelevance: data.temporalRelevance || 0,
            contextualFit: data.contextualFit || 0,
            evidenceStrength: data.evidenceStrength || 0,
            ...data.componentScores
        };
        this.factors = data.factors || []; // 점수에 영향을 준 요인들
        this.explanation = data.explanation || '';
        this.metadata = {
            scoringMethod: data.scoringMethod || 'weighted_average',
            version: data.version || '1.0.0',
            ...data.metadata
        };
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateOverallScore() {
        const weights = {
            medicalImportance: 0.4,
            temporalRelevance: 0.2,
            contextualFit: 0.2,
            evidenceStrength: 0.2
        };

        this.overallScore = Object.entries(this.componentScores)
            .reduce((sum, [key, score]) => {
                const weight = weights[key] || 0.1;
                return sum + (score * weight);
            }, 0);

        return this.overallScore;
    }

    toJSON() {
        return {
            id: this.id,
            targetId: this.targetId,
            targetType: this.targetType,
            overallScore: this.overallScore,
            componentScores: this.componentScores,
            factors: this.factors,
            explanation: this.explanation,
            metadata: this.metadata,
            createdAt: this.createdAt
        };
    }
}

/**
 * 케이스 번들 (전체 처리 결과)
 */
class CaseBundle {
    constructor(data = {}) {
        this.id = data.id || this.generateId('case');
        this.caseId = data.caseId || null;
        this.processingId = data.processingId || null;
        this.version = data.version || '2.0.0';
        this.qualityScore = data.qualityScore || 0;
        
        // 원본 텍스트 보존 (정보 보존도 평가를 위해 필수)
        this.originalText = data.originalText || data.rawText || '';
        
        // 처리된 데이터
        this.segments = data.segments || [];
        this.entities = data.entities || [];
        this.events = data.events || [];
        this.evidence = data.evidence || [];
        this.taggedBlocks = data.taggedBlocks || [];
        this.relevanceScores = data.relevanceScores || [];
        
        // 원본 데이터 보존
        this.originalData = {
            rawText: this.originalText,
            sourceDocuments: data.sourceDocuments || [],
            preservedStructure: data.preservedStructure || {},
            ...data.originalData
        };
        
        // 메타데이터
        this.metadata = {
            processingTimeMs: data.processingTimeMs || 0,
            memoryUsageMB: data.memoryUsageMB || 0,
            pipelineVersion: data.pipelineVersion || '2.0.0',
            qualityMetrics: data.qualityMetrics || {},
            ...data.metadata
        };
        
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 품질 점수 계산
    calculateQualityScore() {
        const metrics = {
            entityExtractionAccuracy: this.calculateEntityAccuracy(),
            temporalNormalizationAccuracy: this.calculateTemporalAccuracy(),
            completenessScore: this.calculateCompleteness(),
            consistencyScore: this.calculateConsistency()
        };

        this.qualityScore = Object.values(metrics).reduce((sum, score) => sum + score, 0) / Object.keys(metrics).length;
        this.metadata.qualityMetrics = metrics;
        
        return this.qualityScore;
    }

    calculateEntityAccuracy() {
        // 엔티티 추출 정확도 계산 로직
        const highConfidenceEntities = this.entities.filter(e => e.confidence >= 0.8).length;
        return highConfidenceEntities / Math.max(this.entities.length, 1);
    }

    calculateTemporalAccuracy() {
        // 시간 정규화 정확도 계산 로직
        const validDates = this.events.filter(e => e.dateConfidence >= 0.7).length;
        return validDates / Math.max(this.events.length, 1);
    }

    calculateCompleteness() {
        // 완전성 점수 계산 로직
        const hasEntities = this.entities.length > 0 ? 0.25 : 0;
        const hasEvents = this.events.length > 0 ? 0.25 : 0;
        const hasEvidence = this.evidence.length > 0 ? 0.25 : 0;
        const hasOriginalData = this.originalData.rawText.length > 0 ? 0.25 : 0;
        
        return hasEntities + hasEvents + hasEvidence + hasOriginalData;
    }

    calculateConsistency() {
        // 일관성 점수 계산 로직
        const avgConfidence = this.entities.reduce((sum, e) => sum + e.confidence, 0) / Math.max(this.entities.length, 1);
        return avgConfidence;
    }

    toJSON() {
        return {
            id: this.id,
            caseId: this.caseId,
            processingId: this.processingId,
            version: this.version,
            qualityScore: this.qualityScore,
            originalText: this.originalText,
            segments: this.segments.map(s => s.toJSON ? s.toJSON() : s),
            entities: this.entities.map(e => e.toJSON ? e.toJSON() : e),
            events: this.events.map(e => e.toJSON ? e.toJSON() : e),
            evidence: this.evidence.map(e => e.toJSON ? e.toJSON() : e),
            taggedBlocks: this.taggedBlocks.map(t => t.toJSON ? t.toJSON() : t),
            relevanceScores: this.relevanceScores.map(r => r.toJSON ? r.toJSON() : r),
            originalData: this.originalData,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

export {
    Segment,
    Event,
    Entity,
    Evidence,
    TaggedBlock,
    Relevance,
    CaseBundle
};