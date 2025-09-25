#!/usr/bin/env node
/**
 * 설정 보호 스크립트
 * 핵심 설정 파일들의 변경을 감지하고 경고를 표시합니다.
 * 
 * 사용법: node scripts/protect-config.js
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

class ConfigProtector {
    constructor() {
        this.protectedFiles = {
            // 백엔드 핵심 파일
            'backend/app.js': {
                critical: true,
                description: '백엔드 메인 서버 파일'
            },
            'backend/routes/ocrRoutes.js': {
                critical: true,
                description: 'OCR API 라우트 설정'
            },
            'backend/package.json': {
                critical: false,
                description: '백엔드 의존성 설정'
            },
            
            // 프론트엔드 핵심 파일
            'frontend/script.js': {
                critical: true,
                description: '프론트엔드 메인 로직'
            },
            'frontend/index.html': {
                critical: true,
                description: '메인 페이지'
            },
            'frontend/config/insurers.json': {
                critical: false,
                description: '보험사 설정'
            },
            
            // 환경 설정
            '.env': {
                critical: true,
                description: '환경 변수 설정'
            }
        };
        
        this.hashFile = path.join(rootDir, '.config-hashes.json');
    }

    // 파일 해시 계산
    calculateFileHash(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return crypto.createHash('sha256').update(content).digest('hex');
        } catch (error) {
            return null;
        }
    }

    // 저장된 해시 로드
    loadStoredHashes() {
        try {
            if (fs.existsSync(this.hashFile)) {
                return JSON.parse(fs.readFileSync(this.hashFile, 'utf8'));
            }
        } catch (error) {
            console.warn('⚠️ 저장된 해시 파일을 읽을 수 없습니다:', error.message);
        }
        return {};
    }

    // 해시 저장
    saveHashes(hashes) {
        try {
            fs.writeFileSync(this.hashFile, JSON.stringify(hashes, null, 2));
        } catch (error) {
            console.error('❌ 해시 파일 저장 실패:', error.message);
        }
    }

    // 현재 해시 계산
    calculateCurrentHashes() {
        const hashes = {};
        
        for (const [relativePath, config] of Object.entries(this.protectedFiles)) {
            const fullPath = path.join(rootDir, relativePath);
            const hash = this.calculateFileHash(fullPath);
            
            if (hash) {
                hashes[relativePath] = {
                    hash,
                    timestamp: new Date().toISOString(),
                    critical: config.critical,
                    description: config.description
                };
            }
        }
        
        return hashes;
    }

    // 변경 사항 검사
    checkForChanges() {
        console.log('🔍 설정 파일 변경 사항을 검사합니다...');
        
        const storedHashes = this.loadStoredHashes();
        const currentHashes = this.calculateCurrentHashes();
        
        const changes = [];
        const newFiles = [];
        
        // 변경된 파일 검사
        for (const [filePath, currentData] of Object.entries(currentHashes)) {
            const storedData = storedHashes[filePath];
            
            if (!storedData) {
                newFiles.push({
                    path: filePath,
                    ...currentData
                });
            } else if (storedData.hash !== currentData.hash) {
                changes.push({
                    path: filePath,
                    ...currentData,
                    lastModified: storedData.timestamp
                });
            }
        }
        
        return { changes, newFiles, currentHashes };
    }

    // 초기 해시 생성
    initializeHashes() {
        console.log('🔧 설정 파일 보호를 초기화합니다...');
        
        const currentHashes = this.calculateCurrentHashes();
        this.saveHashes(currentHashes);
        
        console.log('✅ 설정 파일 해시가 생성되었습니다.');
        console.log(`📁 보호 대상 파일: ${Object.keys(currentHashes).length}개`);
        
        Object.entries(currentHashes).forEach(([path, data]) => {
            const status = data.critical ? '🚨 중요' : '📄 일반';
            console.log(`  ${status} ${path}: ${data.description}`);
        });
    }

    // 변경 사항 보고
    reportChanges() {
        const { changes, newFiles, currentHashes } = this.checkForChanges();
        
        if (changes.length === 0 && newFiles.length === 0) {
            console.log('✅ 모든 설정 파일이 안전합니다.');
            return true;
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🚨 설정 파일 변경 감지!');
        console.log('='.repeat(60));
        
        if (changes.length > 0) {
            console.log('\n📝 변경된 파일:');
            changes.forEach(change => {
                const criticality = change.critical ? '🚨 중요' : '📄 일반';
                console.log(`  ${criticality} ${change.path}`);
                console.log(`    설명: ${change.description}`);
                console.log(`    마지막 확인: ${change.lastModified}`);
                console.log(`    현재 시간: ${change.timestamp}`);
                
                if (change.critical) {
                    console.log('    ⚠️ 이 파일은 시스템 핵심 파일입니다!');
                    console.log('    ⚠️ 변경 전에 개발팀과 상의하세요!');
                }
                console.log('');
            });
        }
        
        if (newFiles.length > 0) {
            console.log('\n🆕 새로운 파일:');
            newFiles.forEach(file => {
                console.log(`  📄 ${file.path}: ${file.description}`);
            });
        }
        
        console.log('\n🔧 해시를 업데이트하려면: node scripts/protect-config.js --update');
        console.log('📖 자세한 정보: DEPLOYMENT_GUIDE.md 참조');
        
        return false;
    }

    // 해시 업데이트
    updateHashes() {
        console.log('🔄 설정 파일 해시를 업데이트합니다...');
        
        const { changes, newFiles, currentHashes } = this.checkForChanges();
        
        if (changes.length > 0 || newFiles.length > 0) {
            this.saveHashes(currentHashes);
            console.log('✅ 해시가 업데이트되었습니다.');
            
            if (changes.some(c => c.critical)) {
                console.log('\n⚠️ 중요한 파일이 변경되었습니다!');
                console.log('⚠️ 시스템 테스트를 권장합니다.');
            }
        } else {
            console.log('✅ 변경 사항이 없습니다.');
        }
    }

    // 메인 실행 함수
    run() {
        const args = process.argv.slice(2);
        
        if (args.includes('--init')) {
            this.initializeHashes();
        } else if (args.includes('--update')) {
            this.updateHashes();
        } else {
            const isClean = this.reportChanges();
            if (!isClean) {
                process.exit(1);
            }
        }
    }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
    const protector = new ConfigProtector();
    protector.run();
}

export default ConfigProtector;