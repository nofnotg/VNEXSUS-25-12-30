/**
 * VNEXSUS 파이프라인 검증 스크립트
 * 샘플 텍스트로 전체 워크플로우 테스트
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔬 VNEXSUS 파이프라인 검증 시작\n');
console.log('='.repeat(80));

// 샘플 텍스트 로드
const sampleTextPath = path.join(__dirname, 'test-sample-medical-record.txt');
const sampleText = fs.readFileSync(sampleTextPath, 'utf-8');

console.log('\n📄 샘플 텍스트 로드 완료');
console.log(`   길이: ${sampleText.length} 문자`);
console.log(`   내용 미리보기: ${sampleText.substring(0, 100)}...`);

// API 테스트 함수
async function testPipeline() {
    const testResults = {
        timestamp: new Date().toISOString(),
        stages: [],
        overallSuccess: true
    };

    try {
        // Stage 1: OCR 업로드 시뮬레이션 (텍스트 파일 업로드)
        console.log('\n' + '='.repeat(80));
        console.log('📤 Stage 1: 파일 업로드 및 OCR 처리');
        console.log('='.repeat(80));

        const formData = new FormData();
        formData.append('files', fs.createReadStream(sampleTextPath), {
            filename: 'test-medical-record.txt',
            contentType: 'text/plain'
        });

        const uploadResponse = await fetch('http://localhost:3030/api/ocr/upload', {
            method: 'POST',
            body: formData
        });

        const uploadResult = await uploadResponse.json();
        console.log('✅ 업로드 완료:', JSON.stringify(uploadResult, null, 2));

        testResults.stages.push({
            stage: 'upload',
            success: uploadResult.success || false,
            jobId: uploadResult.jobId,
            data: uploadResult
        });

        if (!uploadResult.jobId) {
            throw new Error('Job ID를 받지 못했습니다');
        }

        const jobId = uploadResult.jobId;

        // Stage 2: 처리 상태 확인
        console.log('\n' + '='.repeat(80));
        console.log('⏳ Stage 2: 처리 상태 확인');
        console.log('='.repeat(80));

        let attempts = 0;
        let status = null;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기

            const statusResponse = await fetch(`http://localhost:3030/api/ocr/status/${jobId}`);
            status = await statusResponse.json();

            console.log(`   시도 ${attempts + 1}/${maxAttempts}: ${status.status || 'unknown'}`);

            if (status.status === 'completed' || status.status === 'error') {
                break;
            }

            attempts++;
        }

        testResults.stages.push({
            stage: 'status_check',
            success: status.status === 'completed',
            attempts,
            finalStatus: status.status,
            data: status
        });

        if (status.status !== 'completed') {
            throw new Error(`처리 실패: ${status.status}`);
        }

        console.log('✅ 처리 완료');

        // Stage 3: 결과 조회
        console.log('\n' + '='.repeat(80));
        console.log('📊 Stage 3: 처리 결과 조회');
        console.log('='.repeat(80));

        const resultResponse = await fetch(`http://localhost:3030/api/ocr/result/${jobId}`);
        const result = await resultResponse.json();

        let extractedText = '';
        if (result.results) {
            Object.values(result.results).forEach(fileResult => {
                extractedText += (fileResult.mergedText || '') + '\n';
            });
        } else if (result.extractedText) {
            extractedText = result.extractedText;
        }

        console.log('✅ 결과 조회 완료');
        console.log(`   추출된 텍스트 길이: ${extractedText.length} 문자`);
        console.log(`   파싱된 레코드 수: ${result.parsedRecords?.length || 0}`);

        testResults.stages.push({
            stage: 'result',
            success: extractedText.length > 0,
            textLength: extractedText.length,
            recordCount: result.parsedRecords?.length || 0,
            data: result
        });

        // Stage 4: Investigator View 생성
        console.log('\n' + '='.repeat(80));
        console.log('🔍 Stage 4: Investigator View 생성');
        console.log('='.repeat(80));

        const investigatorResponse = await fetch(`http://localhost:3030/api/ocr/investigator-view/${jobId}`);
        const investigatorView = await investigatorResponse.json();

        console.log('✅ Investigator View 생성 완료');
        console.log(`   에피소드 수: ${investigatorView.data?.episodes?.length || 0}`);
        console.log(`   타임라인 이벤트 수: ${investigatorView.data?.timeline?.length || 0}`);

        testResults.stages.push({
            stage: 'investigator_view',
            success: investigatorView.success,
            episodeCount: investigatorView.data?.episodes?.length || 0,
            timelineCount: investigatorView.data?.timeline?.length || 0,
            data: investigatorView
        });

        // Stage 5: 보고서 품질 검증
        // Stage 5: 보고서 품질 검증
        console.log('\n' + '='.repeat(80));
        console.log('📝 Stage 5: 보고서 품질 검증');
        console.log('='.repeat(80));

        const qualityChecks = {
            hasEpisodes: (investigatorView.data?.episodes?.length || 0) > 0,
            hasTimeline: (investigatorView.data?.timeline?.length || 0) > 0,
            hasClaimInfo: !!investigatorView.data?.claimInfo,
            hasDisputeInfo: !!investigatorView.data?.disputeInfo,
            textExtracted: (extractedText?.length || 0) > 0,
            recordsParsed: (investigatorView.parsedRecords?.length || 0) > 0 // Phase 4: investigatorView에서 확인
        };

        console.log('품질 체크 결과:');
        Object.entries(qualityChecks).forEach(([check, passed]) => {
            console.log(`   ${passed ? '✅' : '❌'} ${check}`);
        });

        const qualityScore = Object.values(qualityChecks).filter(Boolean).length / Object.keys(qualityChecks).length;
        console.log(`\n   전체 품질 점수: ${(qualityScore * 100).toFixed(1)}%`);

        testResults.stages.push({
            stage: 'quality_check',
            success: qualityScore >= 0.7,
            score: qualityScore,
            checks: qualityChecks
        });

        // 최종 결과
        console.log('\n' + '='.repeat(80));
        console.log('🎯 최종 결과');
        console.log('='.repeat(80));

        testResults.overallSuccess = testResults.stages.every(stage => stage.success);

        console.log(`\n전체 파이프라인: ${testResults.overallSuccess ? '✅ 성공' : '❌ 실패'}`);
        console.log(`완료된 단계: ${testResults.stages.filter(s => s.success).length}/${testResults.stages.length}`);

        // 결과를 파일로 저장
        fs.writeFileSync(
            path.join(__dirname, 'pipeline-test-results.json'),
            JSON.stringify(testResults, null, 2)
        );

        console.log('\n📁 상세 결과가 pipeline-test-results.json에 저장되었습니다.');

        return testResults;

    } catch (error) {
        console.error('\n❌ 파이프라인 테스트 실패:', error.message);
        console.error(error.stack);
        testResults.overallSuccess = false;
        testResults.error = error.message;
        testResults.errorStack = error.stack;
        return testResults;
    }
}

// 테스트 실행
testPipeline()
    .then(results => {
        console.log('\n' + '='.repeat(80));
        console.log('테스트 완료');
        console.log('='.repeat(80));
        process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch(error => {
        console.error('치명적 오류:', error);
        process.exit(1);
    });
