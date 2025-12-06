/**
 * add-dispute-flag.js
 * 
 * ENABLE_DISPUTE_TAGGING 환경 변수를 .env 파일에 추가하는 스크립트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');

try {
    // .env 파일 읽기
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // ENABLE_DISPUTE_TAGGING이 이미 있는지 확인
    if (envContent.includes('ENABLE_DISPUTE_TAGGING')) {
        console.log('✅ ENABLE_DISPUTE_TAGGING already exists in .env');
        process.exit(0);
    }

    // 새로운 환경 변수 추가
    const newLine = '\n# Master Plan Phase 1: Dispute Layer Feature Flag\n# Set to "true" to enable DisputeTag generation (default: false)\nENABLE_DISPUTE_TAGGING=false\n';

    envContent += newLine;

    // .env 파일에 쓰기
    fs.writeFileSync(envPath, envContent, 'utf-8');

    console.log('✅ Successfully added ENABLE_DISPUTE_TAGGING to .env');
    console.log('   Default value: false (disabled)');
    console.log('   To enable: Set ENABLE_DISPUTE_TAGGING=true in .env');
} catch (error) {
    console.error('❌ Error adding ENABLE_DISPUTE_TAGGING:', error.message);
    process.exit(1);
}
