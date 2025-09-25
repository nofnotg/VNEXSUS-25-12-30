import fs from 'fs/promises';
import { MedicalTimelineGenerator } from './MedicalTimelineGenerator.js';

const run = async () => {
  try {
    const text = await fs.readFile('./src/timeline/sampleRecords.txt', 'utf8');
    const generator = new MedicalTimelineGenerator();
    
    // 디버그 모드 비활성화
    generator.debug = false;

    const events = generator.extractEvents(text);
    
    console.log("\n최종 결과:");
    const output = generator.formatAsText(events);
    console.log(output);
    
  } catch (error) {
    console.error('오류 발생:', error);
  }
};

run(); 