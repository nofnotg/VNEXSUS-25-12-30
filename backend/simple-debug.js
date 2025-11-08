import HybridController from './controllers/hybridController.js';

async function simpleDebug() {
  console.log('=== Simple Debug ===\n');
  
  const controller = new HybridController();
  const testText = "환자는 2024년 12월 15일에 내원하여 검사를 받았습니다.";
  
  console.log(`Test text: ${testText}\n`);
  
  try {
    // API 호출과 동일한 방식으로 처리 - mock request/response 객체 생성
    const mockReq = {
      body: {
        document: {
          text: testText
        },
        options: {
          processingMode: 'adaptive'
        }
      }
    };
    
    let responseData = null;
    const mockRes = {
      json: (data) => {
        responseData = data;
        return data;
      },
      status: (code) => ({ 
        json: (data) => {
          responseData = data;
          return data;
        }
      })
    };
    
    await controller.processDocument(mockReq, mockRes);
    
    console.log('Result success:', responseData?.success);
    console.log('Result dates count:', responseData?.dates?.length || 0);
    console.log('Result dates:', JSON.stringify(responseData?.dates, null, 2));
    
    if (responseData?.dates && responseData.dates.length > 0) {
      console.log('\n✅ Dates extracted successfully!');
    } else {
      console.log('\n❌ No dates extracted - investigating...');
      
      // 내부 결과 확인
      if (responseData?.result) {
        console.log('Internal result dateBlocks:', responseData.result.dateBlocks?.length || 0);
        console.log('Internal result confidence:', responseData.result.statistics?.averageConfidence || 0);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

simpleDebug().catch(console.error);