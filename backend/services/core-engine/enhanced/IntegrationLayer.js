// IntegrationLayer.js - 기존 시스템과의 통합 레이어
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { logService } from '../../../utils/logger.js';

class IntegrationLayer {
    constructor(options = {}) {
        this.options = {
            enableLegacySupport: options.enableLegacySupport !== false,
            enableDataMigration: options.enableDataMigration !== false,
            enableFormatConversion: options.enableFormatConversion !== false,
            enableAPIBridge: options.enableAPIBridge !== false,
            migrationBatchSize: options.migrationBatchSize || 10,
            ...options
        };

        // 기존 시스템 참조
        this.legacySystem = null;
        this.enhancedSystem = null;

        // 데이터 변환 매핑
        this.conversionMappings = this.initializeConversionMappings();
        
        // API 브리지 설정
        this.apiBridge = this.initializeAPIBridge();
        
        // 마이그레이션 상태
        this.migrationState = {
            inProgress: false,
            completed: 0,
            total: 0,
            errors: [],
            startTime: null,
            endTime: null
        };

        logService.info('IntegrationLayer initialized', { 
            options: this.options 
        });
    }

    /**
     * 시스템 참조 설정
     * @param {Object} legacySystem - 기존 시스템
     * @param {Object} enhancedSystem - 향상된 시스템
     */
    setSystemReferences(legacySystem, enhancedSystem) {
        this.legacySystem = legacySystem;
        this.enhancedSystem = enhancedSystem;
        
        logService.info('System references set');
    }

    /**
     * 기존 데이터를 새 형식으로 변환
     * @param {Object} legacyData - 기존 형식 데이터
     * @param {string} dataType - 데이터 타입
     * @returns {Promise<Object>} 변환된 데이터
     */
    async convertLegacyData(legacyData, dataType) {
        try {
            const startTime = Date.now();
            
            // 1. 데이터 타입 확인
            if (!this.conversionMappings[dataType]) {
                throw new Error(`Unsupported data type: ${dataType}`);
            }

            // 2. 변환 수행
            const converter = this.conversionMappings[dataType];
            const convertedData = await converter.convert(legacyData);

            // 3. 검증
            const validationResult = await this.validateConvertedData(convertedData, dataType);
            if (!validationResult.isValid) {
                throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
            }

            const processingTime = Date.now() - startTime;

            logService('IntegrationLayer', 'Legacy data converted', 'info', {
                dataType: dataType,
                originalSize: JSON.stringify(legacyData).length,
                convertedSize: JSON.stringify(convertedData).length,
                processingTime
            });

            return convertedData;

        } catch (error) {
            logService('IntegrationLayer', 'Legacy data conversion failed', 'error', { 
                dataType: dataType,
                error: error.message 
            });
            throw new Error(`Legacy data conversion failed: ${error.message}`);
        }
    }

    /**
     * 새 데이터를 기존 형식으로 변환
     * @param {Object} enhancedData - 새 형식 데이터
     * @param {string} dataType - 데이터 타입
     * @returns {Promise<Object>} 변환된 데이터
     */
    async convertToLegacyFormat(enhancedData, dataType) {
        try {
            const startTime = Date.now();
            
            // 1. 데이터 타입 확인
            if (!this.conversionMappings[dataType]) {
                throw new Error(`Unsupported data type: ${dataType}`);
            }

            // 2. 역변환 수행
            const converter = this.conversionMappings[dataType];
            const legacyData = await converter.convertBack(enhancedData);

            // 3. 기존 시스템 호환성 확인
            const compatibilityResult = await this.checkLegacyCompatibility(legacyData, dataType);
            if (!compatibilityResult.isCompatible) {
                logService('IntegrationLayer', 'Legacy compatibility warning', 'warn', {
                    dataType: dataType,
                    warnings: compatibilityResult.warnings
                });
            }

            const processingTime = Date.now() - startTime;

            logService('IntegrationLayer', 'Enhanced data converted to legacy format', 'info', {
                dataType: dataType,
                processingTime
            });

            return legacyData;

        } catch (error) {
            logService('IntegrationLayer', 'Enhanced to legacy conversion failed', 'error', { 
                dataType: dataType,
                error: error.message 
            });
            throw new Error(`Enhanced to legacy conversion failed: ${error.message}`);
        }
    }

    /**
     * 배치 데이터 마이그레이션
     * @param {Array} legacyDataBatch - 기존 데이터 배치
     * @param {string} dataType - 데이터 타입
     * @returns {Promise<Object>} 마이그레이션 결과
     */
    async migrateBatchData(legacyDataBatch, dataType) {
        try {
            if (this.migrationState.inProgress) {
                throw new Error('Migration already in progress');
            }

            this.migrationState.inProgress = true;
            this.migrationState.startTime = Date.now();
            this.migrationState.total = legacyDataBatch.length;
            this.migrationState.completed = 0;
            this.migrationState.errors = [];

            const results = {
                successful: [],
                failed: [],
                totalProcessed: 0,
                processingTime: 0
            };

            // 배치 단위로 처리
            for (let i = 0; i < legacyDataBatch.length; i += this.options.migrationBatchSize) {
                const batch = legacyDataBatch.slice(i, i + this.options.migrationBatchSize);
                
                for (const item of batch) {
                    try {
                        const convertedData = await this.convertLegacyData(item, dataType);
                        results.successful.push({
                            original: item,
                            converted: convertedData
                        });
                        this.migrationState.completed++;
                    } catch (error) {
                        results.failed.push({
                            original: item,
                            error: error.message
                        });
                        this.migrationState.errors.push(error.message);
                    }
                }

                results.totalProcessed = results.successful.length + results.failed.length;
                
                // 진행률 로깅
                const progress = (this.migrationState.completed / this.migrationState.total) * 100;
                logService('IntegrationLayer', 'Migration progress', 'info', {
                    progress: Math.round(progress),
                    completed: this.migrationState.completed,
                    total: this.migrationState.total
                });
            }

            this.migrationState.endTime = Date.now();
            this.migrationState.inProgress = false;
            results.processingTime = this.migrationState.endTime - this.migrationState.startTime;

            logService('IntegrationLayer', 'Batch migration completed', 'info', {
                successful: results.successful.length,
                failed: results.failed.length,
                totalProcessed: results.totalProcessed,
                processingTime: results.processingTime
            });

            return results;

        } catch (error) {
            this.migrationState.inProgress = false;
            logService('IntegrationLayer', 'Batch migration failed', 'error', { 
                error: error.message 
            });
            throw new Error(`Batch migration failed: ${error.message}`);
        }
    }

    /**
     * API 호출 ��리지
     * @param {string} method - HTTP 메서드
     * @param {string} endpoint - 엔드포인트
     * @param {Object} data - 요청 데이터
     * @param {Object} options - 옵션
     * @returns {Promise<Object>} 응답 데이터
     */
    async bridgeAPICall(method, endpoint, data = null, options = {}) {
        try {
            const startTime = Date.now();
            
            // 1. 요청 데이터 변환 (필요한 경우)
            let processedData = data;
            if (data && options.convertToLegacy) {
                processedData = await this.convertToLegacyFormat(data, options.dataType || 'generic');
            }

            // 2. API 호출 수행
            const response = await this.performAPICall(method, endpoint, processedData, options);

            // 3. 응답 데이터 변환 (필요한 경우)
            let processedResponse = response;
            if (response && options.convertFromLegacy) {
                processedResponse = await this.convertLegacyData(response, options.dataType || 'generic');
            }

            const processingTime = Date.now() - startTime;

            logService('IntegrationLayer', 'API call bridged', 'info', {
                method: method,
                endpoint: endpoint,
                processingTime
            });

            return processedResponse;

        } catch (error) {
            logService('IntegrationLayer', 'API bridge call failed', 'error', { 
                method: method,
                endpoint: endpoint,
                error: error.message 
            });
            throw new Error(`API bridge call failed: ${error.message}`);
        }
    }

    /**
     * 시스템 호환성 확인
     * @param {Object} data - 확인할 데이터
     * @param {string} targetSystem - 대상 시스템 ('legacy' | 'enhanced')
     * @returns {Promise<Object>} 호환성 결과
     */
    async checkSystemCompatibility(data, targetSystem) {
        try {
            const compatibilityResult = {
                isCompatible: true,
                warnings: [],
                errors: [],
                recommendations: []
            };

            if (targetSystem === 'legacy') {
                // 기존 시스템 호환성 확인
                const legacyCheck = await this.checkLegacyCompatibility(data, 'generic');
                compatibilityResult.isCompatible = legacyCheck.isCompatible;
                compatibilityResult.warnings = legacyCheck.warnings;
                compatibilityResult.errors = legacyCheck.errors;
            } else if (targetSystem === 'enhanced') {
                // 향상된 시스템 호환성 확인
                const enhancedCheck = await this.checkEnhancedCompatibility(data);
                compatibilityResult.isCompatible = enhancedCheck.isCompatible;
                compatibilityResult.warnings = enhancedCheck.warnings;
                compatibilityResult.errors = enhancedCheck.errors;
            }

            // 추천사항 생성
            compatibilityResult.recommendations = this.generateCompatibilityRecommendations(
                compatibilityResult, targetSystem
            );

            return compatibilityResult;

        } catch (error) {
            logService.error('IntegrationLayer', 'Compatibility check failed', { 
                targetSystem: targetSystem,
                error: error.message 
            });
            throw new Error(`Compatibility check failed: ${error.message}`);
        }
    }

    /**
     * 데이터 동기화
     * @param {string} direction - 동기화 방향 ('legacy_to_enhanced' | 'enhanced_to_legacy' | 'bidirectional')
     * @param {Array} dataItems - 동기화할 데이터 항목
     * @returns {Promise<Object>} 동기화 결과
     */
    async synchronizeData(direction, dataItems) {
        try {
            const syncResult = {
                synchronized: [],
                conflicts: [],
                errors: [],
                totalProcessed: 0
            };

            for (const item of dataItems) {
                try {
                    let syncedItem;
                    
                    switch (direction) {
                        case 'legacy_to_enhanced':
                            syncedItem = await this.syncLegacyToEnhanced(item);
                            break;
                        case 'enhanced_to_legacy':
                            syncedItem = await this.syncEnhancedToLegacy(item);
                            break;
                        case 'bidirectional':
                            syncedItem = await this.syncBidirectional(item);
                            break;
                        default:
                            throw new Error(`Unsupported sync direction: ${direction}`);
                    }

                    syncResult.synchronized.push(syncedItem);
                } catch (error) {
                    if (error.message.includes('conflict')) {
                        syncResult.conflicts.push({
                            item: item,
                            error: error.message
                        });
                    } else {
                        syncResult.errors.push({
                            item: item,
                            error: error.message
                        });
                    }
                }
                
                syncResult.totalProcessed++;
            }

            logService('IntegrationLayer', 'Data synchronization completed', 'info', {
                direction: direction,
                synchronized: syncResult.synchronized.length,
                conflicts: syncResult.conflicts.length,
                errors: syncResult.errors.length,
                totalProcessed: syncResult.totalProcessed
            });

            return syncResult;

        } catch (error) {
            logService('IntegrationLayer', 'Data synchronization failed', 'error', { 
                direction: direction,
                error: error.message 
            });
            throw new Error(`Data synchronization failed: ${error.message}`);
        }
    }

    /**
     * 변환 매핑 초기화
     */
    initializeConversionMappings() {
        return {
            caseBundle: {
                convert: async (legacyData) => {
                    // 기존 케이스 데이터를 새 CaseBundle 형식으로 변환
                    return {
                        caseId: legacyData.id || legacyData.caseId,
                        originalText: legacyData.text || legacyData.content,
                        segments: await this.convertLegacySegments(legacyData.segments || []),
                        entities: await this.convertLegacyEntities(legacyData.entities || []),
                        events: await this.convertLegacyEvents(legacyData.events || []),
                        metadata: {
                            ...legacyData.metadata,
                            convertedFrom: 'legacy',
                            conversionTimestamp: new Date().toISOString()
                        }
                    };
                },
                convertBack: async (enhancedData) => {
                    // 새 CaseBundle을 기존 형식으로 변환
                    return {
                        id: enhancedData.caseId,
                        text: enhancedData.originalText,
                        segments: await this.convertEnhancedSegments(enhancedData.segments),
                        entities: await this.convertEnhancedEntities(enhancedData.entities),
                        events: await this.convertEnhancedEvents(enhancedData.events),
                        metadata: enhancedData.metadata
                    };
                }
            },
            entity: {
                convert: async (legacyEntity) => {
                    return {
                        id: legacyEntity.id || this.generateEntityId(),
                        type: this.mapLegacyEntityType(legacyEntity.type),
                        text: legacyEntity.text || legacyEntity.value,
                        normalizedText: legacyEntity.normalizedText || legacyEntity.text,
                        confidence: legacyEntity.confidence || 0.5,
                        startIndex: legacyEntity.startIndex || 0,
                        endIndex: legacyEntity.endIndex || 0,
                        attributes: legacyEntity.attributes || {},
                        evidence: legacyEntity.evidence || []
                    };
                },
                convertBack: async (enhancedEntity) => {
                    return {
                        id: enhancedEntity.id,
                        type: this.mapEnhancedEntityType(enhancedEntity.type),
                        text: enhancedEntity.text,
                        normalizedText: enhancedEntity.normalizedText,
                        confidence: enhancedEntity.confidence,
                        startIndex: enhancedEntity.startIndex,
                        endIndex: enhancedEntity.endIndex,
                        attributes: enhancedEntity.attributes
                    };
                }
            },
            event: {
                convert: async (legacyEvent) => {
                    return {
                        id: legacyEvent.id || this.generateEventId(),
                        type: legacyEvent.type || 'unknown',
                        description: legacyEvent.description || legacyEvent.text,
                        date: legacyEvent.date,
                        normalizedDate: legacyEvent.normalizedDate || legacyEvent.date,
                        confidence: legacyEvent.confidence || 0.5,
                        entities: legacyEvent.entities || [],
                        attributes: legacyEvent.attributes || {}
                    };
                },
                convertBack: async (enhancedEvent) => {
                    return {
                        id: enhancedEvent.id,
                        type: enhancedEvent.type,
                        description: enhancedEvent.description,
                        date: enhancedEvent.date,
                        normalizedDate: enhancedEvent.normalizedDate,
                        confidence: enhancedEvent.confidence,
                        entities: enhancedEvent.entities
                    };
                }
            }
        };
    }

    /**
     * API 브리지 초기화
     */
    initializeAPIBridge() {
        return {
            endpoints: new Map(),
            middleware: [],
            errorHandlers: new Map()
        };
    }

    /**
     * 변환된 데이터 검증
     */
    async validateConvertedData(data, dataType) {
        const validationResult = {
            isValid: true,
            errors: []
        };

        try {
            switch (dataType) {
                case 'caseBundle':
                    if (!data.caseId) validationResult.errors.push('Missing caseId');
                    if (!data.originalText) validationResult.errors.push('Missing originalText');
                    if (!Array.isArray(data.segments)) validationResult.errors.push('Invalid segments');
                    break;
                case 'entity':
                    if (!data.id) validationResult.errors.push('Missing entity id');
                    if (!data.type) validationResult.errors.push('Missing entity type');
                    if (!data.text) validationResult.errors.push('Missing entity text');
                    break;
                case 'event':
                    if (!data.id) validationResult.errors.push('Missing event id');
                    if (!data.description) validationResult.errors.push('Missing event description');
                    break;
            }

            validationResult.isValid = validationResult.errors.length === 0;

        } catch (error) {
            validationResult.isValid = false;
            validationResult.errors.push(`Validation error: ${error.message}`);
        }

        return validationResult;
    }

    /**
     * 기존 시스템 호환성 확인
     */
    async checkLegacyCompatibility(data, dataType) {
        const compatibilityResult = {
            isCompatible: true,
            warnings: [],
            errors: []
        };

        // 기존 시스템의 제약사항 확인
        if (dataType === 'caseBundle') {
            if (data.segments && data.segments.length > 100) {
                compatibilityResult.warnings.push('Too many segments for legacy system');
            }
            
            if (data.entities && data.entities.some(e => e.type.includes('enhanced_'))) {
                compatibilityResult.warnings.push('Enhanced entity types may not be supported');
            }
        }

        return compatibilityResult;
    }

    /**
     * 향상된 시스템 호환성 확인
     */
    async checkEnhancedCompatibility(data) {
        const compatibilityResult = {
            isCompatible: true,
            warnings: [],
            errors: []
        };

        // 향상된 시스템의 요구사항 확인
        if (!data.metadata) {
            compatibilityResult.warnings.push('Missing metadata for enhanced system');
        }

        return compatibilityResult;
    }

    /**
     * 호환성 추천사항 생성
     */
    generateCompatibilityRecommendations(compatibilityResult, targetSystem) {
        const recommendations = [];

        if (!compatibilityResult.isCompatible) {
            recommendations.push({
                priority: 'high',
                description: `${targetSystem} 시스템과 호환되지 않습니다. 데이터 변환이 필요합니다.`
            });
        }

        for (const warning of compatibilityResult.warnings) {
            recommendations.push({
                priority: 'medium',
                description: `경고: ${warning}`
            });
        }

        return recommendations;
    }

    /**
     * API 호출 수행
     */
    async performAPICall(method, endpoint, data, options) {
        // 실제 구현에서는 HTTP 클라이언트 사용
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({ success: true, data: data });
            }, 100);
        });
    }

    /**
     * 헬퍼 메서드들
     */
    async convertLegacySegments(legacySegments) {
        return legacySegments.map(segment => ({
            id: segment.id || this.generateSegmentId(),
            text: segment.text,
            startIndex: segment.startIndex || 0,
            endIndex: segment.endIndex || segment.text.length,
            confidence: segment.confidence || 0.5,
            context: segment.context || {},
            medicalDomain: segment.medicalDomain || null
        }));
    }

    async convertLegacyEntities(legacyEntities) {
        return Promise.all(legacyEntities.map(entity => 
            this.conversionMappings.entity.convert(entity)
        ));
    }

    async convertLegacyEvents(legacyEvents) {
        return Promise.all(legacyEvents.map(event => 
            this.conversionMappings.event.convert(event)
        ));
    }

    mapLegacyEntityType(legacyType) {
        const typeMapping = {
            'diagnosis': 'medical_diagnosis',
            'procedure': 'medical_procedure',
            'medication': 'medical_medication',
            'symptom': 'medical_symptom'
        };
        return typeMapping[legacyType] || legacyType;
    }

    mapEnhancedEntityType(enhancedType) {
        const typeMapping = {
            'medical_diagnosis': 'diagnosis',
            'medical_procedure': 'procedure',
            'medical_medication': 'medication',
            'medical_symptom': 'symptom'
        };
        return typeMapping[enhancedType] || enhancedType;
    }

    generateEntityId() {
        return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSegmentId() {
        return `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 동기화 메서드들
     */
    async syncLegacyToEnhanced(item) {
        const convertedItem = await this.convertLegacyData(item, 'caseBundle');
        // 향상된 시스템에 저장
        return convertedItem;
    }

    async syncEnhancedToLegacy(item) {
        const convertedItem = await this.convertToLegacyFormat(item, 'caseBundle');
        // 기존 시스템에 저장
        return convertedItem;
    }

    async syncBidirectional(item) {
        // 양방향 동기화 로직
        const conflicts = await this.detectConflicts(item);
        if (conflicts.length > 0) {
            throw new Error(`Sync conflict detected: ${conflicts.join(', ')}`);
        }
        
        return item;
    }

    async detectConflicts(item) {
        // 충돌 감지 로직
        return [];
    }

    /**
     * 마이그레이션 상태 조회
     */
    getMigrationState() {
        return this.migrationState;
    }

    /**
     * 리소스 정리
     */
    cleanup() {
        this.conversionMappings = {};
        this.apiBridge.endpoints.clear();
        this.apiBridge.errorHandlers.clear();
        
        logService('IntegrationLayer', 'IntegrationLayer cleanup completed', 'info');
    }
}

export default IntegrationLayer;