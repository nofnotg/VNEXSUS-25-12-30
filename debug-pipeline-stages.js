const HybridController = require('./backend/controllers/hybridController');

async function debugPipelineStages() {
    console.log('=== Pipeline Stages Debug ===');
    
    const controller = new HybridController();
    
    // Mock request/response objects
    const mockReq = {
        body: {
            document: {
                text: "환자는 2024년 12월 14일에 병원에 내원하였고, 2024년 12월 15일에 수술을 받았습니다."
            },
            options: {
                processingMode: "adaptive"
            }
        }
    };
    
    let responseData = null;
    const mockRes = {
        status: (code) => ({
            json: (data) => {
                responseData = data;
                return mockRes;
            }
        }),
        json: (data) => {
            responseData = data;
            return mockRes;
        }
    };
    
    try {
        await controller.processDocument(mockReq, mockRes);
        
        console.log('\n=== Response Analysis ===');
        console.log('Success:', responseData.success);
        console.log('Final dates count:', responseData.result.dates.length);
        console.log('Final dates:', responseData.result.dates);
        
        console.log('\n=== Pipeline Stages Analysis ===');
        if (responseData.hybrid && responseData.hybrid.pipelineStages) {
            responseData.hybrid.pipelineStages.forEach((stage, index) => {
                console.log(`\nStage ${index + 1}: ${stage.name}`);
                console.log('  Duration:', stage.duration, 'ms');
                console.log('  Results:', stage.results);
                console.log('  Success:', stage.success);
                
                if (stage.name === 'dateProcessing') {
                    console.log('  Nested Date Resolution:', stage.nestedDateResolution);
                    if (stage.processingDetails) {
                        console.log('  Processing Details:', JSON.stringify(stage.processingDetails, null, 2));
                    }
                }
            });
        }
        
        console.log('\n=== Result Merge Analysis ===');
        if (responseData.result.merge) {
            console.log('Merge ID:', responseData.result.merge.id);
            console.log('Strategy:', responseData.result.merge.strategy);
            console.log('Confidence Score:', responseData.result.merge.confidenceScore);
            console.log('Input Sources:', JSON.stringify(responseData.result.merge.inputSources, null, 2));
        }
        
        console.log('\n=== Primary Date Source ===');
        console.log('Primary Date Source:', responseData.result.primaryDateSource);
        
    } catch (error) {
        console.error('Error during processing:', error);
    }
}

debugPipelineStages().catch(console.error);