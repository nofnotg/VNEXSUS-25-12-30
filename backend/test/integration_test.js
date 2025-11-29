/**
 * VNEXSUS Integration Test
 * 
 * Phase 0-2 통합 테스트
 * - MedicalEvent 생성
 * - SourceSpan 첨부
 * - Question Map 생성
 */

import medicalEventModel from '../postprocess/medicalEventModel.js';
import disclosureRulesEngine from '../postprocess/disclosureRulesEngine.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// 테스트 데이터
const sampleRawText = `
2024년 4월 9일 삼성서울병원 외과
환자: 홍길동 (남, 55세)

진단명: 위암 (C16.9)
주소: 상복부 통증, 체중 감소

검사 소견:
- 위내시경: 위체부에 약 3cm 크기의 궤양성 병변 관찰
- 조직검사: Adenocarcinoma (선암)
- CT: 국소 림프절 전이 의심

치료 계획:
- 위절제술 (Gastrectomy) 시행 예정
- 수술 날짜: 2024년 4월 15일

과거력:
- 2020년 고혈압 (I10) 진단, 현재 약물 복용 중
- 2022년 당뇨병 (E11.9) 진단, 인슐린 치료 중
`;

const sampleDateBlocks = [
    {
        date: '2024-04-09',
        hospital: '삼성서울병원',
        department: '외과',
        diagnosis: '위암',
        diagnosisCode: 'C16.9',
        rawText: sampleRawText,
        procedures: [
            { name: '위내시경' },
            { name: '조직검사' },
            { name: 'CT' }
        ],
        treatments: [
            { name: '위절제술' }
        ]
    },
    {
        date: '2020-01-01',
        hospital: '서울대병원',
        diagnosis: '고혈압',
        diagnosisCode: 'I10',
        rawText: '2020년 고혈압 진단',
        procedures: [],
        treatments: [
            { name: '약물 복용' }
        ]
    },
    {
        date: '2022-01-01',
        hospital: '서울대병원',
        diagnosis: '당뇨병',
        diagnosisCode: 'E11.9',
        rawText: '2022년 당뇨병 진단',
        procedures: [],
        treatments: [
            { name: '인슐린 치료' }
        ]
    }
];

const samplePatientInfo = {
    name: '홍길동',
    birthDate: '1969-01-01',
    enrollmentDate: '2024-03-01' // 가입일
};

// 테스트 실행
async function runIntegrationTest() {
    console.log('🧪 VNEXSUS 통합 테스트 시작\n');
    console.log('='.repeat(60));

    try {
        // Step 1: MedicalEvent 생성
        console.log('\n📋 Step 1: MedicalEvent 생성');
        console.log('-'.repeat(60));

        const events = medicalEventModel.buildEvents({
            dateBlocks: sampleDateBlocks,
            entities: {},
            rawText: sampleRawText,
            patientInfo: samplePatientInfo
        });

        console.log(`✅ ${events.length}개 이벤트 생성 완료`);

        // Event 상세 출력
        events.forEach((event, index) => {
            console.log(`\n이벤트 ${index + 1}:`);
            console.log(`  ID: ${event.id}`);
            console.log(`  날짜: ${event.date}`);
            console.log(`  병원: ${event.hospital}`);
            console.log(`  진단: ${event.diagnosis.name} (${event.diagnosis.code || '코드 없음'})`);
            console.log(`  유형: ${event.eventType}`);
            console.log(`  플래그: 3M=${event.flags.preEnroll3M}, 5Y=${event.flags.preEnroll5Y}`);
            console.log(`  SourceSpan: ${event.sourceSpan.textPreview ? '✅ 첨부됨' : '❌ 없음'}`);
            if (event.sourceSpan.textPreview) {
                console.log(`    Preview: ${event.sourceSpan.textPreview.substring(0, 50)}...`);
            }
        });

        // Step 2: SourceSpan 첨부율 확인
        console.log('\n\n📊 Step 2: SourceSpan 첨부율 확인');
        console.log('-'.repeat(60));

        const withSpan = events.filter(e => e.sourceSpan && e.sourceSpan.textPreview).length;
        const spanRate = (withSpan / events.length * 100).toFixed(1);

        console.log(`첨부율: ${spanRate}% (${withSpan}/${events.length})`);
        console.log(spanRate >= 95 ? '✅ 목표 달성 (95%+)' : '⚠️  목표 미달');

        // Step 3: Question Map 생성
        console.log('\n\n🔍 Step 3: Question Map 생성');
        console.log('-'.repeat(60));

        const questionMap = disclosureRulesEngine.processEvents(events, samplePatientInfo);

        console.log(`\n매칭된 질문: ${Object.keys(questionMap).length}개`);

        Object.values(questionMap).forEach(qData => {
            console.log(`\n질문: ${qData.question.title}`);
            console.log(`  우선순위: ${qData.question.priority}`);
            console.log(`  매칭 이벤트: ${qData.matchedEvents.length}개`);
            console.log(`  총 스코어: ${qData.totalScore.toFixed(2)}`);
            console.log(`  요약: ${qData.summary}`);

            qData.matchedEvents.slice(0, 2).forEach((event, idx) => {
                console.log(`    ${idx + 1}. ${event.date} ${event.hospital} - ${event.diagnosis.name} (스코어: ${event.score.toFixed(2)})`);
            });
        });

        // Step 4: 결과 요약
        console.log('\n\n📈 Step 4: 테스트 결과 요약');
        console.log('='.repeat(60));

        const summary = {
            totalEvents: events.length,
            sourceSpanRate: spanRate,
            matchedQuestions: Object.keys(questionMap).length,
            highPriorityQuestions: Object.values(questionMap).filter(q => q.question.priority === 1).length,
            avgScore: Object.values(questionMap).reduce((sum, q) => sum + q.totalScore, 0) / Object.keys(questionMap).length
        };

        console.log(`총 이벤트: ${summary.totalEvents}개`);
        console.log(`SourceSpan 첨부율: ${summary.sourceSpanRate}%`);
        console.log(`매칭된 질문: ${summary.matchedQuestions}개`);
        console.log(`  - 최우선 (Priority 1): ${summary.highPriorityQuestions}개`);
        console.log(`평균 스코어: ${summary.avgScore.toFixed(2)}`);

        // 성공 판정
        console.log('\n\n✨ 테스트 결과');
        console.log('='.repeat(60));

        const passed =
            events.length > 0 &&
            spanRate >= 95 &&
            Object.keys(questionMap).length > 0;

        if (passed) {
            console.log('✅ 통합 테스트 성공!');
        } else {
            console.log('⚠️  일부 항목 미달성');
            if (events.length === 0) console.log('  - 이벤트 생성 실패');
            if (spanRate < 95) console.log(`  - SourceSpan 첨부율 미달 (${spanRate}% < 95%)`);
            if (Object.keys(questionMap).length === 0) console.log('  - Question 매칭 실패');
        }

        console.log('\n' + '='.repeat(60));

        return {
            success: passed,
            summary,
            events,
            questionMap
        };

    } catch (error) {
        console.error('\n❌ 테스트 실패:', error.message);
        console.error(error.stack);
        return {
            success: false,
            error: error.message
        };

        import medicalEventModel from '../postprocess/medicalEventModel.js';
        import disclosureRulesEngine from '../postprocess/disclosureRulesEngine.js';
        import { fileURLToPath } from 'url';
        import path from 'path';

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);


        // 테스트 데이터
        const sampleRawText = `
2024년 4월 9일 삼성서울병원 외과
환자: 홍길동 (남, 55세)

진단명: 위암 (C16.9)
주소: 상복부 통증, 체중 감소

검사 소견:
- 위내시경: 위체부에 약 3cm 크기의 궤양성 병변 관찰
- 조직검사: Adenocarcinoma (선암)
- CT: 국소 림프절 전이 의심

치료 계획:
- 위절제술 (Gastrectomy) 시행 예정
- 수술 날짜: 2024년 4월 15일

과거력:
- 2020년 고혈압 (I10) 진단, 현재 약물 복용 중
- 2022년 당뇨병 (E11.9) 진단, 인슐린 치료 중
`;

        const sampleDateBlocks = [
            {
                date: '2024-04-09',
                hospital: '삼성서울병원',
                department: '외과',
                diagnosis: '위암',
                diagnosisCode: 'C16.9',
                rawText: sampleRawText,
                procedures: [
                    { name: '위내시경' },
                    { name: '조직검사' },
                    { name: 'CT' }
                ],
                treatments: [
                    { name: '위절제술' }
                ]
            },
            {
                date: '2020-01-01',
                hospital: '서울대병원',
                diagnosis: '고혈압',
                diagnosisCode: 'I10',
                rawText: '2020년 고혈압 진단',
                procedures: [],
                treatments: [
                    { name: '약물 복용' }
                ]
            },
            {
                date: '2022-01-01',
                hospital: '서울대병원',
                diagnosis: '당뇨병',
                diagnosisCode: 'E11.9',
                rawText: '2022년 당뇨병 진단',
                procedures: [],
                treatments: [
                    { name: '인슐린 치료' }
                ]
            }
        ];

        const samplePatientInfo = {
            name: '홍길동',
            birthDate: '1969-01-01',
            enrollmentDate: '2024-03-01' // 가입일
        };

        // 테스트 실행
        async function runIntegrationTest() {
            console.log('🧪 VNEXSUS 통합 테스트 시작\n');
            console.log('='.repeat(60));

            try {
                // Step 1: MedicalEvent 생성
                console.log('\n📋 Step 1: MedicalEvent 생성');
                console.log('-'.repeat(60));

                const events = medicalEventModel.buildEvents({
                    dateBlocks: sampleDateBlocks,
                    entities: {},
                    rawText: sampleRawText,
                    patientInfo: samplePatientInfo
                });

                console.log(`✅ ${events.length}개 이벤트 생성 완료`);

                // Event 상세 출력
                events.forEach((event, index) => {
                    console.log(`\n이벤트 ${index + 1}:`);
                    console.log(`  ID: ${event.id}`);
                    console.log(`  날짜: ${event.date}`);
                    console.log(`  병원: ${event.hospital}`);
                    console.log(`  진단: ${event.diagnosis.name} (${event.diagnosis.code || '코드 없음'})`);
                    console.log(`  유형: ${event.eventType}`);
                    console.log(`  플래그: 3M=${event.flags.preEnroll3M}, 5Y=${event.flags.preEnroll5Y}`);
                    console.log(`  SourceSpan: ${event.sourceSpan.textPreview ? '✅ 첨부됨' : '❌ 없음'}`);
                    if (event.sourceSpan.textPreview) {
                        console.log(`    Preview: ${event.sourceSpan.textPreview.substring(0, 50)}...`);
                    }
                });

                // Step 2: SourceSpan 첨부율 확인
                console.log('\n\n📊 Step 2: SourceSpan 첨부율 확인');
                console.log('-'.repeat(60));

                const withSpan = events.filter(e => e.sourceSpan && e.sourceSpan.textPreview).length;
                const spanRate = (withSpan / events.length * 100).toFixed(1);

                console.log(`첨부율: ${spanRate}% (${withSpan}/${events.length})`);
                console.log(spanRate >= 95 ? '✅ 목표 달성 (95%+)' : '⚠️  목표 미달');

                // Step 3: Question Map 생성
                console.log('\n\n🔍 Step 3: Question Map 생성');
                console.log('-'.repeat(60));

                const questionMap = disclosureRulesEngine.processEvents(events, samplePatientInfo);

                console.log(`\n매칭된 질문: ${Object.keys(questionMap).length}개`);

                Object.values(questionMap).forEach(qData => {
                    console.log(`\n질문: ${qData.question.title}`);
                    console.log(`  우선순위: ${qData.question.priority}`);
                    console.log(`  매칭 이벤트: ${qData.matchedEvents.length}개`);
                    console.log(`  총 스코어: ${qData.totalScore.toFixed(2)}`);
                    console.log(`  요약: ${qData.summary}`);

                    qData.matchedEvents.slice(0, 2).forEach((event, idx) => {
                        console.log(`    ${idx + 1}. ${event.date} ${event.hospital} - ${event.diagnosis.name} (스코어: ${event.score.toFixed(2)})`);
                    });
                });

                // Step 4: 결과 요약
                console.log('\n\n📈 Step 4: 테스트 결과 요약');
                console.log('='.repeat(60));

                const summary = {
                    totalEvents: events.length,
                    sourceSpanRate: spanRate,
                    matchedQuestions: Object.keys(questionMap).length,
                    highPriorityQuestions: Object.values(questionMap).filter(q => q.question.priority === 1).length,
                    avgScore: Object.values(questionMap).reduce((sum, q) => sum + q.totalScore, 0) / Object.keys(questionMap).length
                };

                console.log(`총 이벤트: ${summary.totalEvents}개`);
                console.log(`SourceSpan 첨부율: ${summary.sourceSpanRate}%`);
                console.log(`매칭된 질문: ${summary.matchedQuestions}개`);
                console.log(`  - 최우선 (Priority 1): ${summary.highPriorityQuestions}개`);
                console.log(`평균 스코어: ${summary.avgScore.toFixed(2)}`);

                // 성공 판정
                console.log('\n\n✨ 테스트 결과');
                console.log('='.repeat(60));

                const passed =
                    events.length > 0 &&
                    spanRate >= 95 &&
                    Object.keys(questionMap).length > 0;

                if (passed) {
                    console.log('✅ 통합 테스트 성공!');
                } else {
                    console.log('⚠️  일부 항목 미달성');
                    if (events.length === 0) console.log('  - 이벤트 생성 실패');
                    if (spanRate < 95) console.log(`  - SourceSpan 첨부율 미달 (${spanRate}% < 95%)`);
                    if (Object.keys(questionMap).length === 0) console.log('  - Question 매칭 실패');
                }

                console.log('\n' + '='.repeat(60));

                return {
                    success: passed,
                    summary,
                    events,
                    questionMap
                };

            } catch (error) {
                console.error('\n❌ 테스트 실패:', error.message);
                console.error(error.stack);
                return {
                    success: false,
                    error: error.message
                };
            }
        }

        // 실행
        if (import.meta.url === `file://${process.argv[1]}`) {
            console.log('Starting integration test...\n');
            runIntegrationTest()
                .then(result => {
                    console.log('\n\nTest completed.');
                    process.exit(result.success ? 0 : 1);
                })
                .catch(error => {
                    console.error('\n\n❌ 테스트 실행 오류:', error);
                    console.error(error.stack);
                    process.exit(1);
                });
        }

        export default runIntegrationTest;
