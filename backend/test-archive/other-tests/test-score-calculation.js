import HybridController from './controllers/hybridController.js';

// 테스트용 결과 데이터 생성
const testResults = [
  {
    name: 'legacy',
    result: {
      confidence: 0.8,
      processingTime: 150,
      dateBlocks: [
        { date: '2024-12-15', confidence: 0.8, source: 'legacy' }
      ],
      errors: []
    }
  },
  {
    name: 'core',
    result: {
      confidence: 0.9,
      processingTime: 200,
      dateBlocks: [
        { date: '2024-12-15', confidence: 0.9, source: 'core' }
      ],
      errors: []
    }
  },
  {
    name: 'hybrid',
    result: {
      confidence: 0.95,
      processingTime: 300,
      dateBlocks: [
        { date: '2024-12-15', confidence: 0.95, source: 'hybrid' },
        { date: '2024-12-14', confidence: 0.85, source: 'hybrid' }
      ],
      errors: []
    }
  },
  {
    name: 'adaptive',
    result: {
      confidence: 0.95,
      processingTime: 350,
      dateBlocks: [
        { date: '2024-12-15', confidence: 0.95, source: 'adaptive' },
        { date: '2024-12-14', confidence: 0.85, source: 'adaptive' }
      ],
      errors: []
    }
  },
  {
    name: 'empty',
    result: {
      confidence: 0,
      processingTime: 100,
      dateBlocks: [],
      errors: []
    }
  }
];

async function testScoreCalculation() {
  console.log('=== Score Calculation Test ===\n');
  
  const controller = new HybridController();
  
  // 각 결과의 점수 계산
  testResults.forEach(({ name, result }) => {
    const score = controller.calculateResultScore(result, 'date');
    console.log(`${name} result:`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Processing Time: ${result.processingTime}ms`);
    console.log(`  Date Blocks: ${result.dateBlocks.length}`);
    console.log(`  Calculated Score: ${score.toFixed(4)}`);
    console.log('');
  });
  
  // selectBestResult 테스트
  console.log('=== Best Result Selection Test ===\n');
  
  const dateResults = testResults.map(({ result }) => result);
  const bestResult = controller.selectBestResult(dateResults, 'date');
  
  console.log('Best result selected:');
  console.log(`  Confidence: ${bestResult.confidence}`);
  console.log(`  Processing Time: ${bestResult.processingTime}ms`);
  console.log(`  Date Blocks: ${bestResult.dateBlocks.length}`);
  console.log(`  Date Blocks Content:`, JSON.stringify(bestResult.dateBlocks, null, 2));
  
  // extractDatesFromResult 테스트
  console.log('\n=== Extract Dates Test ===\n');
  
  const extractedDates = controller.extractDatesFromResult(bestResult);
  console.log('Extracted dates:', JSON.stringify(extractedDates, null, 2));
}

testScoreCalculation().catch(console.error);