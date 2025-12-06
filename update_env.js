import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf-8');

console.log('현재 GOOGLE_APPLICATION_CREDENTIALS 설정:');
const currentMatch = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS=(.+)/);
if (currentMatch) {
    console.log('  ', currentMatch[1]);
}

// 올바른 경로로 업데이트
const correctPath = 'C:\\\\VisionKeys\\\\medreport-assistant-e4e428ceaad0.json';
envContent = envContent.replace(
    /GOOGLE_APPLICATION_CREDENTIALS=.+/,
    `GOOGLE_APPLICATION_CREDENTIALS=${correctPath}`
);

fs.writeFileSync(envPath, envContent, 'utf-8');
console.log('\n✅ .env 파일 업데이트 완료!');
console.log('새로운 GOOGLE_APPLICATION_CREDENTIALS:', correctPath);
console.log('\n⚠️ 서버를 재시작해야 변경사항이 적용됩니다.');
