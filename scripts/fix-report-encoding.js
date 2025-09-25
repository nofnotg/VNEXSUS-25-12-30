const fs = require('fs');
const iconv = require('iconv-lite');

console.log('📋 실제 보고서 인코딩 수정 시작...');

const reportFiles = [
  'Case1_report.txt', 'Cast2_report.txt', 'Cast3_report.txt', 'Cast4_report.txt',
  'Cast5_report.txt', 'Cast6_report.txt', 'Cast7_report.txt', 'Cast8_report.txt',
  'Cast9_report.txt', 'Cast10_report.txt', 'Cast11_report.txt', 'Cast12_report.txt'
];

let fixedCount = 0;

reportFiles.forEach(filename => {
  const filepath = `documents/fixtures/${filename}`;
  try {
    if (fs.existsSync(filepath)) {
      const buffer = fs.readFileSync(filepath);
      
      // EUC-KR로 디코딩 시도
      const decoded = iconv.decode(buffer, 'euc-kr');
      
      // UTF-8로 재저장
      fs.writeFileSync(filepath, decoded, 'utf8');
      
      console.log(`✅ ${filename} 인코딩 수정 완료`);
      fixedCount++;
    } else {
      console.log(`⚠️ ${filename} 파일 없음`);
    }
  } catch (error) {
    console.error(`❌ ${filename} 수정 실패:`, error.message);
  }
});

console.log(`\n📊 총 ${fixedCount}개 보고서 인코딩 수정 완료`); 