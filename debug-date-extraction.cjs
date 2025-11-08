async function debugDateExtraction() {
    const { default: HybridDateProcessor } = await import('./backend/postprocess/hybridDateProcessor.js');
    
    const processor = new HybridDateProcessor();
    const testText = "환자는 2024년 12월 14일에 병원에 내원하였고, 2024년 12월 15일에 수술을 받았습니다.";
    
    console.log('=== Date Extraction Debug ===');
    console.log('Test Text:', testText);
    
    // 각 모드별로 테스트
    const modes = ['legacy', 'core', 'hybrid', 'adaptive'];
    
    for (const mode of modes) {
        console.log(`\n--- ${mode.toUpperCase()} Mode ---`);
        try {
            const result = await processor.processMassiveDateBlocks(testText, { processingMode: mode });
            
            console.log('Status:', result.status);
            console.log('Confidence:', result.confidence);
            console.log('Processing Time:', result.processingTime);
            console.log('Date Blocks Count:', result.dateBlocks ? result.dateBlocks.length : 0);
            console.log('Date Blocks:', result.dateBlocks);
            console.log('Extracted Dates:', result.extractedDates);
            console.log('Dates:', result.dates);
            
            if (result.errors && result.errors.length > 0) {
                console.log('Errors:', result.errors);
            }
            
        } catch (error) {
            console.error(`Error in ${mode} mode:`, error.message);
        }
    }
}

debugDateExtraction().catch(console.error);