/**
 * Enhanced Extractors Module v2.1.0
 * 
 * 보고서 생성 품질 개선을 위한 향상된 추출기 모듈
 * 
 * 주요 기능:
 * 1. ExtractorAdapter: MedicalEntityExtractor와 nineItemReportGenerator 연결
 * 2. NaNGuard: 데이터 무결성 보장 (NaN/null 방어)
 * 3. EnhancedDiagnosisExtractor: ICD-10 인식, 한글 사전
 * 4. EnhancedDateBinder: 날짜-컨텍스트 연결
 * 5. EnhancedHospitalExtractor: 노이즈 필터링
 * 6. InsuranceInfoParser: 보험정보 구조화
 * 
 * 사용법:
 * const { createEnhancedExtractors, NaNGuard } = require('./enhanced-extractors');
 * const extractors = createEnhancedExtractors({ debug: true });
 */

const ExtractorAdapter = require('./ExtractorAdapter.cjs');
const NaNGuard = require('./NaNGuard.cjs');
const EnhancedDiagnosisExtractor = require('./EnhancedDiagnosisExtractor.cjs');
const EnhancedDateBinder = require('./EnhancedDateBinder.cjs');
const EnhancedHospitalExtractor = require('./EnhancedHospitalExtractor.cjs');
const InsuranceInfoParser = require('./InsuranceInfoParser.cjs');

/**
 * 팩토리 함수: 옵션에 따라 적절한 추출기 생성
 */
function createExtractors(options = {}) {
    const adapter = new ExtractorAdapter(options);
    return adapter.getExtractors();
}

/**
 * 향상된 추출기 팩토리
 */
function createEnhancedExtractors(options = {}) {
    return {
        diagnosis: new EnhancedDiagnosisExtractor(options),
        dates: new EnhancedDateBinder(options),
        hospital: new EnhancedHospitalExtractor(options),
        insurance: new InsuranceInfoParser(options)
    };
}

/**
 * 보고서 정화 함수
 */
function cleanReport(report) {
    return NaNGuard.cleanReport(report);
}

/**
 * NaN 검사 함수
 */
function checkForNaN(data) {
    const locations = NaNGuard.findNaNLocations(data);
    return {
        hasNaN: locations.length > 0,
        locations
    };
}

module.exports = {
    // 클래스 exports
    ExtractorAdapter,
    NaNGuard,
    EnhancedDiagnosisExtractor,
    EnhancedDateBinder,
    EnhancedHospitalExtractor,
    InsuranceInfoParser,

    // 헬퍼 함수 exports
    createExtractors,
    createEnhancedExtractors,
    cleanReport,
    checkForNaN,

    // 버전 정보
    version: '2.1.0',
    description: 'Enhanced extractors for improved report generation quality (Phase 4 Complete)'
};
