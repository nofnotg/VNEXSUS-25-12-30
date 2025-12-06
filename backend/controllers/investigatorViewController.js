/**
 * Investigator View Controller
 * Investigator View 데이터 조회 및 저장을 담당하는 컨트롤러
 */

import { jobStore } from './ocrController.js';
import coreEngineService from '../services/coreEngineService.js';
import { logService } from '../utils/logger.js';
import reportGenerator from '../services/core-engine/utils/ReportGenerator.js';

/**
 * Investigator View 데이터 조회 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const getInvestigatorView = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!jobId || !jobStore[jobId]) {
            return res.status(404).json({
                error: '존재하지 않는 작업 ID입니다.',
                status: 'error',
                code: 'JOB_NOT_FOUND'
            });
        }

        const job = jobStore[jobId];

        if (job.status !== 'completed') {
            return res.status(202).json({
                message: '처리 중입니다.',
                status: job.status
            });
        }

        // 이미 생성된 보고서가 있는지 확인
        if (job.report && job.report.investigatorView) {
            return res.json({
                success: true,
                data: job.report.investigatorView
            });
        }

        // 보고서가 없으면 Core Engine을 사용하여 생성
        // 모든 파일의 텍스트를 합침
        let combinedText = '';
        Object.values(job.results).forEach(fileResult => {
            combinedText += (fileResult.mergedText || '') + '\n\n';
        });

        if (!combinedText.trim()) {
            return res.status(400).json({
                error: '분석할 텍스트가 없습니다.',
                status: 'error',
                code: 'NO_TEXT'
            });
        }

        try {
            logService.info(`Investigator View 생성을 위한 Core Engine 분석 시작 (Job ID: ${jobId})`);

            const analysisResult = await coreEngineService.analyze({
                text: combinedText,
                options: {
                    jobId: jobId,
                    qualityGate: 'standard'
                }
            });

            // Core Engine 결과 처리
            // analysisResult는 스켈레톤 리포트 구조를 그대로 가짐
            if (analysisResult && (analysisResult.investigatorView || analysisResult.skeletonJson)) {
                // 결과 저장 (skeletonJson 프로퍼티가 있거나 결과 자체가 리포트인 경우)
                job.report = analysisResult.skeletonJson || analysisResult;

                // Investigator View 반환
                if (job.report.investigatorView) {
                    return res.json({
                        success: true,
                        data: job.report.investigatorView,
                        parsedRecords: job.report.parsedRecords || [] // Phase 4: 전처리 결과 포함
                    });
                }
            }

            // Investigator View가 생성되지 않았으면 기본 구조 생성 (Fallback)
            logService.warn(`Core Engine이 Investigator View를 생성하지 못했습니다. 기본 구조를 생성합니다. (Job ID: ${jobId})`);

            // 기본 Investigator View 구조 생성
            const fallbackView = {
                episodes: [],
                timeline: [],
                claimInfo: {
                    patientName: '정보 없음',
                    claimNumber: jobId,
                    policyNumber: '',
                    contractDate: ''
                },
                disputeInfo: {
                    score: 0,
                    phase: 'unknown',
                    role: 'unknown'
                },
                reportContent: `분석 대상 텍스트:\n\n${combinedText.substring(0, 500)}...\n\n[Core Engine 분석 결과가 없습니다. 수동으로 보고서를 작성해주세요.]`,
                generatedAt: new Date().toISOString(),
                coreEngineUsed: analysisResult?.coreEngineUsed || false,
                fallback: true
            };

            // 기본 구조 저장
            if (!job.report) job.report = {};
            job.report.investigatorView = fallbackView;

            return res.json({
                success: true,
                data: fallbackView,
                warning: 'Core Engine 분석 결과가 불완전하여 기본 구조를 반환했습니다.'
            });

        } catch (engineError) {
            logService.error(`Core Engine 분석 실패: ${engineError.message}`);

            // 에러 발생 시에도 기본 구조 반환
            const errorFallbackView = {
                episodes: [],
                timeline: [],
                claimInfo: {
                    patientName: '정보 없음',
                    claimNumber: jobId
                },
                disputeInfo: {
                    score: 0,
                    phase: 'unknown'
                },
                reportContent: `분석 중 오류가 발생했습니다.\n\n오류: ${engineError.message}\n\n원본 텍스트:\n${combinedText.substring(0, 500)}...`,
                generatedAt: new Date().toISOString(),
                error: engineError.message,
                fallback: true
            };

            if (!job.report) job.report = {};
            job.report.investigatorView = errorFallbackView;

            return res.json({
                success: true,
                data: errorFallbackView,
                warning: `분석 중 오류가 발생하여 기본 구조를 반환했습니다: ${engineError.message}`
            });
        }

    } catch (error) {
        logService.error(`Investigator View 조회 중 오류: ${error.message}`);
        res.status(500).json({
            error: '서버 내부 오류가 발생했습니다.',
            status: 'error',
            code: 'SERVER_ERROR'
        });
    }
};

/**
 * Investigator View 데이터 저장 컨트롤러
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const saveInvestigatorView = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { data } = req.body;

        if (!jobId || !jobStore[jobId]) {
            return res.status(404).json({
                error: '존재하지 않는 작업 ID입니다.',
                status: 'error',
                code: 'JOB_NOT_FOUND'
            });
        }

        if (!data) {
            return res.status(400).json({
                error: '저장할 데이터가 없습니다.',
                status: 'error',
                code: 'NO_DATA'
            });
        }

        const job = jobStore[jobId];

        // 기존 리포트 업데이트 또는 생성
        if (!job.report) {
            job.report = {};
        }

        // Investigator View 데이터 업데이트
        job.report.investigatorView = {
            ...job.report.investigatorView,
            ...data,
            lastModified: new Date().toISOString()
        };

        return res.json({
            success: true,
            message: 'Investigator View 데이터가 저장되었습니다.',
            lastModified: job.report.investigatorView.lastModified
        });

    } catch (error) {
        logService.error(`Investigator View 저장 중 오류: ${error.message}`);
        res.status(500).json({
            error: '서버 내부 오류가 발생했습니다.',
            status: 'error',
            code: 'SERVER_ERROR'
        });
    }
};

/**
 * Phase 7: 텍스트 보고서 생성 컨트롤러
 * Investigator View를 포맷팅된 텍스트/HTML 보고서로 변환
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
export const getTextReport = async (req, res) => {
    try {
        const { jobId } = req.params;
        const { format = 'plain', contractDate = null } = req.query;

        if (!jobId || !jobStore[jobId]) {
            return res.status(404).json({
                error: '존재하지 않는 작업 ID입니다.',
                status: 'error',
                code: 'JOB_NOT_FOUND'
            });
        }

        const job = jobStore[jobId];

        if (job.status !== 'completed') {
            return res.status(202).json({
                message: '작업이 아직 진행 중입니다.',
                status: job.status,
                progress: job.progress || 0
            });
        }

        // Investigator View 데이터 가져오기
        let investigatorView = job.report?.investigatorView;

        if (!investigatorView) {
            // Investigator View가 없으면 생성
            const combinedText = job.results
                .map(result => result.extractedText || '')
                .join('\n\n');

            if (!combinedText.trim()) {
                return res.status(400).json({
                    error: '추출된 텍스트가 없습니다.',
                    status: 'error',
                    code: 'NO_TEXT_EXTRACTED'
                });
            }

            try {
                const analysisResult = await coreEngineService.analyze(combinedText, {
                    qualityGate: 'standard',
                    enableProgressiveRAG: false
                });

                investigatorView = analysisResult.skeletonJson?.investigatorView ||
                    analysisResult.investigatorView;

                if (!investigatorView) {
                    return res.status(500).json({
                        error: 'Investigator View 생성에 실패했습니다.',
                        status: 'error',
                        code: 'ANALYSIS_FAILED'
                    });
                }
            } catch (error) {
                logService.error(`Core Engine 분석 중 오류: ${error.message}`);
                return res.status(500).json({
                    error: 'Core Engine 분석 중 오류가 발생했습니다.',
                    status: 'error',
                    code: 'ANALYSIS_ERROR',
                    details: error.message
                });
            }
        }

        // 보고서 생성
        let report;
        if (format === 'html') {
            report = reportGenerator.generateHTMLReport(investigatorView, {
                includeInsurance: true,
                contractDate
            });
        } else {
            report = reportGenerator.generateTextReport(investigatorView, {
                format: 'plain',
                includeInsurance: true,
                contractDate
            });
        }

        // 응답
        if (format === 'html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(report);
        } else {
            res.json({
                success: true,
                jobId,
                format,
                report,
                generatedAt: new Date().toISOString()
            });
        }

    } catch (error) {
        logService.error(`텍스트 보고서 생성 중 오류: ${error.message}`);
        res.status(500).json({
            error: '서버 내부 오류가 발생했습니다.',
            status: 'error',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
};

export default {
    getInvestigatorView,
    saveInvestigatorView,
    getTextReport
};
