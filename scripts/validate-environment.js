#!/usr/bin/env node
/**
 * 환경 설정 검증 스크립트
 * 시스템의 핵심 설정들이 올바르게 구성되어 있는지 확인합니다.
 * 
 * 사용법: node scripts/validate-environment.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// .env 파일 로드
dotenv.config({ path: path.join(rootDir, '.env') });

class EnvironmentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.success = [];
    }

    // 필수 환경 변수 검증
    validateRequiredEnvVars() {
        console.log('\n🔍 필수 환경 변수 검증 중...');
        
        const requiredVars = {
            // 서버 설정 (절대 변경 금지)
            'PORT': { expected: '3030', critical: true },
            'NODE_ENV': { expected: 'production', critical: true },
            
            // OCR 설정 (절대 변경 금지)
            'ENABLE_VISION_OCR': { expected: 'true', critical: true },
            'USE_VISION': { expected: 'true', critical: true },
            'USE_TEXTRACT': { expected: 'false', critical: true },
            
            // Google Cloud 설정 (환경별 설정)
            'GCP_PROJECT_ID': { required: true },
            'GOOGLE_APPLICATION_CREDENTIALS': { required: true },
            'GOOGLE_CLOUD_VISION_API_KEY': { required: true },
            'GCS_BUCKET_NAME': { required: true },
        };

        for (const [varName, config] of Object.entries(requiredVars)) {
            const value = process.env[varName];
            
            if (!value) {
                this.errors.push(`❌ ${varName}: 설정되지 않음`);
                continue;
            }
            
            if (config.expected && value !== config.expected) {
                if (config.critical) {
                    this.errors.push(`🚨 ${varName}: 예상값 '${config.expected}', 실제값 '${value}' (시스템 핵심 설정)`);
                } else {
                    this.warnings.push(`⚠️ ${varName}: 예상값 '${config.expected}', 실제값 '${value}'`);
                }
            } else {
                this.success.push(`✅ ${varName}: ${config.expected || '설정됨'}`);
            }
        }
    }

    // 파일 존재 여부 검증
    validateFiles() {
        console.log('\n🔍 필수 파일 존재 여부 검증 중...');
        
        const requiredFiles = [
            // 백엔드 핵심 파일
            'backend/app.js',
            'backend/routes/ocrRoutes.js',
            'backend/package.json',
            
            // 프론트엔드 핵심 파일
            'frontend/index.html',
            'frontend/script.js',
            'frontend/config/insurers.json',
            
            // 설정 파일
            '.env'
        ];

        for (const filePath of requiredFiles) {
            const fullPath = path.join(rootDir, filePath);
            if (fs.existsSync(fullPath)) {
                this.success.push(`✅ ${filePath}: 존재함`);
            } else {
                this.errors.push(`❌ ${filePath}: 파일이 존재하지 않음`);
            }
        }
    }

    // Google Cloud 인증 파일 검증
    validateGoogleCloudAuth() {
        console.log('\n🔍 Google Cloud 인증 설정 검증 중...');
        
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (!credentialsPath) {
            this.errors.push('❌ GOOGLE_APPLICATION_CREDENTIALS: 설정되지 않음');
            return;
        }

        if (fs.existsSync(credentialsPath)) {
            this.success.push(`✅ Google Cloud 인증 파일: ${credentialsPath}`);
            
            try {
                const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
                if (credentials.project_id && credentials.private_key) {
                    this.success.push('✅ 인증 파일 형식: 유효함');
                } else {
                    this.warnings.push('⚠️ 인증 파일: 필수 필드가 누락될 수 있음');
                }
            } catch (error) {
                this.errors.push(`❌ 인증 파일 파싱 오류: ${error.message}`);
            }
        } else {
            this.errors.push(`❌ Google Cloud 인증 파일이 존재하지 않음: ${credentialsPath}`);
        }
    }

    // CORS 설정 검증
    validateCorsSettings() {
        console.log('\n🔍 CORS 설정 검증 중...');
        
        const corsFiles = [
            'backend/app.js',
            'backend/routes/ocrRoutes.js'
        ];

        for (const filePath of corsFiles) {
            const fullPath = path.join(rootDir, filePath);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('http://localhost:8080')) {
                    this.success.push(`✅ ${filePath}: CORS 설정에 포트 8080 포함됨`);
                } else {
                    this.warnings.push(`⚠️ ${filePath}: CORS 설정에 포트 8080이 없을 수 있음`);
                }
            }
        }
    }

    // 결과 출력
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🔍 환경 설정 검증 결과');
        console.log('='.repeat(60));

        if (this.success.length > 0) {
            console.log('\n✅ 성공:');
            this.success.forEach(msg => console.log(`  ${msg}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️ 경고:');
            this.warnings.forEach(msg => console.log(`  ${msg}`));
        }

        if (this.errors.length > 0) {
            console.log('\n❌ 오류:');
            this.errors.forEach(msg => console.log(`  ${msg}`));
            console.log('\n🚨 시스템이 정상 동작하지 않을 수 있습니다!');
            console.log('📖 DEPLOYMENT_GUIDE.md를 참조하여 설정을 확인하세요.');
            process.exit(1);
        } else {
            console.log('\n🎉 모든 검증을 통과했습니다!');
            console.log('✅ 시스템이 정상 동작할 준비가 되었습니다.');
        }
    }

    // 전체 검증 실행
    async validate() {
        console.log('🔍 MediAI 시스템 환경 검증을 시작합니다...');
        
        this.validateRequiredEnvVars();
        this.validateFiles();
        this.validateGoogleCloudAuth();
        this.validateCorsSettings();
        
        this.printResults();
    }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new EnvironmentValidator();
    validator.validate().catch(console.error);
}

export default EnvironmentValidator;