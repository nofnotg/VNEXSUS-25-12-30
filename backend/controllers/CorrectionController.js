/**
 * VNEXSUS Correction Controller (T-201)
 * 
 * 사용자의 수정 요청을 처리하고 피드백 데이터를 저장합니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import DiffAnalyzer from '../utils/DiffAnalyzer.js';
import FeedbackLoop from '../utils/FeedbackLoop.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 피드백 데이터 저장 경로
const DATA_DIR = path.join(__dirname, '..', 'data');
const FEEDBACK_DIR = path.join(DATA_DIR, 'feedback');

class CorrectionController {
    constructor() {
        this.diffAnalyzer = new DiffAnalyzer();
        this.feedbackLoop = new FeedbackLoop();
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(FEEDBACK_DIR)) {
            fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
        }
    }

    /**
     * 사용자 수정 내역 저장 (POST /api/correction)
     */
    async saveCorrection(req, res) {
        try {
            this.ensureDirectories(); // 저장 시점에도 확인
            const { caseId, original, corrected } = req.body;

            if (!caseId || !original || !corrected) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            // 1. 차이 분석
            const diff = this.diffAnalyzer.analyze(original, corrected);

            // 2. 피드백 데이터 생성
            const feedbackData = {
                caseId,
                timestamp: new Date().toISOString(),
                original,
                corrected,
                diff
            };

            // 3. 파일로 저장
            const filePath = path.join(FEEDBACK_DIR, `${caseId}_${Date.now()}.json`);
            fs.writeFileSync(filePath, JSON.stringify(feedbackData, null, 2));

            // 4. 피드백 루프 실행 (비동기 학습)
            if (diff.hasChanges) {
                this.feedbackLoop.learn(diff);
            }

            return res.json({
                success: true,
                message: 'Correction saved successfully',
                diffSummary: {
                    changeCount: diff.changeCount,
                    changes: diff.changes
                }
            });

        } catch (error) {
            console.error('[CorrectionController] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * 학습된 오답 노트 조회 (GET /api/correction/mistakes)
     */
    async getMistakes(req, res) {
        try {
            const mistakes = this.feedbackLoop.getMistakes();
            return res.json({ success: true, mistakes });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
}

export default new CorrectionController();
