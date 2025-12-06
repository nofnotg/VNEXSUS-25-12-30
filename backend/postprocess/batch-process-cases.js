/**
 * 전체 케이스 파이프라인 재처리 스크립트 (ESM)
 * 
 * src/rag/case_sample/CaseN.txt 파일들을 postprocess 파이프라인으로 처리하여
 * backend/postprocess/test_outputs/caseN_extended_result.json 생성
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postProcessor from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CASE_SAMPLE_DIR = path.join(__dirname, '../../src/rag/case_sample');
const TEST_OUTPUT_DIR = path.join(__dirname, 'test_outputs');

function findAllCases() {
    const files = fs.readdirSync(CASE_SAMPLE_DIR);
    const cases = [];

    for (const file of files) {
        const match = file.match(/^Case(\d+)\.txt$/i);
        if (match) {
            cases.push({
                caseNumber: parseInt(match[1]),
                txtPath: path.join(CASE_SAMPLE_DIR, file),
                reportPath: path.join(CASE_SAMPLE_DIR, file.replace(/\.txt$/i, '_report.txt'))
            });
        }
    }

    return cases.sort((a, b) => a.caseNumber - b.caseNumber);
}

async function processSingleCase(caseInfo) {
    const { caseNumber, txtPath } = caseInfo;
    const outputPath = path.join(TEST_OUTPUT_DIR, `case${caseNumber}_extended_result.json`);

    // 이미 처리된 케이스는 스킵
    if (fs.existsSync(outputPath)) {
        const stat = fs.statSync(outputPath);
        // 1KB 이상이면 유효한 결과로 간주
        if (stat.size > 1024) {
            console.log(`  ⏭️ Case ${caseNumber}: 이미 처리됨 (${(stat.size / 1024).toFixed(1)}KB)`);
            return { caseNumber, status: 'skipped', size: stat.size };
        }
    }

    try {
        const content = fs.readFileSync(txtPath, 'utf-8');
        if (content.length < 100) {
            console.log(`  ⚠️ Case ${caseNumber}: 내용 너무 짧음 (${content.length}자)`);
            return { caseNumber, status: 'too_short', length: content.length };
        }

        console.log(`  🔄 Case ${caseNumber}: 처리 중... (${content.length}자)`);

        const options = {
            reportFormat: 'json',
            useEnhancedExtractors: true,  // 개선된 추출기 사용
            includeRawText: false,
            sortDirection: 'asc',
            periodType: 'all',
            // 보험 정보 기본값 제공 (preEnroll3M 오류 방지)
            patientInfo: {
                name: `Case${caseNumber}`,
                enrollmentDate: new Date().toISOString().split('T')[0]
            }
        };

        const startTime = Date.now();
        const result = await postProcessor.processForMainApp(content, options);
        const duration = Date.now() - startTime;

        // 결과 저장
        const output = {
            caseNumber,
            processedAt: new Date().toISOString(),
            duration,
            inputLength: content.length,
            fullResult: result
        };

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`  ✅ Case ${caseNumber}: 완료 (${(duration / 1000).toFixed(1)}s)`);

        return { caseNumber, status: 'success', duration, outputSize: JSON.stringify(output).length };

    } catch (error) {
        console.error(`  ❌ Case ${caseNumber}: 오류 - ${error.message}`);
        console.error(`     Stack: ${error.stack?.split('\n')[1] || 'N/A'}`);
        return { caseNumber, status: 'error', error: error.message };
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('전체 케이스 파이프라인 재처리');
    console.log('='.repeat(60));

    // 출력 디렉토리 확인
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
        fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }

    console.log('\n✅ PostProcessor 로드 완료');

    // 모든 케이스 찾기
    const allCases = findAllCases();
    console.log(`\n📂 총 ${allCases.length}개 케이스 발견\n`);

    // 처리 결과 수집
    const results = {
        success: [],
        skipped: [],
        errors: [],
        tooShort: []
    };

    for (const caseInfo of allCases) {
        const result = await processSingleCase(caseInfo);

        switch (result.status) {
            case 'success': results.success.push(result); break;
            case 'skipped': results.skipped.push(result); break;
            case 'error': results.errors.push(result); break;
            case 'too_short': results.tooShort.push(result); break;
        }
    }

    // 요약 출력
    console.log('\n' + '='.repeat(60));
    console.log('처리 완료 요약');
    console.log('='.repeat(60));
    console.log(`✅ 성공: ${results.success.length}개`);
    console.log(`⏭️ 스킵: ${results.skipped.length}개 (이미 처리됨)`);
    console.log(`⚠️ 너무 짧음: ${results.tooShort.length}개`);
    console.log(`❌ 오류: ${results.errors.length}개`);

    if (results.errors.length > 0) {
        console.log('\n오류 발생 케이스:');
        results.errors.forEach(e => console.log(`  - Case ${e.caseNumber}: ${e.error}`));
    }

    // 결과 저장
    const summaryPath = path.join(TEST_OUTPUT_DIR, 'batch_process_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalCases: allCases.length,
        results
    }, null, 2));

    console.log(`\n📄 결과 저장: ${summaryPath}`);
}

main().catch(err => {
    console.error('처리 실패:', err);
    process.exit(1);
});
