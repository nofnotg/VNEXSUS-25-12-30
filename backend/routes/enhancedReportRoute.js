/**
 * 개선된 보고서 생성 API 라우트
 * AI 필터링 및 시각화 기능이 통합된 보고서 생성
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import HybridMedicalNormalizer from '../postprocess/hybridMedicalNormalizer.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const EnhancedMedicalTermProcessor = require('../postprocess/enhancedMedicalTermProcessor.cjs');
const EnhancedReportTemplateEngine = require('../postprocess/enhancedReportTemplateEngine.cjs');
import InsuranceValidationService from '../services/insuranceValidationService.js';
import MedicalTermTranslationService from '../services/medicalTermTranslationService.js';
import MedicalVisitAnalysisService from '../services/medicalVisitAnalysisService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 디버그 엔드포인트 - 경로 확인
router.get('/debug-path', (req, res) => {
    const resultsDir = path.resolve(__dirname, '../../results');
    const testFile = path.join(resultsDir, 'case5_test.json');
    
    res.json({
        __dirname,
        resultsDir,
        testFile,
        exists: fs.existsSync(testFile),
        cwd: process.cwd()
    });
});

// 개선된 보고서 생성 엔드포인트
router.post('/generate-enhanced-report', async (req, res) => {
    try {
        const { jobId, options = {} } = req.body;
        
        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: 'jobId가 필요합니다.'
            });
        }
        
        console.log(`[개선된 보고서] 생성 시작 - jobId: ${jobId}`);
        
        // OCR 결과 파일 경로 - 절대 경로로 수정
        const resultsDir = path.resolve(__dirname, '../../results');
        const resultFile = path.join(resultsDir, `${jobId}.json`);
        
        console.log(`[디버그] resultsDir: ${resultsDir}`);
        console.log(`[디버그] resultFile: ${resultFile}`);
        console.log(`[디버그] 파일 존재 여부: ${fs.existsSync(resultFile)}`);
        
        // OCR 결과 파일 존재 확인
        if (!fs.existsSync(resultFile)) {
            return res.status(404).json({
                success: false,
                error: `OCR 결과 파일을 찾을 수 없습니다. 경로: ${resultFile}`
            });
        }
        
        // OCR 결과 파일 읽기
        const ocrResults = JSON.parse(fs.readFileSync(resultFile, 'utf8'));

        // Hybrid 의료 문서 정규화기 초기화
        const normalizer = new HybridMedicalNormalizer();
        
        // 의료용어 처리기 초기화
        const medicalTermProcessor = new EnhancedMedicalTermProcessor();
        const insuranceValidator = new InsuranceValidationService();
        const medicalTranslator = new MedicalTermTranslationService();
        const visitAnalyzer = new MedicalVisitAnalysisService();
        
        // 전체 텍스트 결합
        let combinedText = '';
        const fileResults = {};
        
        if (ocrResults.results) {
            Object.entries(ocrResults.results).forEach(([fileId, fileData]) => {
                combinedText += `\n\n========== 파일: ${fileData.filename} ==========\n\n`;
                combinedText += fileData.mergedText || '';
                
                fileResults[fileId] = {
                    filename: fileData.filename,
                    pageCount: fileData.pageCount || 0,
                    textPageCount: fileData.textPageCount || 0,
                    imagePageCount: fileData.imagePageCount || 0,
                    mergedText: fileData.mergedText || ''
                };
            });
        }
        
        console.log(`[개선된 보고서] 텍스트 길이: ${combinedText.length}자`);
        
        // 개선된 정규화 처리 (AI 필터링 및 검증 포함)
        const normalizedReport = await normalizer.normalizeDocument(combinedText, {
            enableAIFiltering: true,
            enableVisualization: true,
            includeValidationStats: true,
            ...options
        });
        
        // 의료용어 한글(영어) 병기 처리
        const medicalTermResult = medicalTermProcessor.processComprehensive(
            normalizedReport.formattedReport || combinedText,
            {
                processICD: true,
                enhanceTerms: true,
                filterContext: true,
                includeStatistics: true
            }
        );
        
        // 의료용어 번역 및 보완 처리
        let enhancedText = medicalTermResult.processedText || normalizedReport.formattedReport || combinedText;
        try {
            const translationResult = await medicalTranslator.enhanceTextWithTranslations(enhancedText);
            enhancedText = translationResult.enhancedText;
            console.log('[의료용어 번역] 번역 처리 완료:', translationResult.enhancementCount, '개 용어 처리');
        } catch (error) {
            console.warn('[의료용어 번역] 번역 처리 실패:', error.message);
        }
        
        // 통원 횟수 및 연관성 분석
        let visitAnalysis = null;
        console.log('🔍 Visit Analysis 디버깅 시작');
        console.log('normalizedReport 전체 구조:', Object.keys(normalizedReport));
        console.log('normalizedReport.medicalRecords 존재 여부:', !!normalizedReport.medicalRecords);
        console.log('normalizedReport.medicalRecords 타입:', typeof normalizedReport.medicalRecords);
        console.log('normalizedReport.medicalRecords 길이:', normalizedReport.medicalRecords?.length || 0);
        
        // normalizedReport 전체 내용 확인
        if (normalizedReport.medicalRecords) {
            console.log('medicalRecords 전체 내용:', JSON.stringify(normalizedReport.medicalRecords, null, 2));
        }
        
        if (normalizedReport.normalizedReport && normalizedReport.normalizedReport.medicalRecords && normalizedReport.normalizedReport.medicalRecords.length > 0) {
            console.log('medicalRecords 샘플 (첫 번째):', JSON.stringify(normalizedReport.normalizedReport.medicalRecords[0], null, 2));
            console.log('🔄 visitAnalyzer.analyzeVisitPatterns 호출 시작');
            
            try {
          visitAnalysis = visitAnalyzer.analyzeVisitPatterns(normalizedReport.normalizedReport.medicalRecords);
          console.log('✅ visitAnalyzer.analyzeVisitPatterns 호출 완료');
          console.log('visitAnalysis 결과:', visitAnalysis ? '데이터 있음' : 'null 또는 undefined');
          if (visitAnalysis) {
            console.log('visitAnalysis 키들:', Object.keys(visitAnalysis));
            console.log('visitAnalysis 전체 내용:', JSON.stringify(visitAnalysis, null, 2));
          }
        } catch (error) {
          console.error('❌ visitAnalyzer.analyzeVisitPatterns 에러:', error);
          visitAnalysis = null;
        }
        } else {
            console.log('⚠️ medicalRecords가 없거나 비어있음 - visitAnalysis 건너뜀');
        }
        
        // 정규화된 보고서에 처리 결과 통합
        normalizedReport.enhancedMedicalTerms = medicalTermResult;
        normalizedReport.enhancedText = enhancedText;
        normalizedReport.visitAnalysis = visitAnalysis;
        
        // 보험회사 정보 검증 및 개선
        if (normalizedReport.insuranceInfo && normalizedReport.insuranceInfo.company) {
            const validationResult = insuranceValidator.validateInsuranceCompany(normalizedReport.insuranceInfo.company);
            normalizedReport.insuranceInfo.validation = validationResult;
            
            // 유효한 보험사인 경우 정규화된 이름 사용
            if (validationResult.isValid && validationResult.normalizedName) {
                normalizedReport.insuranceInfo.company = validationResult.normalizedName;
            }
            
            // 손해사정회사인 경우 별도 표시
            if (validationResult.category === 'claims_adjuster') {
                normalizedReport.insuranceInfo.company = '손해사정조사회사';
                normalizedReport.insuranceInfo.isClaimsAdjuster = true;
            }
        }
        
        // 처리 통계 생성
        const processingStats = {
            totalFiles: Object.keys(fileResults).length,
            totalPages: Object.values(fileResults).reduce((sum, file) => sum + file.pageCount, 0),
            totalTextLength: combinedText.length,
            processingTime: Date.now(),
            aiFilteringEnabled: true,
            visualizationEnabled: true
        };
        
        // 최종 보고서 구성
        const enhancedReport = {
            jobId,
            generatedAt: new Date().toISOString(),
            processingStats,
            fileResults,
            normalizedReport,
            metadata: {
                version: '2.0',
                features: ['ai_filtering', 'visualization', 'validation_stats'],
                options: options
            }
        };
        
        // 보고서 파일 저장
        const reportFile = path.join(resultsDir, `enhanced_report_${jobId}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(enhancedReport, null, 2));
        
        console.log(`[개선된 보고서] 생성 완료 - 파일: ${reportFile}`);
        
        // 성공 응답
        res.json({
            success: true,
            data: enhancedReport,
            reportFile: `enhanced_report_${jobId}.json`,
            message: '개선된 보고서가 성공적으로 생성되었습니다.'
        });
        
    } catch (error) {
        console.error('[개선된 보고서] 생성 오류:', error);
        res.status(500).json({
            success: false,
            error: '보고서 생성 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 개선된 보고서 조회 엔드포인트
router.get('/enhanced-report/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: 'jobId가 필요합니다.'
            });
        }
        
        const resultsDir = path.join(__dirname, '../../results');
        const reportFile = path.join(resultsDir, `enhanced_report_${jobId}.json`);
        
        try {
            const reportData = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
            
            res.json({
                success: true,
                data: reportData
            });
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: '개선된 보고서를 찾을 수 없습니다.'
            });
        }
        
    } catch (error) {
        console.error('[개선된 보고서] 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '보고서 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 보험사 검증 통계 조회 엔드포인트
router.get('/validation-stats/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        
        const resultsDir = path.join(__dirname, '../../results');
        const reportFile = path.join(resultsDir, `enhanced_report_${jobId}.json`);
        
        try {
            const reportData = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
            
            const validationStats = reportData.normalizedReport?.insuranceValidationStats || {
                total: 0,
                valid: 0,
                invalid: 0,
                corrected: 0,
                filteredOut: 0
            };
            
            res.json({
                success: true,
                data: validationStats
            });
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: '검증 통계를 찾을 수 없습니다.'
            });
        }
        
    } catch (error) {
        console.error('[검증 통계] 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '검증 통계 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 시각화 데이터 조회 엔드포인트
router.get('/visualization-data/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { category } = req.query; // 선택적 필터
        
        const resultsDir = path.join(__dirname, '../../results');
        const reportFile = path.join(resultsDir, `enhanced_report_${jobId}.json`);
        
        try {
            const reportData = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
            
            let medicalRecords = reportData.normalizedReport?.medicalRecords || [];
            
            // 카테고리 필터 적용
            if (category && category !== 'all') {
                medicalRecords = medicalRecords.filter(record => 
                    record.visualization?.category === category
                );
            }
            
            res.json({
                success: true,
                data: {
                    medicalRecords,
                    totalRecords: medicalRecords.length,
                    categories: ['within_3months', 'within_5years', 'before_5years', 'after_join', 'unknown']
                }
            });
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: '시각화 데이터를 찾을 수 없습니다.'
            });
        }
        
    } catch (error) {
        console.error('[시각화 데이터] 조회 오류:', error);
        res.status(500).json({
            success: false,
            error: '시각화 데이터 조회 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 보고서 내보내기 엔드포인트
router.post('/export-report', async (req, res) => {
    try {
        const { jobId, format = 'json' } = req.body;
        
        if (!jobId) {
            return res.status(400).json({
                success: false,
                error: 'jobId가 필요합니다.'
            });
        }
        
        const resultsDir = path.join(__dirname, '../../results');
        const reportFile = path.join(resultsDir, `enhanced_report_${jobId}.json`);
        
        try {
            const reportData = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
            
            let exportData;
            let contentType;
            let filename;
            
            switch (format) {
                case 'json':
                    exportData = JSON.stringify(reportData, null, 2);
                    contentType = 'application/json';
                    filename = `enhanced_report_${jobId}.json`;
                    break;
                    
                case 'html':
                    // 고급 템플릿 엔진으로 HTML 생성
                    try {
                        const engine = new EnhancedReportTemplateEngine();

                        // 정규화된 구조화 데이터 매핑
                        const structured = reportData.normalizedReport?.normalizedReport || {};

                        const firstInsurance = Array.isArray(structured.insuranceConditions) ? structured.insuranceConditions[0] : null;

                        const normalizedData = {
                            patientInfo: structured.header ? {
                                name: structured.header.patientName,
                                birthDate: structured.header.birthDate,
                                gender: reportData.normalizedReport?.patientInfo?.gender || undefined,
                                address: undefined,
                                phone: undefined
                            } : (reportData.normalizedReport?.patientInfo || {}),
                            insuranceInfo: {
                                contractDate: firstInsurance?.joinDate || reportData.normalizedReport?.insuranceInfo?.joinDate || null,
                                productName: firstInsurance?.productName || reportData.normalizedReport?.insuranceInfo?.productName || null,
                                insurer: firstInsurance?.company || reportData.normalizedReport?.insuranceInfo?.company || null,
                                productType: reportData.normalizedReport?.insuranceInfo?.productType || '3.2.5'
                            },
                            medicalRecords: Array.isArray(structured.medicalRecords) ? structured.medicalRecords.map(r => ({
                                date: r.visitDate || r.date || null,
                                hospital: r.hospital,
                                diagnosis: Array.isArray(r.diagnosis) ? r.diagnosis.join(', ') : r.diagnosis,
                                treatment: r.prescription, // 처방을 치료로 근사 매핑
                                testResults: undefined
                            })) : []
                        };

                        const { fullReport } = await engine.generateEnhancedReport(normalizedData, {
                            format: 'html',
                            includeDisclosureReview: true,
                            includeSummary: true,
                            processTerms: true
                        });

                        exportData = fullReport;
                        contentType = 'text/html';
                        filename = `enhanced_report_${jobId}.html`;

                        // 프리뷰용 정적 파일로도 저장 (reports/ 디렉토리)
                        const reportsDir = path.resolve(__dirname, '../../reports');
                        try {
                            const previewFile = path.join(reportsDir, `enhanced_report_${jobId}.html`);
                            fs.writeFileSync(previewFile, exportData);
                        } catch (e) {
                            console.warn('[HTML 저장] 프리뷰 파일 저장 실패:', e.message);
                        }
                    } catch (e) {
                        console.warn('[고급 템플릿] HTML 생성 실패, 기본 템플릿으로 폴백:', e.message);
                        exportData = generateHTMLReport(reportData);
                        contentType = 'text/html';
                        filename = `enhanced_report_${jobId}.html`;
                    }
                    break;
                    
                default:
                    return res.status(400).json({
                        success: false,
                        error: '지원하지 않는 형식입니다.'
                    });
            }
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(exportData);
            
        } catch (error) {
            res.status(404).json({
                success: false,
                error: '보고서를 찾을 수 없습니다.'
            });
        }
        
    } catch (error) {
        console.error('[보고서 내보내기] 오류:', error);
        res.status(500).json({
            success: false,
            error: '보고서 내보내기 중 오류가 발생했습니다.',
            details: error.message
        });
    }
});

/**
 * HTML 보고서 생성 함수
 * @param {Object} reportData - 보고서 데이터
 * @returns {string} HTML 문자열
 */
function generateHTMLReport(reportData) {
    const { normalizedReport, processingStats } = reportData;
    
    // 의료용어 처리기 및 보험회사 검증 서비스 초기화 (HTML 생성용)
    const medicalTermProcessor = new EnhancedMedicalTermProcessor();
    const insuranceValidator = new InsuranceValidationService();
    
    // 보험 가입일 기준으로 색상 구분을 위한 함수
    function getTimeframeColor(date, insuranceJoinDate) {
        if (!date || !insuranceJoinDate) return '';
        
        const recordDate = new Date(date);
        const joinDate = new Date(insuranceJoinDate);
        const diffMonths = (recordDate - joinDate) / (1000 * 60 * 60 * 24 * 30.44);
        
        if (diffMonths <= 3) {
            return 'background-color: #ffdddd; border-left: 4px solid #ff4444;'; // 3개월 이내 - 빨간색
        } else if (diffMonths <= 60) { // 5년 = 60개월
            return 'background-color: #fff3cd; border-left: 4px solid #ff8800;'; // 5년 이내 - 주황색
        }
        return '';
    }
    
    // 보험회사 정보 검증 및 표시 함수
    function formatInsuranceCompany(companyName) {
        if (!companyName) return '정보없음';
        
        const validation = insuranceValidator.validateInsuranceCompany(companyName);
        
        if (validation.category === 'claims_adjuster') {
            return `<span style="color: #dc3545; font-weight: bold;">${companyName} (손해사정조사회사)</span>`;
        }
        
        if (validation.isValid && validation.normalizedName) {
            if (validation.matchType === 'corrected') {
                return `<span style="color: #28a745;">${validation.normalizedName}</span> <small style="color: #6c757d;">(${companyName}에서 보정)</small>`;
            } else if (validation.matchType === 'partial') {
                return `<span style="color: #17a2b8;">${validation.normalizedName}</span> <small style="color: #6c757d;">(부분매칭)</small>`;
            }
            return `<span style="color: #28a745;">${validation.normalizedName}</span>`;
        }
        
        return `<span style="color: #ffc107;">${companyName}</span> <small style="color: #dc3545;">(미등록 보험사)</small>`;
    }
    // 의료용어 처리 함수
    function enhanceMedicalText(text) {
        if (!text) return text;
        const result = medicalTermProcessor.processComprehensive(text, {
            processICD: true,
            enhanceTerms: true,
            filterContext: false,
            includeStatistics: false
        });
        return result.processedText;
    }

    // 날짜 형식 통일 함수 (yyyy-mm-dd)
    function formatDateToStandard(dateStr) {
        if (!dateStr) return '날짜 미확인';
        
        try {
            // 다양한 날짜 형식을 Date 객체로 변환
            const date = new Date(dateStr);
            
            // 유효한 날짜인지 확인
            if (isNaN(date.getTime())) {
                // 한국어 날짜 형식 처리 (예: 2024년 1월 15일)
                const koreanDateMatch = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
                if (koreanDateMatch) {
                    const [, year, month, day] = koreanDateMatch;
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
                
                // 기타 형식 처리
                const dateMatch = dateStr.match(/(\d{4})[.-/](\d{1,2})[.-/](\d{1,2})/);
                if (dateMatch) {
                    const [, year, month, day] = dateMatch;
                    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
                
                return dateStr; // 변환할 수 없으면 원본 반환
            }
            
            // yyyy-mm-dd 형식으로 변환
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            return `${year}-${month}-${day}`;
        } catch (error) {
            console.error('날짜 형식 변환 오류:', error);
            return dateStr;
        }
    }
    
    // 보험 가입일 추출 (첫 번째 보험 기준)
    const insuranceJoinDate = normalizedReport.insuranceInfo ? 
        (Array.isArray(normalizedReport.insuranceInfo) ? 
            normalizedReport.insuranceInfo[0]?.joinDate : 
            normalizedReport.insuranceInfo.joinDate) : null;
    
    // 의료 기록에서 중복 날짜 제거 및 정렬
    const uniqueMedicalRecords = normalizedReport.medicalRecords ? 
        normalizedReport.medicalRecords.reduce((acc, record) => {
            const existingRecord = acc.find(r => r.date === record.date && r.hospital === record.hospital);
            if (!existingRecord) {
                acc.push(record);
            } else {
                // 기존 기록에 정보 병합
                if (record.diagnosis && !existingRecord.diagnosis) {
                    existingRecord.diagnosis = record.diagnosis;
                }
                if (record.treatment && !existingRecord.treatment) {
                    existingRecord.treatment = record.treatment;
                }
            }
            return acc;
        }, []).sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>의료 문서 분석 보고서</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #dee2e6; }
        .section { margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { background: #e9ecef; padding: 15px; border-radius: 6px; text-align: center; border: 1px solid #ced4da; }
        .timeline-item { 
            padding: 15px; 
            margin-bottom: 15px; 
            border-radius: 6px;
            border: 1px solid #dee2e6;
        }
        .timeline-item.within-3months { background-color: #ffdddd; border-left: 4px solid #ff4444; }
        .timeline-item.within-5years { background-color: #fff3cd; border-left: 4px solid #ff8800; }
        .timeline-item.normal { background-color: #f8f9fa; border-left: 4px solid #007bff; }
        .legend { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 6px; 
            margin-bottom: 20px;
            border: 1px solid #dee2e6;
        }
        .legend-item { 
            display: inline-block; 
            margin-right: 20px; 
            padding: 5px 10px; 
            border-radius: 4px;
            font-size: 0.9em;
        }
        .legend-3months { background-color: #ffdddd; border-left: 4px solid #ff4444; }
        .legend-5years { background-color: #fff3cd; border-left: 4px solid #ff8800; }
        .legend-normal { background-color: #f8f9fa; border-left: 4px solid #007bff; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: 600; }
        .date-header { font-size: 1.1em; font-weight: 600; color: #495057; }
        .hospital-name { color: #007bff; font-weight: 500; }
        .diagnosis { color: #28a745; }
        .treatment { color: #6c757d; }
        .misc-section { 
            background-color: #f8f9fa; 
            padding: 10px; 
            border-radius: 4px; 
            margin-top: 10px;
            border-left: 3px solid #6c757d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>의료 문서 분석 보고서</h1>
        <p>생성일: ${new Date(reportData.generatedAt).toLocaleString('ko-KR')}</p>
        <p>작업 ID: ${reportData.jobId}</p>
    </div>
    
    <div class="legend">
        <h3>범례</h3>
        <div class="legend-item legend-3months">보험 가입 3개월 이내</div>
        <div class="legend-item legend-5years">보험 가입 5년 이내</div>
        <div class="legend-item legend-normal">5년 초과</div>
    </div>
    
    <div class="section">
        <h2>처리 통계</h2>
        <div class="stats">
            <div class="stat-card">
                <h3>${processingStats.totalFiles}</h3>
                <p>처리된 파일 수</p>
            </div>
            <div class="stat-card">
                <h3>${processingStats.totalPages}</h3>
                <p>총 페이지 수</p>
            </div>
            <div class="stat-card">
                <h3>${Math.round(processingStats.totalTextLength / 1000)}K</h3>
                <p>추출된 텍스트 (글자)</p>
            </div>
        </div>
    </div>
    
    ${normalizedReport.patientInfo ? `
    <div class="section">
        <h2>피보험자 정보</h2>
        <table>
            ${normalizedReport.patientInfo.name ? `<tr><td>이름</td><td>${normalizedReport.patientInfo.name}</td></tr>` : ''}
            ${normalizedReport.patientInfo.birthDate ? `<tr><td>생년월일</td><td>${normalizedReport.patientInfo.birthDate}</td></tr>` : ''}
            ${normalizedReport.patientInfo.gender ? `<tr><td>성별</td><td>${normalizedReport.patientInfo.gender}</td></tr>` : ''}
        </table>
    </div>
    ` : ''}
    
    ${normalizedReport.insuranceInfo ? `
    <div class="section">
        <h2>보험 정보</h2>
        ${Array.isArray(normalizedReport.insuranceInfo) ? 
            normalizedReport.insuranceInfo.map((insurance, index) => `
                <h3>보험 ${index + 1}</h3>
                <table>
                    ${insurance.company ? `<tr><td>보험사</td><td>${formatInsuranceCompany(insurance.company)}</td></tr>` : ''}
                    ${insurance.joinDate ? `<tr><td>가입일</td><td>${insurance.joinDate}</td></tr>` : ''}
                    ${insurance.product ? `<tr><td>상품명</td><td>${insurance.product}</td></tr>` : ''}
                </table>
            `).join('') : 
            `<table>
                ${normalizedReport.insuranceInfo.company ? `<tr><td>보험사</td><td>${formatInsuranceCompany(normalizedReport.insuranceInfo.company)}</td></tr>` : ''}
                ${normalizedReport.insuranceInfo.joinDate ? `<tr><td>가입일</td><td>${normalizedReport.insuranceInfo.joinDate}</td></tr>` : ''}
            </table>`
        }
    </div>
    ` : ''}
    
    ${uniqueMedicalRecords.length > 0 ? `
    <div class="section">
        <h2>경과 요약 보고서</h2>
        ${uniqueMedicalRecords.map(record => {
            // 시간대별 색상 클래스 결정
            let timeframeClass = 'normal';
            if (insuranceJoinDate && record.date) {
                const recordDate = new Date(record.date);
                const joinDate = new Date(insuranceJoinDate);
                const diffMonths = (recordDate - joinDate) / (1000 * 60 * 60 * 24 * 30.44);
                
                if (diffMonths <= 3) {
                    timeframeClass = 'within-3months';
                } else if (diffMonths <= 60) {
                    timeframeClass = 'within-5years';
                }
            }
            
            return `
            <div class="timeline-item ${timeframeClass}">
                <div class="date-header">${formatDateToStandard(record.date)}</div>
                ${record.hospital ? `<p><strong>병원:</strong> <span class="hospital-name">${record.hospital}</span></p>` : ''}
                ${record.diagnosis ? `<p><strong>진단:</strong> <span class="diagnosis">${enhanceMedicalText(Array.isArray(record.diagnosis) ? record.diagnosis.join(', ') : record.diagnosis)}</span></p>` : ''}
                ${record.treatment ? `<p><strong>치료:</strong> <span class="treatment">${enhanceMedicalText(Array.isArray(record.treatment) ? record.treatment.join(', ') : record.treatment)}</span></p>` : ''}
                ${record.notes ? `<p><strong>특이사항:</strong> ${record.notes}</p>` : ''}
                
                <div class="misc-section">
                    <strong>기타:</strong> 
                    ${record.prescription ? `처방: ${enhanceMedicalText(record.prescription)}` : ''}
                    ${record.icdCode ? ` | ICD 코드: ${enhanceMedicalText(record.icdCode)}` : ''}
                    ${!record.prescription && !record.icdCode ? '추가 정보 없음' : ''}
                </div>
            </div>
            `;
        }).join('')}
    </div>
    ` : ''}
    
    <div class="section">
        <h2>종합 소견</h2>
        <table>
            <tr><td>총 의료 기록 수</td><td>${uniqueMedicalRecords.length}건</td></tr>
            <tr><td>보험 가입 3개월 이내 기록</td><td>${uniqueMedicalRecords.filter(r => {
                if (!insuranceJoinDate || !r.date) return false;
                const diffMonths = (new Date(r.date) - new Date(insuranceJoinDate)) / (1000 * 60 * 60 * 24 * 30.44);
                return diffMonths <= 3;
            }).length}건</td></tr>
            <tr><td>보험 가입 5년 이내 기록</td><td>${uniqueMedicalRecords.filter(r => {
                if (!insuranceJoinDate || !r.date) return false;
                const diffMonths = (new Date(r.date) - new Date(insuranceJoinDate)) / (1000 * 60 * 60 * 24 * 30.44);
                return diffMonths > 3 && diffMonths <= 60;
            }).length}건</td></tr>
        </table>
    </div>
    
</body>
</html>
    `;
}

export default router;
