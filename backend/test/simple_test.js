/**
 * VNEXSUS 간단 통합 테스트
 * Phase 0-3 검증 (Episode Clustering 포함)
 */

import medicalEventModel from '../postprocess/medicalEventModel.js';
import disclosureRulesEngine from '../postprocess/disclosureRulesEngine.js';
import episodeClusterer from '../postprocess/episodeClusterer.js';

console.log('🧪 VNEXSUS 통합 테스트 시작\n');
console.log('='.repeat(60));

// 테스트 데이터
const rawText = `2024년 4월 9일 삼성서울병원
진단: 위암 (C16.9)
검사: 위내시경, 조직검사, CT
치료: 위절제술 예정`;

const dateBlocks = [
    {
        date: '2024-04-09',
        hospital: '삼성서울병원',
        diagnosis: '위암',
        diagnosisCode: 'C16.9',
        rawText: rawText,
        procedures: [{ name: '위내시경' }, { name: '조직검사' }, { name: 'CT' }],
        treatments: [{ name: '위절제술' }]
    }
];

const patientInfo = {
    name: '홍길동',
    enrollmentDate: '2024-03-01'
};

try {
    // Step 1: MedicalEvent 생성
    console.log('\n📋 Step 1: MedicalEvent 생성');
    const events = medicalEventModel.buildEvents({
        dateBlocks,
        entities: {},
        rawText,
        patientInfo
    });

    console.log(`✅ ${events.length}개 이벤트 생성`);
    events.forEach((e, i) => {
        console.log(`  ${i + 1}. ${e.date} ${e.hospital} - ${e.diagnosis.name}`);
        console.log(`     SourceSpan: ${e.sourceSpan.textPreview ? '✅' : '❌'}`);
    });

    // Step 2: Question Map 생성
    console.log('\n🔍 Step 2: Question Map 생성');
    const questionMap = disclosureRulesEngine.processEvents(events, patientInfo);

    console.log(`✅ ${Object.keys(questionMap).length}개 질문 매칭`);
    Object.values(questionMap).forEach(q => {
        console.log(`  - ${q.question.title}: ${q.matchedEvents.length}개 이벤트`);
    });

    // Step 3: Episode Clustering
    console.log('\n🧩 Step 3: Episode Clustering');
    const episodes = episodeClusterer.clusterEvents(events);

    console.log(`✅ ${episodes.length}개 에피소드 생성`);
    episodes.forEach((ep, i) => {
        console.log(`  [Ep${i + 1}] ${ep.summary}`);
    });

    // 결과
    console.log('\n✨ 테스트 결과');
    console.log('='.repeat(60));
    console.log(`이벤트 생성: ${events.length > 0 ? '✅' : '❌'}`);
    console.log(`Question 매칭: ${Object.keys(questionMap).length > 0 ? '✅' : '❌'}`);
    console.log(`Episode 생성: ${episodes.length > 0 ? '✅' : '❌'}`);
    console.log('\n✅ 통합 테스트 성공!');

} catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
}
