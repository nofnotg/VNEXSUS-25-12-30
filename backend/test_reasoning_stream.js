import HybridProcessingEngine from './services/HybridProcessingEngine.js';
import reasoningStream from './services/ReasoningStream.js';

console.log('🧪 Testing Reasoning Stream...');

// Simulate SSE Client
reasoningStream.on('data', (data) => {
    console.log(`[CLIENT RECEIVED] Type: ${data.type}, Step: ${data.step || 'N/A'}, Status: ${data.status || 'N/A'}`);
    if (data.details) console.log(`   Details: ${JSON.stringify(data.details)}`);
});

async function runTest() {
    const engine = new HybridProcessingEngine();

    // Create complex dummy data to trigger Ensemble
    const complexData = {
        patient: { name: "Test Patient", history: "Complex history..." },
        medical_records: Array(20).fill({ date: "2023-01-01", diagnosis: "Complex Disease", notes: "Detailed notes..." }),
        unstructured_text: "Very long and complex medical text... ".repeat(50)
    };

    console.log('🚀 Triggering Adaptive Processing...');
    try {
        await engine.processAdaptively(complexData, { strategy: 'ensemble' }); // Force ensemble for test
    } catch (error) {
        console.error('Processing error (expected if models fail, but events should emit):', error.message);
    }
}

runTest();
