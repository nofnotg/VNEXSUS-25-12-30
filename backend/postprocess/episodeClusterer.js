/**
 * Episode Clusterer (Phase 3 - T07)
 * 
 * 목적:
 * - MedicalEvent들을 "에피소드" 단위로 그룹화
 * - 병원 + 질환군 + 시간(30일 간격) 기준
 * - 리포트 요약 섹션 제공
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EpisodeClusterer {
    constructor() {
        this.majorEvents = this.loadMajorEvents();
    }

    loadMajorEvents() {
        try {
            const filePath = path.join(__dirname, 'majorEvents.json');
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.warn('⚠️ majorEvents.json 로드 실패, 기본값 사용:', error.message);
            return { icdCodeMappings: {} };
        }
    }

    /**
     * 이벤트를 에피소드로 클러스터링
     * @param {Array} events - MedicalEvent 배열
     * @returns {Array} Episode 배열
     */
    clusterEvents(events) {
        if (!events || events.length === 0) return [];

        // 1. 날짜순 정렬
        const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. 1차 그룹화 (병원 + 질환군)
        const groups = this.groupByHospitalAndDiagnosis(sortedEvents);

        // 3. 2차 분리 (Time Gap)
        const episodes = this.splitByTimeGap(groups);

        // 4. 에피소드 요약 정보 생성
        return episodes.map(ep => this.enrichEpisode(ep));
    }

    /**
     * 병원 및 질환군 기준으로 그룹화
     */
    groupByHospitalAndDiagnosis(events) {
        const groups = {};

        events.forEach(event => {
            const hospital = event.hospital || 'Unknown';
            const category = this.getDiagnosisCategory(event);
            const key = `${hospital}|${category}`;

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(event);
        });

        return groups;
    }

    /**
     * 질환군 판별
     */
    getDiagnosisCategory(event) {
        if (!event.diagnosis || !event.diagnosis.code) return '기타';

        const code = event.diagnosis.code;
        const mappings = this.majorEvents.icdCodeMappings || {};

        for (const [key, data] of Object.entries(mappings)) {
            if (data.codes.some(c => code.startsWith(c))) {
                return data.category;
            }
        }

        return '기타';
    }

    /**
     * 시간 간격(30일) 기준으로 에피소드 분리
     */
    splitByTimeGap(groups) {
        const episodes = [];
        const GAP_LIMIT = 30 * 24 * 60 * 60 * 1000; // 30일

        for (const [key, groupEvents] of Object.entries(groups)) {
            const [hospital, category] = key.split('|');

            let currentEpisode = {
                id: `EP_${uuidv4()}`,
                hospital,
                category,
                events: [groupEvents[0]]
            };

            for (let i = 1; i < groupEvents.length; i++) {
                const prevEvent = groupEvents[i - 1];
                const currEvent = groupEvents[i];

                const prevDate = new Date(prevEvent.date);
                const currDate = new Date(currEvent.date);
                const diff = currDate - prevDate;

                // 입원 중이거나 30일 이내면 같은 에피소드
                const isAdmission = prevEvent.eventType === '입원' || currEvent.eventType === '입원';

                if (diff <= GAP_LIMIT || isAdmission) {
                    currentEpisode.events.push(currEvent);
                } else {
                    // 새로운 에피소드 시작
                    episodes.push(currentEpisode);
                    currentEpisode = {
                        id: `EP_${uuidv4()}`,
                        hospital,
                        category,
                        events: [currEvent]
                    };
                }
            }
            episodes.push(currentEpisode);
        }

        // 시작일 기준 정렬
        return episodes.sort((a, b) =>
            new Date(a.events[0].date) - new Date(b.events[0].date)
        );
    }

    /**
     * 에피소드 상세 정보 생성
     */
    enrichEpisode(episode) {
        const events = episode.events;
        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];

        // 대표 진단명 (가장 빈도 높은 것 또는 첫 번째)
        const diagnosisCounts = {};
        events.forEach(e => {
            const name = e.diagnosis?.name || '미상';
            diagnosisCounts[name] = (diagnosisCounts[name] || 0) + 1;
        });
        const representativeDiagnosis = Object.keys(diagnosisCounts).reduce((a, b) =>
            diagnosisCounts[a] > diagnosisCounts[b] ? a : b
        );

        // 주요 이벤트 추출 (수술, 입원, 중대검사)
        const keyEvents = new Set();
        events.forEach(e => {
            if (e.eventType === '수술' || e.eventType === '입원') {
                keyEvents.add(e.shortFact);
            }
            // 중대검사 키워드 체크 (간단히 구현)
            if (e.shortFact.includes('CT') || e.shortFact.includes('MRI') || e.shortFact.includes('조직검사')) {
                keyEvents.add(e.shortFact);
            }
        });

        return {
            ...episode,
            startDate: firstEvent.date,
            endDate: lastEvent.date,
            representativeDiagnosis,
            visitCount: events.length,
            keyEvents: Array.from(keyEvents),
            summary: this.generateSummaryText(episode, firstEvent.date, lastEvent.date, events.length, representativeDiagnosis)
        };
    }

    generateSummaryText(episode, start, end, count, diagnosis) {
        const period = start === end ? start : `${start} ~ ${end}`;
        return `${episode.hospital} (${episode.category}) - ${diagnosis}\n기간: ${period} (${count}회 방문)`;
    }
}

const episodeClusterer = new EpisodeClusterer();
export default episodeClusterer;
