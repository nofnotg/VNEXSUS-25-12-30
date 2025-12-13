import medicalAnalysisService from './medicalAnalysisService.js';
import { buildEnhancedMedicalDnaPrompt, loadEnhancedMedicalKnowledgeBase } from '../config/enhancedPromptBuilder.js';

class WriterAgentService {
    constructor() {
        // LLM Client is managed by MedicalAnalysisService
    }

    /**
     * Generate a narrative report based on the vector evaluation using Real LLM.
     * @param {Object} vectorResult - Result from VectorEvaluationService
     * @param {string} contractDate - Contract date
     * @param {Array<Object>} events - List of medical events
     * @returns {Promise<string>} Markdown formatted report
     */
    async generateReport(vectorResult, contractDate, events = [], originalText = '') {
        if (!vectorResult || !vectorResult.vectorType) {
            return "분석 결과가 충분하지 않아 보고서를 생성할 수 없습니다.";
        }

        try {
            // Load Knowledge Base
            const knowledgeBase = await loadEnhancedMedicalKnowledgeBase();

            // Build Enhanced Prompt
            const { systemPrompt, userPrompt } = buildEnhancedMedicalDnaPrompt(originalText, knowledgeBase, contractDate);

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

        } catch (error) {
            console.error("Writer Agent Error:", error);
            return `[시스템 오류] 보고서 생성 중 오류가 발생했습니다: ${error.message}`;
        }
    }
}

export default new WriterAgentService();
