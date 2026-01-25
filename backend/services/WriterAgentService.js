import medicalAnalysisService from './medicalAnalysisService.js';
import {
    buildEnhancedMedicalDnaPrompt,
    buildStructuredJsonPrompt,
    loadEnhancedMedicalKnowledgeBase,
    getJsonModelOptions
} from '../config/enhancedPromptBuilder.js';
import StructuredReportGenerator from './structuredReportGenerator.js';
import { validateReportSchema, applyDefaultValues } from './structuredReportSchema.js';

class WriterAgentService {
    constructor() {
        // LLM Client is managed by MedicalAnalysisService
    }

    /**
     * Generate a narrative report based on the vector evaluation using Real LLM.
     * @param {Object} vectorResult - Result from VectorEvaluationService
     * @param {string} contractDate - Contract date
     * @param {Array<Object>} events - List of medical events
     * @param {string} originalText - Original extracted text
     * @param {Object} patientInfo - Patient information (name, birthDate, etc.)
     * @param {Object} options - Generation options
     * @returns {Promise<string>} Markdown formatted report
     */
    async generateReport(vectorResult, contractDate, events = [], originalText = '', patientInfo = {}, options = {}) {
        if (!vectorResult || !vectorResult.vectorType) {
            return "분석 결과가 충분하지 않아 보고서를 생성할 수 없습니다.";
        }

        try {
            const offline = process.env.OFFLINE_MODE === 'true' || process.env.ENABLE_LLM === 'false';
            if (offline) {
                const lines = [];
                lines.push(`# 심사 보고서 (오프라인 모드)`);
                lines.push(`- 계약일: ${contractDate || '미지정'}`);
                lines.push(`- 벡터 유형: ${vectorResult.vectorType}`);
                if (Array.isArray(events) && events.length > 0) {
                    lines.push(`\n## 의료 타임라인`);
                    for (let i = 0; i < Math.min(events.length, 20); i++) {
                        const e = events[i];
                        const d = e?.date || '날짜 미상';
                        const c = (e?.content || '').replace(/\s+/g, ' ').trim();
                        lines.push(`- ${d}: ${c.length > 0 ? c : '내용 없음'}`);
                    }
                }
                lines.push(`\n## 시스템 판단 요약`);
                lines.push(`- 본 문서는 오프라인 환경에서 자동 생성되었습니다.`);
                lines.push(`- 외부 LLM 호출 없이 규칙 기반 결과를 요약합니다.`);
                return lines.join('\n');
            }

            // Load Knowledge Base
            const knowledgeBase = await loadEnhancedMedicalKnowledgeBase();

            // 🆕 JSON 구조화 모드 사용 (기본값: true)
            const useStructuredJson = options.useStructuredJson ?? true;

            let systemPrompt, userPrompt;
            if (useStructuredJson) {
                // JSON 구조화 모드: 10항목 보고서를 JSON으로 생성
                const jsonPrompts = buildStructuredJsonPrompt(
                    originalText,
                    knowledgeBase,
                    contractDate,
                    patientInfo
                );
                systemPrompt = jsonPrompts.systemPrompt;
                userPrompt = jsonPrompts.userPrompt;

                // JSON 모드로 GPT 호출
                const jsonModelOptions = getJsonModelOptions();
                const completion = await medicalAnalysisService.getOpenAIClient().chat.completions.create({
                    ...jsonModelOptions,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                });

                const rawResponse = completion.choices[0]?.message?.content ?? '{}';

                try {
                    // JSON 파싱 및 검증
                    let structuredJsonData = JSON.parse(rawResponse);
                    const validation = validateReportSchema(structuredJsonData);

                    // 항상 기본값 적용 (누락/빈값 필드 모두 보완)
                    structuredJsonData = applyDefaultValues(structuredJsonData, validation);

                    // 구조화된 보고서 생성기로 텍스트 변환
                    const reportGenerator = new StructuredReportGenerator({ debug: false });
                    const reportResult = await reportGenerator.generateReport(structuredJsonData);

                    return reportResult.report;

                } catch (parseError) {
                    // JSON 파싱 실패 시 폴백
                    console.error('JSON 파싱 실패:', parseError);
                    return `[JSON 파싱 실패 - 원본 응답]\n${rawResponse}`;
                }

            } else {
                // 기존 텍스트 모드
                const legacyPrompts = buildEnhancedMedicalDnaPrompt(originalText, knowledgeBase, contractDate);
                systemPrompt = legacyPrompts.systemPrompt;
                userPrompt = legacyPrompts.userPrompt;

                // Call OpenAI via MedicalAnalysisService
                const completion = await medicalAnalysisService.getOpenAIClient().chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 1000
                });

                return completion.choices[0].message.content;
            }

        } catch (error) {
            console.error("Writer Agent Error:", error);
            return `[시스템 오류] 보고서 생성 중 오류가 발생했습니다: ${error.message}`;
        }
    }
}

export default new WriterAgentService();
