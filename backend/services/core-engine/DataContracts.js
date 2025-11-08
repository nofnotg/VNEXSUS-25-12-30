// DataContracts.js - 코어 엔진 데이터 계약 및 인터페이스 정의

/**
 * 기본 엔티티 인터페이스
 */
class BaseEntity {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.type = data.type || 'unknown';
        this.confidence = data.confidence || 0;
        this.metadata = data.metadata || {};
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    generateId() {
        return `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            confidence: this.confidence,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * 시간적 앵커 (Temporal Anchor) 클래스
 */
class Anchor extends BaseEntity {
    constructor(data = {}) {
        super({ ...data, type: 'anchor' });
        
        // 필수 필드
        this.date = data.date || null; // Date 객체 또는 ISO 문자열
        this.dateString = data.dateString || ''; // 원본 날짜 문자열
        this.anchorType = data.anchorType || 'unknown'; // visit, admission, discharge, exam, surgery, etc.
        
        // 선택적 필드
        this.normalizedDate = data.normalizedDate || null;
        this.proximityScore = data.proximityScore || 0;
        this.context = data.context || '';
        this.textPosition = data.textPosition || { start: 0, end: 0 };
        this.isValidated = data.isValidated || false;
        this.validationErrors = data.validationErrors || [];
        
        // 관련 정보
        this.relatedEntities = data.relatedEntities || [];
        this.temporalRelations = data.temporalRelations || [];
    }

    /**
     * 날짜 유효성 검증
     */
    validateDate() {
        const errors = [];
        
        if (!this.date) {
            errors.push('날짜가 없습니다');
        } else {
            const date = new Date(this.date);
            if (isNaN(date.getTime())) {
                errors.push('유효하지 않은 날짜 형식입니다');
            } else {
                const now = new Date();
                const minDate = new Date('1900-01-01');
                
                if (date > now) {
                    errors.push('미래 날짜입니다');
                }
                if (date < minDate) {
                    errors.push('너무 과거 날짜입니다');
                }
            }
        }
        
        this.validationErrors = errors;
        this.isValidated = errors.length === 0;
        
        return this.isValidated;
    }

    /**
     * 다른 앵커와의 시간적 관계 계산
     */
    calculateTemporalRelation(otherAnchor) {
        if (!this.date || !otherAnchor.date) {
            return null;
        }

        const thisDate = new Date(this.date);
        const otherDate = new Date(otherAnchor.date);
        const diffMs = thisDate.getTime() - otherDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let relation = 'same';
        if (diffDays > 0) {
            relation = 'after';
        } else if (diffDays < 0) {
            relation = 'before';
        }

        return {
            relation,
            diffDays: Math.abs(diffDays),
            diffMs: Math.abs(diffMs),
            otherAnchorId: otherAnchor.id
        };
    }

    toJSON() {
        return {
            ...super.toJSON(),
            date: this.date,
            dateString: this.dateString,
            anchorType: this.anchorType,
            normalizedDate: this.normalizedDate,
            proximityScore: this.proximityScore,
            context: this.context,
            textPosition: this.textPosition,
            isValidated: this.isValidated,
            validationErrors: this.validationErrors,
            relatedEntities: this.relatedEntities,
            temporalRelations: this.temporalRelations
        };
    }
}

/**
 * 의료 엔티티 (Medical Entity) 클래스
 */
class MedicalEntity extends BaseEntity {
    constructor(data = {}) {
        super({ ...data, type: data.type || 'medical_entity' });
        
        // 필수 필드
        this.text = data.text || '';
        this.normalizedText = data.normalizedText || '';
        this.entityType = data.entityType || 'unknown'; // diagnosis, procedure, medication, anatomy, test
        
        // 선택적 필드
        this.codes = data.codes || {}; // ICD-10, SNOMED, etc.
        this.category = data.category || '';
        this.severity = data.severity || null;
        this.status = data.status || 'active'; // active, inactive, resolved
        this.textPosition = data.textPosition || { start: 0, end: 0 };
        
        // 시간적 연결
        this.anchors = data.anchors || [];
        this.temporalContext = data.temporalContext || null;
        
        // 관계
        this.relatedEntities = data.relatedEntities || [];
        this.evidenceTexts = data.evidenceTexts || [];
    }

    /**
     * 앵커와 연결
     */
    linkToAnchor(anchor, linkType = 'temporal', confidence = 1.0) {
        const link = {
            anchorId: anchor.id,
            linkType,
            confidence,
            createdAt: new Date().toISOString()
        };
        
        this.anchors.push(link);
        
        // 양방향 연결
        if (!anchor.relatedEntities.find(e => e.entityId === this.id)) {
            anchor.relatedEntities.push({
                entityId: this.id,
                linkType,
                confidence,
                createdAt: new Date().toISOString()
            });
        }
    }

    /**
     * 다른 엔티티와의 관계 설정
     */
    addRelation(otherEntity, relationType, confidence = 1.0) {
        const relation = {
            entityId: otherEntity.id,
            relationType,
            confidence,
            createdAt: new Date().toISOString()
        };
        
        this.relatedEntities.push(relation);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            text: this.text,
            normalizedText: this.normalizedText,
            entityType: this.entityType,
            codes: this.codes,
            category: this.category,
            severity: this.severity,
            status: this.status,
            textPosition: this.textPosition,
            anchors: this.anchors,
            temporalContext: this.temporalContext,
            relatedEntities: this.relatedEntities,
            evidenceTexts: this.evidenceTexts
        };
    }
}

/**
 * 진단 (Diagnosis) 클래스
 */
class Diagnosis extends MedicalEntity {
    constructor(data = {}) {
        super({ ...data, type: 'diagnosis', entityType: 'diagnosis' });
        
        this.diagnosisType = data.diagnosisType || 'primary'; // primary, secondary, differential
        this.icd10Code = data.icd10Code || '';
        this.snomedCode = data.snomedCode || '';
        this.isPrimary = data.isPrimary || false;
        this.isMetastasis = data.isMetastasis || false;
        this.anatomicalSite = data.anatomicalSite || '';
        this.stage = data.stage || null;
        this.grade = data.grade || null;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            diagnosisType: this.diagnosisType,
            icd10Code: this.icd10Code,
            snomedCode: this.snomedCode,
            isPrimary: this.isPrimary,
            isMetastasis: this.isMetastasis,
            anatomicalSite: this.anatomicalSite,
            stage: this.stage,
            grade: this.grade
        };
    }
}

/**
 * 시술/수술 (Procedure) 클래스
 */
class Procedure extends MedicalEntity {
    constructor(data = {}) {
        super({ ...data, type: 'procedure', entityType: 'procedure' });
        
        this.procedureType = data.procedureType || 'unknown'; // surgery, diagnostic, therapeutic
        this.cptCode = data.cptCode || '';
        this.kcdCode = data.kcdCode || '';
        this.anatomicalSite = data.anatomicalSite || '';
        this.approach = data.approach || ''; // open, laparoscopic, endoscopic
        this.outcome = data.outcome || '';
        this.complications = data.complications || [];
    }

    toJSON() {
        return {
            ...super.toJSON(),
            procedureType: this.procedureType,
            cptCode: this.cptCode,
            kcdCode: this.kcdCode,
            anatomicalSite: this.anatomicalSite,
            approach: this.approach,
            outcome: this.outcome,
            complications: this.complications
        };
    }
}

/**
 * 약물 (Medication) 클래스
 */
class Medication extends MedicalEntity {
    constructor(data = {}) {
        super({ ...data, type: 'medication', entityType: 'medication' });
        
        this.genericName = data.genericName || '';
        this.brandName = data.brandName || '';
        this.dosage = data.dosage || '';
        this.frequency = data.frequency || '';
        this.route = data.route || '';
        this.duration = data.duration || '';
        this.indication = data.indication || '';
        this.rxNormCode = data.rxNormCode || '';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            genericName: this.genericName,
            brandName: this.brandName,
            dosage: this.dosage,
            frequency: this.frequency,
            route: this.route,
            duration: this.duration,
            indication: this.indication,
            rxNormCode: this.rxNormCode
        };
    }
}

/**
 * 검사 (Test) 클래스
 */
class Test extends MedicalEntity {
    constructor(data = {}) {
        super({ ...data, type: 'test', entityType: 'test' });
        
        this.testType = data.testType || 'unknown'; // lab, imaging, pathology, function
        this.testName = data.testName || '';
        this.result = data.result || '';
        this.normalRange = data.normalRange || '';
        this.unit = data.unit || '';
        this.isAbnormal = data.isAbnormal || false;
        this.loincCode = data.loincCode || '';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            testType: this.testType,
            testName: this.testName,
            result: this.result,
            normalRange: this.normalRange,
            unit: this.unit,
            isAbnormal: this.isAbnormal,
            loincCode: this.loincCode
        };
    }
}

/**
 * 시간적 이벤트 (Temporal Event) 클래스
 */
class TemporalEvent extends BaseEntity {
    constructor(data = {}) {
        super({ ...data, type: 'temporal_event' });
        
        this.anchor = data.anchor || null; // Anchor 객체
        this.entities = data.entities || []; // MedicalEntity 배열
        this.eventType = data.eventType || 'unknown'; // visit, admission, procedure, etc.
        this.description = data.description || '';
        this.duration = data.duration || null; // 기간 (분 단위)
        this.location = data.location || '';
        
        // 시간적 관계
        this.precedingEvents = data.precedingEvents || [];
        this.followingEvents = data.followingEvents || [];
        this.concurrentEvents = data.concurrentEvents || [];
    }

    /**
     * 엔티티 추가
     */
    addEntity(entity) {
        if (!this.entities.find(e => e.id === entity.id)) {
            this.entities.push(entity);
            
            // 엔티티에 이벤트 정보 추가
            if (entity.temporalContext) {
                entity.temporalContext.eventId = this.id;
            } else {
                entity.temporalContext = { eventId: this.id };
            }
        }
    }

    /**
     * 시간적 관계 설정
     */
    addTemporalRelation(otherEvent, relationType) {
        const relation = {
            eventId: otherEvent.id,
            relationType, // before, after, concurrent, overlaps
            createdAt: new Date().toISOString()
        };

        switch (relationType) {
            case 'before':
                this.precedingEvents.push(relation);
                break;
            case 'after':
                this.followingEvents.push(relation);
                break;
            case 'concurrent':
            case 'overlaps':
                this.concurrentEvents.push(relation);
                break;
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            anchor: this.anchor ? this.anchor.toJSON() : null,
            entities: this.entities.map(e => e.toJSON()),
            eventType: this.eventType,
            description: this.description,
            duration: this.duration,
            location: this.location,
            precedingEvents: this.precedingEvents,
            followingEvents: this.followingEvents,
            concurrentEvents: this.concurrentEvents
        };
    }
}

/**
 * 타임라인 (Timeline) 클래스
 */
class Timeline extends BaseEntity {
    constructor(data = {}) {
        super({ ...data, type: 'timeline' });
        
        this.events = data.events || []; // TemporalEvent 배열
        this.startDate = data.startDate || null;
        this.endDate = data.endDate || null;
        this.totalDuration = data.totalDuration || null;
        this.eventCount = data.eventCount || 0;
        
        // 타임라인 메타데이터
        this.patientId = data.patientId || '';
        this.timelineType = data.timelineType || 'medical'; // medical, treatment, diagnostic
        this.isValidated = data.isValidated || false;
        this.validationErrors = data.validationErrors || [];
    }

    /**
     * 이벤트 추가 (시간순 정렬)
     */
    addEvent(event) {
        this.events.push(event);
        this.sortEventsByDate();
        this.updateMetadata();
    }

    /**
     * 이벤트를 날짜순으로 정렬
     */
    sortEventsByDate() {
        this.events.sort((a, b) => {
            const dateA = a.anchor ? new Date(a.anchor.date) : new Date(0);
            const dateB = b.anchor ? new Date(b.anchor.date) : new Date(0);
            return dateA.getTime() - dateB.getTime();
        });
    }

    /**
     * 타임라인 메타데이터 업데이트
     */
    updateMetadata() {
        this.eventCount = this.events.length;
        
        if (this.events.length > 0) {
            const dates = this.events
                .filter(e => e.anchor && e.anchor.date)
                .map(e => new Date(e.anchor.date));
                
            if (dates.length > 0) {
                this.startDate = new Date(Math.min(...dates));
                this.endDate = new Date(Math.max(...dates));
                this.totalDuration = this.endDate.getTime() - this.startDate.getTime();
            }
        }
    }

    /**
     * 타임라인 유효성 검증
     */
    validate() {
        const errors = [];
        
        // 이벤트 날짜 순서 검증
        for (let i = 1; i < this.events.length; i++) {
            const prevEvent = this.events[i - 1];
            const currEvent = this.events[i];
            
            if (prevEvent.anchor && currEvent.anchor) {
                const prevDate = new Date(prevEvent.anchor.date);
                const currDate = new Date(currEvent.anchor.date);
                
                if (prevDate > currDate) {
                    errors.push(`이벤트 순서 오류: ${prevEvent.id} > ${currEvent.id}`);
                }
            }
        }
        
        // 중복 이벤트 검증
        const eventIds = this.events.map(e => e.id);
        const uniqueIds = [...new Set(eventIds)];
        if (eventIds.length !== uniqueIds.length) {
            errors.push('중복된 이벤트가 있습니다');
        }
        
        this.validationErrors = errors;
        this.isValidated = errors.length === 0;
        
        return this.isValidated;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            events: this.events.map(e => e.toJSON()),
            startDate: this.startDate,
            endDate: this.endDate,
            totalDuration: this.totalDuration,
            eventCount: this.eventCount,
            patientId: this.patientId,
            timelineType: this.timelineType,
            isValidated: this.isValidated,
            validationErrors: this.validationErrors
        };
    }
}

/**
 * 파이프라인 데이터 컨테이너
 */
class PipelineData {
    constructor(data = {}) {
        // 원본 입력
        this.originalText = data.originalText || '';
        this.textSegments = data.textSegments || [];
        
        // 처리된 데이터
        this.anchors = data.anchors || [];
        this.entities = data.entities || [];
        this.events = data.events || [];
        this.timeline = data.timeline || null;
        
        // 분석 결과
        this.diseaseRules = data.diseaseRules || [];
        this.disclosureAnalysis = data.disclosureAnalysis || null;
        this.confidenceScores = data.confidenceScores || {};
        this.evidenceBindings = data.evidenceBindings || [];
        
        // 최종 결과
        this.skeletonJson = data.skeletonJson || null;
        
        // 메타데이터
        this.processingStage = data.processingStage || 'INIT';
        this.qualityGate = data.qualityGate || 'standard';
        this.processingStartTime = data.processingStartTime || new Date().toISOString();
        this.processingEndTime = data.processingEndTime || null;
        this.errors = data.errors || [];
        this.warnings = data.warnings || [];
    }

    /**
     * 앵커 추가
     */
    addAnchor(anchor) {
        if (anchor instanceof Anchor) {
            this.anchors.push(anchor);
        } else {
            this.anchors.push(new Anchor(anchor));
        }
    }

    /**
     * 엔티티 추가
     */
    addEntity(entity) {
        if (entity instanceof MedicalEntity) {
            this.entities.push(entity);
        } else {
            // 타입에 따라 적절한 클래스 생성
            switch (entity.entityType) {
                case 'diagnosis':
                    this.entities.push(new Diagnosis(entity));
                    break;
                case 'procedure':
                    this.entities.push(new Procedure(entity));
                    break;
                case 'medication':
                    this.entities.push(new Medication(entity));
                    break;
                case 'test':
                    this.entities.push(new Test(entity));
                    break;
                default:
                    this.entities.push(new MedicalEntity(entity));
            }
        }
    }

    /**
     * 이벤트 추가
     */
    addEvent(event) {
        if (event instanceof TemporalEvent) {
            this.events.push(event);
        } else {
            this.events.push(new TemporalEvent(event));
        }
    }

    /**
     * 타임라인 설정
     */
    setTimeline(timeline) {
        if (timeline instanceof Timeline) {
            this.timeline = timeline;
        } else {
            this.timeline = new Timeline(timeline);
        }
    }

    /**
     * 에러 추가
     */
    addError(error, stage = null) {
        this.errors.push({
            message: error.message || error,
            stage: stage || this.processingStage,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 경고 추가
     */
    addWarning(warning, stage = null) {
        this.warnings.push({
            message: warning.message || warning,
            stage: stage || this.processingStage,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 처리 단계 업데이트
     */
    updateStage(stage) {
        this.processingStage = stage;
    }

    /**
     * 처리 완료
     */
    markComplete() {
        this.processingEndTime = new Date().toISOString();
        this.processingStage = 'COMPLETE';
    }

    /**
     * JSON 직렬화
     */
    toJSON() {
        return {
            originalText: this.originalText,
            textSegments: this.textSegments,
            anchors: this.anchors.map(a => a.toJSON()),
            entities: this.entities.map(e => e.toJSON()),
            events: this.events.map(e => e.toJSON()),
            timeline: this.timeline ? this.timeline.toJSON() : null,
            diseaseRules: this.diseaseRules,
            disclosureAnalysis: this.disclosureAnalysis,
            confidenceScores: this.confidenceScores,
            evidenceBindings: this.evidenceBindings,
            skeletonJson: this.skeletonJson,
            processingStage: this.processingStage,
            qualityGate: this.qualityGate,
            processingStartTime: this.processingStartTime,
            processingEndTime: this.processingEndTime,
            errors: this.errors,
            warnings: this.warnings
        };
    }
}

/**
 * 팩토리 함수들
 */
const DataFactory = {
    /**
     * 앵커 생성
     */
    createAnchor(data) {
        return new Anchor(data);
    },

    /**
     * 엔티티 생성 (타입별)
     */
    createEntity(data) {
        switch (data.entityType) {
            case 'diagnosis':
                return new Diagnosis(data);
            case 'procedure':
                return new Procedure(data);
            case 'medication':
                return new Medication(data);
            case 'test':
                return new Test(data);
            default:
                return new MedicalEntity(data);
        }
    },

    /**
     * 이벤트 생성
     */
    createEvent(data) {
        return new TemporalEvent(data);
    },

    /**
     * 타임라인 생성
     */
    createTimeline(data) {
        return new Timeline(data);
    },

    /**
     * 파이프라인 데이터 생성
     */
    createPipelineData(data) {
        return new PipelineData(data);
    }
};

/**
 * 유효성 검증 유틸리티
 */
const ValidationUtils = {
    /**
     * 앵커 유효성 검증
     */
    validateAnchor(anchor) {
        if (!(anchor instanceof Anchor)) {
            return { valid: false, errors: ['앵커 객체가 아닙니다'] };
        }
        
        return { 
            valid: anchor.validateDate(), 
            errors: anchor.validationErrors 
        };
    },

    /**
     * 엔티티 유효성 검증
     */
    validateEntity(entity) {
        const errors = [];
        
        if (!(entity instanceof MedicalEntity)) {
            errors.push('의료 엔티티 객체가 아닙니다');
        } else {
            if (!entity.text) {
                errors.push('텍스트가 없습니다');
            }
            if (!entity.entityType) {
                errors.push('엔티티 타입이 없습니다');
            }
            if (entity.confidence < 0 || entity.confidence > 1) {
                errors.push('신뢰도는 0과 1 사이여야 합니다');
            }
        }
        
        return { valid: errors.length === 0, errors };
    },

    /**
     * 타임라인 유효성 검증
     */
    validateTimeline(timeline) {
        if (!(timeline instanceof Timeline)) {
            return { valid: false, errors: ['타임라인 객체가 아닙니다'] };
        }
        
        return { 
            valid: timeline.validate(), 
            errors: timeline.validationErrors 
        };
    }
};

// ES 모듈 export
export {
    // 클래스들
    BaseEntity,
    Anchor,
    MedicalEntity,
    Diagnosis,
    Procedure,
    Medication,
    Test,
    TemporalEvent,
    Timeline,
    PipelineData,
    
    // 유틸리티들
    DataFactory,
    ValidationUtils
};