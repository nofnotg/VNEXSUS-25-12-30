/**
 * Standardized Output Formatter Module
 * 
 * 역할:
 * 1. 모든 출력 형식을 표준화하여 일관된 사용자 경험 제공
 * 2. JSON 스키마 기반 검증 및 구조화
 * 3. 다양한 출력 형식 지원 (JSON, HTML, PDF, Excel)
 * 4. 품질 지표 및 메타데이터 자동 생성
 * 5. 사용자 맞춤형 출력 옵션 제공
 */

import fs from 'fs/promises';
import path from 'path';

class StandardizedOutputFormatter {
    constructor(options = {}) {
        this.options = {
            enableValidation: options.enableValidation !== false,
            enableMetadata: options.enableMetadata !== false,
            defaultFormat: options.defaultFormat || 'json',
            qualityThreshold: options.qualityThreshold || 0.8,
            includeTimestamp: options.includeTimestamp !== false,
            ...options
        };

        // 표준 출력 스키마 정의
        this.standardSchemas = {
            medicalReport: {
                required: ['reportId', 'patientInfo', 'medicalRecords', 'summary', 'metadata'],
                types: {
                    reportId: 'string',
                    patientInfo: 'object',
                    medicalRecords: 'array',
                    summary: 'object',
                    metadata: 'object'
                }
            },
            progressReport: {
                required: ['caseId', 'processingStatus', 'qualityMetrics', 'results', 'timestamp'],
                types: {
                    caseId: 'string',
                    processingStatus: 'string',
                    qualityMetrics: 'object',
                    results: 'object',
                    timestamp: 'string'
                }
            },
            validationReport: {
                required: ['validationId', 'testResults', 'performance', 'recommendations'],
                types: {
                    validationId: 'string',
                    testResults: 'array',
                    performance: 'object',
                    recommendations: 'array'
                }
            }
        };

        // 출력 템플릿 정의
        this.outputTemplates = {
            medical: this._createMedicalTemplate(),
            progress: this._createProgressTemplate(),
            validation: this._createValidationTemplate(),
            summary: this._createSummaryTemplate()
        };
    }

    /**
     * 데이터 품질 개선
     * @param {Object} data 원본 데이터
     * @param {Object} options 옵션
     * @returns {Promise<Object>} 품질 개선 결과
     */
    async enhanceDataQuality(data, options = {}) {
        try {
            const enhancementOptions = { ...this.options, ...options };
            
            // 1. 데이터 정규화
            const normalizedData = await this._normalizeData(data, this._detectDataType(data));
            
            // 2. 품질 개선 적용
            const enhancedData = await this._enhanceQuality(normalizedData, enhancementOptions);
            
            // 3. 품질 점수 계산
            const qualityScore = this._calculateQualityScore(enhancedData);
            
            return {
                success: true,
                data: enhancedData,
                qualityScore: qualityScore,
                improvements: {
                    completeness: this._calculateCompleteness(enhancedData),
                    consistency: this._calculateConsistency(enhancedData),
                    accuracy: this._calculateAccuracy(enhancedData)
                },
                metadata: {
                    enhancedAt: new Date().toISOString(),
                    enhancer: 'StandardizedOutputFormatter',
                    version: '2.0.0'
                }
            };
            
        } catch (error) {
            console.error('Data quality enhancement failed:', error);
            return {
                success: false,
                error: error.message,
                qualityScore: 0,
                data: data
            };
        }
    }

    /**
     * 표준화된 출력 생성
     * @param {Object} data 원본 데이터
     * @param {Object} options 출력 옵션
     * @returns {Promise<Object>} 표준화된 출력
     */
    async generateStandardizedOutput(data, options = {}) {
        try {
            const outputOptions = { ...this.options, ...options };
            
            // 1. 데이터 타입 감지 및 스키마 선택
            const dataType = this._detectDataType(data);
            const schema = this.standardSchemas[dataType] || this.standardSchemas.medicalReport;
            
            // 2. 데이터 정규화 및 구조화
            const normalizedData = await this._normalizeData(data, dataType);
            
            // 3. 스키마 검증
            if (outputOptions.enableValidation) {
                const validation = this._validateSchema(normalizedData, schema);
                if (!validation.isValid) {
                    console.warn('Schema validation failed:', validation.errors);
                }
            }
            
            // 4. 메타데이터 생성
            const metadata = outputOptions.enableMetadata ? 
                await this._generateMetadata(normalizedData, outputOptions) : {};
            
            // 5. 표준 형식으로 변환
            const standardizedOutput = {
                ...normalizedData,
                metadata: {
                    ...normalizedData.metadata,
                    ...metadata,
                    formatVersion: '2.0.0',
                    generatedAt: new Date().toISOString(),
                    formatter: 'StandardizedOutputFormatter'
                }
            };
            
            // 6. 품질 검증 및 개선
            const qualityEnhanced = await this._enhanceQuality(standardizedOutput, outputOptions);
            
            // 7. 성공 응답 구조 반환
            return {
                success: true,
                data: qualityEnhanced,
                metadata: {
                    ...qualityEnhanced.metadata,
                    processingTime: Date.now() - (outputOptions.startTime || Date.now()),
                    outputFormat: outputOptions.format || this.options.defaultFormat
                }
            };
            
        } catch (error) {
            console.error('Standardized output generation failed:', error);
            return this._createErrorOutput(error, data);
        }
    }

    /**
     * 다중 형식 출력 생성
     * @param {Object} data 표준화된 데이터
     * @param {Array} formats 출력 형식 배열
     * @param {string} outputDir 출력 디렉토리
     * @returns {Promise<Object>} 생성된 파일 정보
     */
    async generateMultiFormatOutput(data, formats = ['json'], outputDir = './output') {
        const results = {};
        
        try {
            // 출력 디렉토리 생성
            await fs.mkdir(outputDir, { recursive: true });
            
            for (const format of formats) {
                const filename = `${data.metadata?.reportId || 'output'}_${Date.now()}.${format}`;
                const filepath = path.join(outputDir, filename);
                
                let content;
                switch (format.toLowerCase()) {
                    case 'json':
                        content = JSON.stringify(data, null, 2);
                        break;
                    case 'html':
                        content = await this._generateHtmlOutput(data);
                        break;
                    case 'txt':
                        content = await this._generateTextOutput(data);
                        break;
                    case 'csv':
                        content = await this._generateCsvOutput(data);
                        break;
                    default:
                        console.warn(`Unsupported format: ${format}`);
                        continue;
                }
                
                await fs.writeFile(filepath, content, 'utf8');
                results[format] = {
                    filename,
                    filepath,
                    size: Buffer.byteLength(content, 'utf8')
                };
            }
            
            return {
                success: true,
                outputDir,
                files: results,
                totalFiles: Object.keys(results).length
            };
            
        } catch (error) {
            console.error('Multi-format output generation failed:', error);
            return {
                success: false,
                error: error.message,
                files: results
            };
        }
    }

    /**
     * 데이터 타입 감지
     * @param {Object} data 입력 데이터
     * @returns {string} 데이터 타입
     * @private
     */
    _detectDataType(data) {
        if (data.normalizedReport || data.patientInfo) return 'medicalReport';
        if (data.processingStatus || data.qualityMetrics) return 'progressReport';
        if (data.testResults || data.validationResults) return 'validationReport';
        return 'medicalReport'; // 기본값
    }

    /**
     * 데이터 정규화
     * @param {Object} data 원본 데이터
     * @param {string} dataType 데이터 타입
     * @returns {Promise<Object>} 정규화된 데이터
     * @private
     */
    async _normalizeData(data, dataType) {
        const template = this.outputTemplates[dataType] || this.outputTemplates.medical;
        const normalized = JSON.parse(JSON.stringify(template));
        
        try {
            switch (dataType) {
                case 'medicalReport':
                    return this._normalizeMedicalData(data, normalized);
                case 'progressReport':
                    return this._normalizeProgressData(data, normalized);
                case 'validationReport':
                    return this._normalizeValidationData(data, normalized);
                default:
                    return this._normalizeMedicalData(data, normalized);
            }
        } catch (error) {
            console.error('Data normalization failed:', error);
            return normalized;
        }
    }

    /**
     * 의료 데이터 정규화
     * @param {Object} data 원본 데이터
     * @param {Object} template 템플릿
     * @returns {Object} 정규화된 데이터
     * @private
     */
    _normalizeMedicalData(data, template) {
        // 보고서 ID 생성
        template.reportId = data.reportId || `MED_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 환자 정보 정규화
        if (data.normalizedReport?.header || data.patientInfo) {
            const patientSource = data.normalizedReport?.header || data.patientInfo;
            template.patientInfo = {
                name: patientSource.patientName || patientSource.name || '미확인',
                birthDate: this._formatDate(patientSource.birthDate),
                registrationNumber: patientSource.registrationNumber || '미확인',
                gender: patientSource.gender || this._inferGender(patientSource.patientName || patientSource.name),
                age: this._calculateAge(patientSource.birthDate)
            };
        }
        
        // 의료 기록 정규화
        if (data.normalizedReport?.insuranceConditions || data.medicalRecords) {
            const records = data.normalizedReport?.insuranceConditions || data.medicalRecords || [];
            template.medicalRecords = records.map((record, index) => ({
                recordId: `REC_${index + 1}`,
                date: this._formatDate(record.date || record.visitDate),
                hospital: record.hospital || record.company || '미확인 기관',
                department: record.department || '미확인',
                diagnosis: record.diagnosis || record.condition || '미확인',
                treatment: record.treatment || record.procedure || '미확인',
                notes: record.notes || record.details || '',
                confidence: record.confidence || 0.8
            }));
        }
        
        // 요약 정보 생성
        template.summary = this._generateSummary(template.medicalRecords);
        
        return template;
    }

    /**
     * 진행 상황 데이터 정규화
     * @param {Object} data 원본 데이터
     * @param {Object} template 템플릿
     * @returns {Object} 정규화된 데이터
     * @private
     */
    _normalizeProgressData(data, template) {
        template.caseId = data.caseId || data.id || `CASE_${Date.now()}`;
        template.processingStatus = data.success ? 'completed' : 'failed';
        
        // 품질 지표 정규화
        template.qualityMetrics = {
            overallScore: data.qualityScore || data.overallScore || 0,
            dataCompleteness: data.dataCompleteness || 0,
            accuracyScore: data.accuracyScore || 0,
            consistencyScore: data.consistencyScore || 0,
            nanIssues: data.nanIssues || [],
            validationPassed: data.validationPassed || false
        };
        
        // 결과 데이터 정규화
        template.results = {
            processedItems: data.processedItems || 0,
            successfulItems: data.successfulItems || 0,
            failedItems: data.failedItems || 0,
            warnings: data.warnings || [],
            errors: data.errors || []
        };
        
        return template;
    }

    /**
     * 검증 데이터 정규화
     * @param {Object} data 원본 데이터
     * @param {Object} template 템플릿
     * @returns {Object} 정규화된 데이터
     * @private
     */
    _normalizeValidationData(data, template) {
        template.validationId = data.validationId || `VAL_${Date.now()}`;
        
        // 테스트 결과 정규화
        template.testResults = (data.testResults || []).map((test, index) => ({
            testId: test.testId || `TEST_${index + 1}`,
            testName: test.testName || test.name || '미확인 테스트',
            status: test.success ? 'passed' : 'failed',
            score: test.score || 0,
            details: test.details || test.message || '',
            executionTime: test.executionTime || 0
        }));
        
        // 성능 지표 정규화
        template.performance = {
            totalTests: template.testResults.length,
            passedTests: template.testResults.filter(t => t.status === 'passed').length,
            failedTests: template.testResults.filter(t => t.status === 'failed').length,
            averageScore: this._calculateAverageScore(template.testResults),
            totalExecutionTime: template.testResults.reduce((sum, t) => sum + t.executionTime, 0)
        };
        
        // 권장사항 생성
        template.recommendations = this._generateRecommendations(template.testResults);
        
        return template;
    }

    /**
     * 스키마 검증
     * @param {Object} data 검증할 데이터
     * @param {Object} schema 스키마
     * @returns {Object} 검증 결과
     * @private
     */
    _validateSchema(data, schema) {
        const errors = [];
        
        // 필수 필드 검증
        for (const field of schema.required) {
            if (!(field in data)) {
                errors.push(`Missing required field: ${field}`);
            } else if (schema.types[field]) {
                const expectedType = schema.types[field];
                const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
                if (actualType !== expectedType) {
                    errors.push(`Type mismatch for field ${field}: expected ${expectedType}, got ${actualType}`);
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 메타데이터 생성
     * @param {Object} data 데이터
     * @param {Object} options 옵션
     * @returns {Promise<Object>} 메타데이터
     * @private
     */
    async _generateMetadata(data, options) {
        return {
            processingTime: Date.now(),
            dataSize: JSON.stringify(data).length,
            qualityScore: this._calculateQualityScore(data),
            confidenceLevel: this._calculateConfidenceLevel(data),
            formatCompliance: this._checkFormatCompliance(data),
            userOptions: {
                format: options.defaultFormat,
                validation: options.enableValidation,
                threshold: options.qualityThreshold
            }
        };
    }

    /**
     * 품질 개선
     * @param {Object} data 데이터
     * @param {Object} options 옵션
     * @returns {Promise<Object>} 개선된 데이터
     * @private
     */
    async _enhanceQuality(data, options) {
        // NaN 값 처리
        const cleanedData = this._cleanNaNValues(data);
        
        // 데이터 완성도 개선
        const completedData = this._improveDataCompleteness(cleanedData);
        
        // 일관성 검증 및 수정
        const consistentData = this._improveConsistency(completedData);
        
        return consistentData;
    }

    /**
     * 의료 템플릿 생성
     * @returns {Object} 의료 템플릿
     * @private
     */
    _createMedicalTemplate() {
        return {
            reportId: null,
            patientInfo: {
                name: null,
                birthDate: null,
                registrationNumber: null,
                gender: null,
                age: null
            },
            medicalRecords: [],
            summary: {
                totalRecords: 0,
                dateRange: null,
                primaryDiagnoses: [],
                keyFindings: [],
                riskFactors: []
            },
            metadata: {}
        };
    }

    /**
     * 진행 상황 템플릿 생성
     * @returns {Object} 진행 상황 템플릿
     * @private
     */
    _createProgressTemplate() {
        return {
            caseId: null,
            processingStatus: 'pending',
            qualityMetrics: {
                overallScore: 0,
                dataCompleteness: 0,
                accuracyScore: 0,
                consistencyScore: 0,
                nanIssues: [],
                validationPassed: false
            },
            results: {
                processedItems: 0,
                successfulItems: 0,
                failedItems: 0,
                warnings: [],
                errors: []
            },
            timestamp: null,
            metadata: {}
        };
    }

    /**
     * 검증 템플릿 생성
     * @returns {Object} 검증 템플릿
     * @private
     */
    _createValidationTemplate() {
        return {
            validationId: null,
            testResults: [],
            performance: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                averageScore: 0,
                totalExecutionTime: 0
            },
            recommendations: [],
            metadata: {}
        };
    }

    /**
     * 요약 템플릿 생성
     * @returns {Object} 요약 템플릿
     * @private
     */
    _createSummaryTemplate() {
        return {
            summaryId: null,
            overview: {
                totalCases: 0,
                successRate: 0,
                averageQuality: 0,
                processingTime: 0
            },
            insights: [],
            trends: [],
            metadata: {}
        };
    }

    // 유틸리티 메서드들
    _formatDate(date) {
        if (!date) return null;
        try {
            return new Date(date).toISOString().split('T')[0];
        } catch {
            return date;
        }
    }

    _calculateAge(birthDate) {
        if (!birthDate) return null;
        try {
            const birth = new Date(birthDate);
            const today = new Date();
            return Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
        } catch {
            return null;
        }
    }

    _inferGender(name) {
        // 간단한 성별 추론 로직 (실제로는 더 정교한 로직 필요)
        return '미확인';
    }

    _generateSummary(records) {
        return {
            totalRecords: records.length,
            dateRange: this._calculateDateRange(records),
            primaryDiagnoses: this._extractPrimaryDiagnoses(records),
            keyFindings: this._extractKeyFindings(records),
            riskFactors: this._identifyRiskFactors(records)
        };
    }

    _calculateDateRange(records) {
        if (records.length === 0) return null;
        const dates = records.map(r => r.date).filter(d => d).sort();
        return dates.length > 0 ? `${dates[0]} ~ ${dates[dates.length - 1]}` : null;
    }

    _extractPrimaryDiagnoses(records) {
        const diagnoses = records.map(r => r.diagnosis).filter(d => d && d !== '미확인');
        return [...new Set(diagnoses)].slice(0, 5);
    }

    _extractKeyFindings(records) {
        return records.filter(r => r.notes && r.notes.length > 10)
                     .map(r => r.notes)
                     .slice(0, 3);
    }

    _identifyRiskFactors(records) {
        // 위험 요소 식별 로직
        return [];
    }

    _calculateAverageScore(testResults) {
        if (testResults.length === 0) return 0;
        return testResults.reduce((sum, test) => sum + test.score, 0) / testResults.length;
    }

    _generateRecommendations(testResults) {
        const recommendations = [];
        const failedTests = testResults.filter(t => t.status === 'failed');
        
        if (failedTests.length > 0) {
            recommendations.push(`${failedTests.length}개의 실패한 테스트를 검토하고 수정하세요.`);
        }
        
        const lowScoreTests = testResults.filter(t => t.score < 0.7);
        if (lowScoreTests.length > 0) {
            recommendations.push(`${lowScoreTests.length}개의 낮은 점수 테스트의 품질을 개선하세요.`);
        }
        
        return recommendations;
    }

    _calculateCompleteness(data) {
        // 데이터 완성도 계산
        let completeness = 0;
        let totalFields = 0;
        let filledFields = 0;

        if (data.patientInfo) {
            const patientFields = ['name', 'birthDate', 'registrationNumber', 'gender', 'age'];
            totalFields += patientFields.length;
            filledFields += patientFields.filter(field => data.patientInfo[field] && data.patientInfo[field] !== '미확인').length;
        }

        if (data.medicalRecords && Array.isArray(data.medicalRecords)) {
            totalFields += 1;
            if (data.medicalRecords.length > 0) filledFields += 1;
        }

        if (data.summary) {
            const summaryFields = ['totalRecords', 'dateRange', 'primaryDiagnoses'];
            totalFields += summaryFields.length;
            filledFields += summaryFields.filter(field => data.summary[field]).length;
        }

        return totalFields > 0 ? filledFields / totalFields : 0;
    }

    _calculateConsistency(data) {
        // 데이터 일관성 계산
        let consistencyScore = 1.0;

        // 날짜 일관성 검사
        if (data.medicalRecords && Array.isArray(data.medicalRecords)) {
            const dates = data.medicalRecords
                .map(record => record.date)
                .filter(date => date)
                .sort();
            
            if (dates.length > 1) {
                const dateRange = new Date(dates[dates.length - 1]) - new Date(dates[0]);
                if (dateRange < 0) consistencyScore -= 0.2; // 날짜 순서 오류
            }
        }

        // 환자 정보 일관성 검사
        if (data.patientInfo) {
            if (data.patientInfo.age && data.patientInfo.birthDate) {
                const calculatedAge = new Date().getFullYear() - new Date(data.patientInfo.birthDate).getFullYear();
                if (Math.abs(calculatedAge - data.patientInfo.age) > 1) {
                    consistencyScore -= 0.1; // 나이 불일치
                }
            }
        }

        return Math.max(consistencyScore, 0);
    }

    _calculateAccuracy(data) {
        // 데이터 정확성 계산
        let accuracyScore = 0.8; // 기본 정확성 점수

        // 의료 기록 정확성 검사
        if (data.medicalRecords && Array.isArray(data.medicalRecords)) {
            const recordsWithConfidence = data.medicalRecords.filter(record => record.confidence);
            if (recordsWithConfidence.length > 0) {
                const avgConfidence = recordsWithConfidence.reduce((sum, record) => sum + record.confidence, 0) / recordsWithConfidence.length;
                accuracyScore = (accuracyScore + avgConfidence) / 2;
            }
        }

        // 필수 필드 정확성 검사
        if (data.patientInfo?.registrationNumber && !/^\d{6}-\d{7}$/.test(data.patientInfo.registrationNumber)) {
            accuracyScore -= 0.1; // 주민번호 형식 오류
        }

        return Math.max(accuracyScore, 0);
     }

     _calculateQualityScore(data) {
        // 품질 점수 계산 로직
        let score = 0.5; // 기본 점수
        
        if (data.patientInfo?.name && data.patientInfo.name !== '미확인') score += 0.1;
        if (data.medicalRecords?.length > 0) score += 0.2;
        if (data.summary?.totalRecords > 0) score += 0.1;
        if (data.metadata) score += 0.1;
        
        return Math.min(score, 1.0);
    }

    _calculateConfidenceLevel(data) {
        // 신뢰도 계산 로직
        const records = data.medicalRecords || [];
        if (records.length === 0) return 0.5;
        
        const avgConfidence = records.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / records.length;
        return avgConfidence;
    }

    _checkFormatCompliance(data) {
        // 형식 준수 검사
        return {
            hasRequiredFields: !!(data.reportId && data.patientInfo),
            hasValidStructure: !!(data.medicalRecords && Array.isArray(data.medicalRecords)),
            hasMetadata: !!data.metadata
        };
    }

    _cleanNaNValues(data) {
        return JSON.parse(JSON.stringify(data, (key, value) => {
            if (typeof value === 'number' && isNaN(value)) {
                return null;
            }
            return value;
        }));
    }

    _improveDataCompleteness(data) {
        // 데이터 완성도 개선 로직
        if (data.patientInfo && !data.patientInfo.name) {
            data.patientInfo.name = '미확인 환자';
        }
        
        if (data.medicalRecords) {
            data.medicalRecords.forEach(record => {
                if (!record.hospital) record.hospital = '미확인 기관';
                if (!record.diagnosis) record.diagnosis = '미확인 진단';
            });
        }
        
        return data;
    }

    _improveConsistency(data) {
        // 일관성 개선 로직
        if (data.medicalRecords) {
            data.medicalRecords.forEach(record => {
                record.date = this._formatDate(record.date);
            });
        }
        
        return data;
    }

    _createErrorOutput(error, originalData) {
        return {
            success: false,
            error: {
                message: error.message,
                timestamp: new Date().toISOString()
            },
            originalData: originalData || null,
            metadata: {
                formatter: 'StandardizedOutputFormatter',
                version: '2.0.0',
                errorHandling: true
            }
        };
    }

    /**
     * HTML 출력 생성
     * @param {Object} data 데이터
     * @returns {Promise<string>} HTML 내용
     * @private
     */
    async _generateHtmlOutput(data) {
        return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>의료 보고서 - ${data.patientInfo?.name || '미확인'}</title>
    <style>
        body { font-family: 'Malgun Gothic', sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin-bottom: 20px; }
        .section h3 { color: #333; border-left: 4px solid #007bff; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .metadata { background-color: #f8f9fa; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>의료 보고서</h1>
        <p>보고서 ID: ${data.reportId}</p>
        <p>생성일: ${data.metadata?.generatedAt || new Date().toISOString()}</p>
    </div>
    
    <div class="section">
        <h3>환자 정보</h3>
        <table>
            <tr><th>환자명</th><td>${data.patientInfo?.name || '미확인'}</td></tr>
            <tr><th>생년월일</th><td>${data.patientInfo?.birthDate || '미확인'}</td></tr>
            <tr><th>등록번호</th><td>${data.patientInfo?.registrationNumber || '미확인'}</td></tr>
            <tr><th>성별</th><td>${data.patientInfo?.gender || '미확인'}</td></tr>
            <tr><th>나이</th><td>${data.patientInfo?.age || '미확인'}세</td></tr>
        </table>
    </div>
    
    <div class="section">
        <h3>의료 기록</h3>
        <table>
            <thead>
                <tr><th>날짜</th><th>병원</th><th>진단</th><th>치료</th><th>비고</th></tr>
            </thead>
            <tbody>
                ${(data.medicalRecords || []).map(record => `
                    <tr>
                        <td>${record.date || '미확인'}</td>
                        <td>${record.hospital || '미확인'}</td>
                        <td>${record.diagnosis || '미확인'}</td>
                        <td>${record.treatment || '미확인'}</td>
                        <td>${record.notes || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div class="section">
        <h3>요약</h3>
        <p>총 기록 수: ${data.summary?.totalRecords || 0}건</p>
        <p>기간: ${data.summary?.dateRange || '미확인'}</p>
        <p>주요 진단: ${(data.summary?.primaryDiagnoses || []).join(', ') || '없음'}</p>
    </div>
    
    <div class="metadata">
        <h3>메타데이터</h3>
        <p>품질 점수: ${data.metadata?.qualityScore || 0}</p>
        <p>신뢰도: ${data.metadata?.confidenceLevel || 0}</p>
        <p>포맷터: ${data.metadata?.formatter || 'Unknown'}</p>
    </div>
</body>
</html>`;
    }

    /**
     * 텍스트 출력 생성
     * @param {Object} data 데이터
     * @returns {Promise<string>} 텍스트 내용
     * @private
     */
    async _generateTextOutput(data) {
        const lines = [];
        
        lines.push('='.repeat(80));
        lines.push('의료 보고서');
        lines.push('='.repeat(80));
        lines.push(`보고서 ID: ${data.reportId}`);
        lines.push(`생성일: ${data.metadata?.generatedAt || new Date().toISOString()}`);
        lines.push('');
        
        lines.push('환자 정보');
        lines.push('-'.repeat(40));
        lines.push(`환자명: ${data.patientInfo?.name || '미확인'}`);
        lines.push(`생년월일: ${data.patientInfo?.birthDate || '미확인'}`);
        lines.push(`등록번호: ${data.patientInfo?.registrationNumber || '미확인'}`);
        lines.push('');
        
        lines.push('의료 기록');
        lines.push('-'.repeat(40));
        (data.medicalRecords || []).forEach((record, index) => {
            lines.push(`${index + 1}. [${record.date || '미확인'}] ${record.hospital || '미확인'}`);
            lines.push(`   진단: ${record.diagnosis || '미확인'}`);
            lines.push(`   치료: ${record.treatment || '미확인'}`);
            if (record.notes) lines.push(`   비고: ${record.notes}`);
            lines.push('');
        });
        
        lines.push('요약');
        lines.push('-'.repeat(40));
        lines.push(`총 기록 수: ${data.summary?.totalRecords || 0}건`);
        lines.push(`기간: ${data.summary?.dateRange || '미확인'}`);
        lines.push(`주요 진단: ${(data.summary?.primaryDiagnoses || []).join(', ') || '없음'}`);
        
        return lines.join('\n');
    }

    /**
     * CSV 출력 생성
     * @param {Object} data 데이터
     * @returns {Promise<string>} CSV 내용
     * @private
     */
    async _generateCsvOutput(data) {
        const headers = ['날짜', '병원', '진단', '치료', '비고', '신뢰도'];
        const rows = [headers.join(',')];
        
        (data.medicalRecords || []).forEach(record => {
            const row = [
                record.date || '',
                record.hospital || '',
                record.diagnosis || '',
                record.treatment || '',
                record.notes || '',
                record.confidence || ''
            ].map(field => `"${field.toString().replace(/"/g, '""')}"`);
            
            rows.push(row.join(','));
        });
        
        return rows.join('\n');
    }
}

export default StandardizedOutputFormatter;