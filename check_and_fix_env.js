import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf-8');

console.log('=== 현재 .env 파일 내용 (GOOGLE 관련만) ===\n');
const lines = envContent.split('\n');
lines.forEach(line => {
    if (line.includes('GOOGLE') || line.includes('GCS') || line.includes('GCP')) {
        console.log(line);
    }
});

console.log('\n=== 수정 작업 시작 ===');

// 잘못된 경로를 올바른 경로로 교체
const oldPath = 'C:\\\\VisionKeys\\\\medreport-assistant-2d733c1156cb.json';
const newPath = 'C:\\\\VisionKeys\\\\medreport-assistant-e4e428ceaad0.json';

if (envContent.includes('2d733c1156cb')) {
    envContent = envContent.replace(/medreport-assistant-2d733c1156cb\.json/g, 'medreport-assistant-e4e428ceaad0.json');
    fs.writeFileSync(envPath, envContent, 'utf-8');
    console.log('✅ 파일 경로 수정 완료!');
} else {
    console.log('ℹ️ 이미 올바른 경로로 설정되어 있습니다.');
}

console.log('\n=== 수정 후 .env 파일 내용 (GOOGLE 관련만) ===\n');
const updatedContent = fs.readFileSync(envPath, 'utf-8');
const updatedLines = updatedContent.split('\n');
updatedLines.forEach(line => {
    if (line.includes('GOOGLE') || line.includes('GCS') || line.includes('GCP')) {
        console.log(line);
    }
});
