/**
 * Phase 2 Feedback Loop 시뮬레이션 테스트
 * 
 * 1. AI가 오답을 낸 상황을 가정 (Original)
 * 2. 사용자가 수정한 데이터를 전송 (Corrected)
 * 3. 시스템이 이를 학습하고 (Learn)
 * 4. 오답 노트(Mistakes)와 개선된 프롬프트(Caution)를 생성하는지 검증
 */

import CorrectionController from './controllers/CorrectionController.js';
import FeedbackLoop from './utils/FeedbackLoop.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 테스트 데이터 정리
const FEEDBACK_DIR = path.join(__dirname, 'data', 'feedback');
const MISTAKE_DB_PATH = path.join(__dirname, 'data', 'mistakes.json');

if (fs.existsSync(FEEDBACK_DIR)) fs.rmSync(FEEDBACK_DIR, { recursive: true, force: true });
if (fs.existsSync(MISTAKE_DB_PATH)) fs.rmSync(MISTAKE_DB_PATH, { force: true });

// Mock Request/Response
const req = {
    body: {
        caseId: 'TEST_CASE_001',
        original: {
            fields: {
                hospitals: [{ name: '강북삼성' }], // 오답 (줄임말)
                diagnoses: [{ diagnosis: '위암' }], // 오답 (코드 누락)
                dates: []
            }
        },
        corrected: {
            fields: {
                hospitals: [{ name: '강북삼성병원' }], // 정답
                diagnoses: [
                    { diagnosis: '위암' },
                    { diagnosis: '고혈압' } // 추가된 진단
                ],
                dates: [{ normalized: '2025-12-06' }] // 추가된 날짜
            }
        }
    }
};

const res = {
    json: (data) => {
        console.log('[API Response]', JSON.stringify(data, null, 2));
        return data;
    },
    status: (code) => {
        console.log(`[API Status] ${code}`);
        return { json: (data) => console.log(data) };
    }
};

async function runTest() {
    console.log('='.repeat(60));
    console.log('VNEXSUS Phase 2 Feedback Loop 테스트');
    console.log('='.repeat(60));

    // 1. 수정 요청 처리 (학습 트리거)
    console.log('\n1. 사용자 수정 요청 전송...');
    await CorrectionController.saveCorrection(req, res);

    // 2. 학습 결과 검증
    console.log('\n2. 학습 결과 검증...');
    const feedbackLoop = new FeedbackLoop();
    const mistakes = feedbackLoop.getMistakes();

    console.log('오답 노트:', JSON.stringify(mistakes, null, 2));

    // 검증 로직
    const hospitalLearned = mistakes.hospitals['강북삼성'] === '강북삼성병원';
    const diagnosisLearned = feedbackLoop.fuzzy.matchDiagnosis('고혈압') !== null; // 사전에 추가되었는지 확인

    console.log(`- 병원명 오타 학습 성공: ${hospitalLearned ? '✅' : '❌'}`);
    console.log(`- 새로운 진단명 학습 성공: ${diagnosisLearned ? '✅' : '❌'}`);

    // 3. Dynamic Few-Shot 프롬프트 생성
    console.log('\n3. Dynamic Few-Shot 프롬프트 생성...');
    const cautionPrompt = feedbackLoop.generateCautionPrompt();
    console.log('생성된 프롬프트:\n', cautionPrompt);

    const promptGenerated = cautionPrompt.includes('강북삼성');
    console.log(`- 프롬프트 생성 성공: ${promptGenerated ? '✅' : '❌'}`);

    console.log('\n' + '='.repeat(60));

    // 결과 파일 저장
    const result = {
        success: hospitalLearned && diagnosisLearned && promptGenerated,
        hospitalLearned,
        diagnosisLearned,
        promptGenerated,
        mistakes,
        cautionPrompt
    };

    fs.writeFileSync(path.join(__dirname, 'phase2-test-result.json'), JSON.stringify(result, null, 2));
    console.log('테스트 완료. 결과 저장됨.');
}

runTest().catch(console.error);
