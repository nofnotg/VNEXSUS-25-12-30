const http = require('http');

const data = JSON.stringify({
  files: [{
    filename: 'test.txt',
    content: '환자는 2024년 12월 15일에 초진을 받았으며, 2024년 11월 20일부터 증상이 시작되었습니다.',
    size: 100,
    mimetype: 'text/plain'
  }]
});

const req = http.request({
  hostname: 'localhost',
  port: 3030,
  path: '/api/hybrid/process',
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      console.log('Success:', result.success);
      console.log('Dates found:', result.processedData?.dates?.length || 0);
      console.log('Medical events:', result.processedData?.medicalEvents?.length || 0);
      console.log('Final confidence:', result.processedData?.confidence || 0);
      
      if (result.processedData?.dates?.length > 0) {
        console.log('\nFirst few dates:');
        result.processedData.dates.slice(0, 3).forEach((date, i) => {
          console.log(`  ${i+1}. ${date.date || date} (confidence: ${date.confidence || 'N/A'})`);
        });
      }
      
      console.log('\nPipeline stages:');
      result.pipelineStages?.forEach(stage => {
        console.log(`  ${stage.name}: ${stage.duration}ms`);
      });
      
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw response:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  console.error('Full error:', e);
});

req.setTimeout(5000, () => {
  console.log('Request timeout');
  req.destroy();
});

req.write(data);
req.end();