/**
 * VNEXSUS Feedback Loop Orchestrator
 * 
 * 분석된 Diff 데이터를 기반으로 시스템을 학습시킵니다.
 * 오답 노트(Mistake Note)를 관리하고, Dynamic Few-Shot 프롬프트 생성을 돕습니다.
 * 
 * @version 1.0.0
 * @since 2025-12-06
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FuzzyMatcher from './FuzzyMatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MISTAKE_DB_PATH = path.join(__dirname, '..', 'data', 'mistakes.json');

class FeedbackLoop {
    constructor() {
        this.fuzzy = new FuzzyMatcher();
        this.mistakes = this.loadMistakes();
    }

    /**
     * 오답 노트 로드
     */
    loadMistakes() {
        if (fs.existsSync(MISTAKE_DB_PATH)) {
            return JSON.parse(fs.readFileSync(MISTAKE_DB_PATH, 'utf-8'));
        }
        return {
            hospitals: {}, // { "오타": "정답" }
            diagnoses: {}, // { "오타": "정답" }
            dates: []      // [ "누락된 패턴" ]
        };
    }

    /**
     * 오답 노트 저장
     */
    saveMistakes() {
        const dir = path.dirname(MISTAKE_DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(MISTAKE_DB_PATH, JSON.stringify(this.mistakes, null, 2));
    }

    /**
     * Diff 데이터를 기반으로 학습
     * @param {object} diff - DiffAnalyzer 결과
     */
    learn(diff) {
        if (!diff || !diff.changes) return;

        let learnedCount = 0;

        diff.changes.forEach(change => {
            // 병원명 오타 학습
            if (change.field === 'hospital' && change.type === 'MODIFY') {
                this.mistakes.hospitals[change.before] = change.after;
                // Fuzzy Matcher 사전에도 즉시 추가
                this.fuzzy.addToDictionary('hospital', change.after);
                learnedCount++;
            }

            // 진단명 오타/누락 학습
            if (change.field === 'diagnosis') {
                if (change.type === 'MODIFY') {
                    this.mistakes.diagnoses[change.before] = change.after;
                    learnedCount++;
                } else if (change.type === 'ADD') {
                    // 새로운 진단명은 사전에 추가
                    this.fuzzy.addToDictionary('diagnosis', change.value);
                    learnedCount++;
                }
            }
        });

        if (learnedCount > 0) {
            this.saveMistakes();
            console.log(`[FeedbackLoop] Learned ${learnedCount} new patterns.`);
        }
    }

    /**
     * 학습된 오답 노트 반환
     */
    getMistakes() {
        return this.mistakes;
    }

    /**
     * 프롬프트에 주입할 주의사항 생성 (Dynamic Few-Shot)
     */
    generateCautionPrompt() {
        const cautions = [];

        // 병원명 오타 주의사항
        const hospitalMistakes = Object.entries(this.mistakes.hospitals);
        if (hospitalMistakes.length > 0) {
            const examples = hospitalMistakes.slice(0, 3).map(([wrong, right]) => `'${wrong}' -> '${right}'`).join(', ');
            cautions.push(`- 병원명 오타 주의: ${examples} 등으로 자동 수정하세요.`);
        }

        return cautions.join('\n');
    }
}

export default FeedbackLoop;
