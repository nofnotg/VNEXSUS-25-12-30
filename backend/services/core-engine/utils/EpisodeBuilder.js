/**
 * EpisodeBuilder.js
 * 
 * Timeline events를 의미 있는 'Episode' 단위로 그룹화하고
 * Investigator View에서 사용할 요약 정보를 생성하는 유틸리티입니다.
 * 
 * Master Plan Phase 2 (Investigator View)의 핵심 컴포넌트입니다.
 */

export class EpisodeBuilder {
    constructor() {
        // 에피소드 그룹화 기준 설정 (일 단위)
        this.EPISODE_WINDOW_DAYS = 30;
    }

    /**
     * 타임라인 이벤트를 에피소드로 그룹화합니다.
     * 현재는 간단한 날짜/병원 기준 클러스터링을 수행합니다.
     * 
     * @param {Array} events - Timeline events 배열
     * @returns {Array} Episodes 배열
     */
    groupEventsToEpisodes(events) {
        if (!events || events.length === 0) {
            return [];
        }

        // 날짜순 정렬
        const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

        const episodes = [];
        let currentEpisode = null;

        for (const event of sortedEvents) {
            if (!currentEpisode) {
                currentEpisode = this._createNewEpisode(event);
                continue;
            }

            // 현재 에피소드에 포함될 수 있는지 확인
            if (this._shouldAddToEpisode(currentEpisode, event)) {
                this._addEventToEpisode(currentEpisode, event);
            } else {
                // 기존 에피소드 완료 및 새 에피소드 시작
                this._finalizeEpisode(currentEpisode);
                episodes.push(currentEpisode);
                currentEpisode = this._createNewEpisode(event);
            }
        }

        // 마지막 에피소드 처리
        if (currentEpisode) {
            this._finalizeEpisode(currentEpisode);
            episodes.push(currentEpisode);
        }

        return episodes;
    }

    /**
     * 에피소드 요약 텍스트를 생성합니다.
     * 형식: [YYYY-MM-DD ~ YYYY-MM-DD] 주진단명 (Phase, Duty)
     * 
     * @param {Object} episode 
     * @returns {String} 요약 텍스트
     */
    buildEpisodeSummaryText(episode) {
        const range = episode.dateRange || '';
        const mainDx = episode.mainDiagnosis || '진단명 없음';

        // DisputeTag 정보가 있는 경우 포함
        let tagInfo = '';
        if (episode.disputeTag) {
            const phase = episode.disputeTag.phase || '';
            const duty = episode.disputeTag.dutyToDisclose || '';
            if (phase || duty) {
                tagInfo = ` (${phase}, ${duty})`;
            }
        }

        return `[${range}] ${mainDx}${tagInfo}`;
    }

    // --- Internal Methods ---

    _createNewEpisode(firstEvent) {
        return {
            episodeId: `EP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startDate: firstEvent.date,
            endDate: firstEvent.date,
            events: [firstEvent],
            mainHospital: this._extractHospital(firstEvent),
            mainDiagnosis: this._extractDiagnosis(firstEvent),
            disputeTag: firstEvent.disputeTag || null // 첫 이벤트의 태그를 임시 대표 태그로 사용
        };
    }

    _shouldAddToEpisode(episode, event) {
        // 1. 날짜 차이 계산
        const lastDate = new Date(episode.endDate);
        const eventDate = new Date(event.date);
        const diffTime = Math.abs(eventDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // 30일 이내이면 같은 에피소드로 간주 (단순화된 로직)
        // 향후 병원명 일치, 진단명 유사도 등을 추가할 수 있음
        return diffDays <= this.EPISODE_WINDOW_DAYS;
    }

    _addEventToEpisode(episode, event) {
        episode.events.push(event);
        episode.endDate = event.date; // 종료일 업데이트

        // 주요 정보 업데이트 (필요 시)
        if (!episode.mainHospital) {
            episode.mainHospital = this._extractHospital(event);
        }
        if (!episode.mainDiagnosis) {
            episode.mainDiagnosis = this._extractDiagnosis(event);
        }

        // DisputeTag 업데이트: 더 높은 중요도를 가진 태그가 있으면 교체
        if (event.disputeTag) {
            if (!episode.disputeTag || (event.disputeTag.importanceScore > episode.disputeTag.importanceScore)) {
                episode.disputeTag = event.disputeTag;
            }
        }
    }

    _finalizeEpisode(episode) {
        // 날짜 범위 문자열 생성
        if (episode.startDate === episode.endDate) {
            episode.dateRange = episode.startDate;
        } else {
            episode.dateRange = `${episode.startDate} ~ ${episode.endDate}`;
        }

        // 이벤트 개수
        episode.eventCount = episode.events.length;
    }

    _extractHospital(event) {
        // entities에서 HOSPITAL 타입 찾기
        if (event.entities) {
            const hospital = event.entities.find(e => e.type === 'HOSPITAL');
            if (hospital) return hospital.text;
        }
        return null;
    }

    _extractDiagnosis(event) {
        // entities에서 DIAGNOSIS 타입 찾기
        if (event.entities) {
            const diagnosis = event.entities.find(e => e.type === 'DIAGNOSIS');
            if (diagnosis) return diagnosis.text;
        }
        // 없으면 설명에서 일부 추출하거나 '진료' 등으로 대체 가능
        return event.description || '진료';
    }
}
