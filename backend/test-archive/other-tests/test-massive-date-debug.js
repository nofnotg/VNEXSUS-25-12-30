import MassiveDateBlockProcessor from './postprocess/massiveDateBlockProcessor.js';

async function testMassiveDateProcessor() {
    console.log('🧪 MassiveDateBlockProcessor 직접 테스트 시작');
    
    const processor = new MassiveDateBlockProcessor();
    const testText = "2024년 12월 15일 진료 기록입니다.";
    
    console.log('📝 입력 텍스트:', testText);
    
    try {
        const result = await processor.processMassiveDateBlocks(testText);
        console.log('✅ 처리 결과:', JSON.stringify(result, null, 2));
        
        if (result.dateBlocks && result.dateBlocks.length > 0) {
            console.log('📅 추출된 날짜 블록 수:', result.dateBlocks.length);
            result.dateBlocks.forEach((block, index) => {
                console.log(`📅 블록 ${index + 1}:`, JSON.stringify(block, null, 2));
            });
        } else {
            console.log('❌ 날짜 블록이 추출되지 않았습니다.');
        }
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

testMassiveDateProcessor();