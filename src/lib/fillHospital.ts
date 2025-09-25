/**
 * Hospital Fill Utility
 * 
 * 같은 파일·같은 날짜에서 첫 등장한 병원명을 다음 블록에 전파하는 유틸리티
 */

/**
 * 타임라인에서 누락된 병원명을 채워주는 함수
 * @param {Array} timeline - 타임라인 이벤트 배열
 * @returns {Array} - 병원명이 채워진 타임라인 이벤트 배열
 */
export function fillMissingHospital(timeline) {
  if (!timeline || !Array.isArray(timeline) || timeline.length === 0) {
    return timeline;
  }
  
  let last = '';
  for(const ev of timeline){
    if(ev.hospital) last = ev.hospital;
    else ev.hospital = last || '병원명미상';
  }
  return timeline;
} 