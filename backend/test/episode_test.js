/**
 * Episode Clustering Test
 */

import episodeClusterer from '../postprocess/episodeClusterer.js';

console.log('🧪 Episode Clustering Test\n');

// 샘플 데이터: 2개의 에피소드 (위암 수술, 1년 후 고혈압)
const events = [
    // Episode 1: 위암 (삼성서울병원) - 4월 9일 ~ 5월 15일
    {
        id: 'E1', date: '2024-04-09', hospital: '삼성서울병원', eventType: '진료',
        diagnosis: { name: '위암', code: 'C16.9' }, shortFact: '위암 진단'
    },
    {
        id: 'E2', date: '2024-04-15', hospital: '삼성서울병원', eventType: '수술',
        diagnosis: { name: '위암', code: 'C16.9' }, shortFact: '위절제술'
    },
    {
        id: 'E3', date: '2024-04-15', hospital: '삼성서울병원', eventType: '입원',
        diagnosis: { name: '위암', code: 'C16.9' }, shortFact: '입원 치료'
    },
    {
        id: 'E4', date: '2024-05-15', hospital: '삼성서울병원', eventType: '진료',
        diagnosis: { name: '위암', code: 'C16.9' }, shortFact: '외래 추적'
    },

    // Episode 2: 고혈압 (서울아산병원) - 2025년 (시간 간격 큼)
    {
        id: 'E5', date: '2025-01-10', hospital: '서울아산병원', eventType: '진료',
        diagnosis: { name: '고혈압', code: 'I10' }, shortFact: '고혈압 진단'
    }
];

// 실행
const episodes = episodeClusterer.clusterEvents(events);

console.log(`✅ ${episodes.length}개 에피소드 생성 (예상: 2개)`);

episodes.forEach((ep, i) => {
    console.log(`\n[Episode ${i + 1}]`);
    console.log(`  ID: ${ep.id}`);
    console.log(`  병원: ${ep.hospital}`);
    console.log(`  카테고리: ${ep.category}`);
    console.log(`  기간: ${ep.startDate} ~ ${ep.endDate}`);
    console.log(`  방문수: ${ep.visitCount}`);
    console.log(`  주요이벤트: ${ep.keyEvents.join(', ')}`);
    console.log(`  요약: ${ep.summary}`);
});

// 검증
const passed = episodes.length === 2 &&
    episodes[0].category === '암/종양' &&
    episodes[1].category === '고혈압';

if (passed) {
    console.log('\n✅ 테스트 성공!');
} else {
    console.error('\n❌ 테스트 실패');
    process.exit(1);
}
