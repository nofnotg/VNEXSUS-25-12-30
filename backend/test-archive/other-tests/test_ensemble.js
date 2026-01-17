import HybridProcessingEngine from './services/HybridProcessingEngine.js';

console.log('Testing HybridProcessingEngine instantiation...');

try {
    const engine = new HybridProcessingEngine();
    console.log('HybridProcessingEngine instantiated successfully.');

    if (engine.ensembleService) {
        console.log('EnsembleService is initialized.');
        console.log('Ensemble models:', engine.ensembleService.models);
    } else {
        console.error('EnsembleService is NOT initialized.');
    }

    console.log('Strategies:', Object.keys(engine.processingStrategies));

} catch (error) {
    console.error('Error instantiating HybridProcessingEngine:', error);
}
