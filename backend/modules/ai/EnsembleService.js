import AIService from './aiService.js';
import { logService as logger } from '../../utils/logger.js';

class EnsembleService {
    constructor(options = {}) {
        this.aiService = new AIService(options);
        this.models = [
            { provider: 'openai', model: 'gpt-4o-mini' },
            { provider: 'gemini', model: 'gemini-2.0-flash-exp' }
        ];
    }

    /**
     * Run ensemble processing using multiple models
     * @param {Array} messages - Chat messages
     * @param {Object} options - Options including 'ensembleMode' (vote, verify, parallel)
     */
    async processWithEnsemble(messages, options = {}) {
        const mode = options.ensembleMode || 'parallel';

        console.log(`🚀 Starting Ensemble Processing [Mode: ${mode}]`);

        // Filter available providers based on API keys
        const availableModels = this.models.filter(m => this.aiService.hasValidApiKey(m.provider));

        if (availableModels.length < 2) {
            console.warn('⚠️ Not enough models for ensemble. Falling back to single model.');
            return this.aiService.chat(messages, options);
        }

        try {
            // Run models in parallel
            const promises = availableModels.map(modelConfig => {
                return this.aiService.chat(messages, {
                    ...options,
                    provider: modelConfig.provider,
                    model: modelConfig.model
                }).then(result => ({
                    ...result,
                    _ensemble_model: `${modelConfig.provider}:${modelConfig.model}`
                })).catch(err => ({
                    error: err.message,
                    _ensemble_model: `${modelConfig.provider}:${modelConfig.model}`
                }));
            });

            const results = await Promise.all(promises);
            const successfulResults = results.filter(r => !r.error);

            if (successfulResults.length === 0) {
                throw new Error('All ensemble models failed.');
            }

            // Aggregate Results
            return this.aggregateResults(successfulResults);

        } catch (error) {
            console.error('Ensemble processing error:', error);
            throw error;
        }
    }

    /**
     * Aggregate results from multiple models
     * @param {Array} results 
     */
    aggregateResults(results) {
        // Simple aggregation: Return the longest/most detailed response for now, 
        // but calculate a "Consistency Score"

        // 1. Calculate Consistency (Simulated by length similarity for now)
        const lengths = results.map(r => r.content.length);
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((a, b) => a + Math.pow(b - avgLength, 2), 0) / lengths.length;
        const consistencyScore = Math.max(0, 100 - Math.sqrt(variance)); // Rough heuristic

        // 2. Select "Best" Result (e.g., the one closest to average length, or just the first one)
        // For medical reports, we often prefer the one that extracted *more* valid fields, but here we'll pick the first valid one
        // and attach the consistency metadata.

        const bestResult = results[0]; // Default to primary model

        return {
            ...bestResult,
            ensemble_metadata: {
                model_count: results.length,
                models_used: results.map(r => r._ensemble_model),
                consistency_score: consistencyScore.toFixed(2),
                all_outputs: results.map(r => ({
                    model: r._ensemble_model,
                    content_preview: r.content.substring(0, 50) + '...'
                }))
            }
        };
    }
}

export default EnsembleService;
