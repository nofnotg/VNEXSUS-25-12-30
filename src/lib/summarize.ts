import { fillMissingHospital } from './fillHospital.js';

export function summarizeTimeline(tl) {
  // 타임라인 데이터 검증
  if (!tl || !Array.isArray(tl) || tl.length === 0) {
    console.log('Empty or invalid timeline data provided to summarizeTimeline');
    return [];
  }

  // 병원명 누락 처리 적용
  const timeline = fillMissingHospital(tl);

  // date + hospital 단위 그룹
  const map = new Map();
  for (const ev of timeline) {
    if (!ev || typeof ev !== 'object') {
      console.log('Invalid event in timeline:', ev);
      continue;
    }
    
    const key = `${ev.date || 'Unknown Date'}|${ev.hospital || '병원명미상'}`;
    if (!map.has(key)) map.set(key, {
      date: ev.date || 'Unknown Date', 
      hospital: ev.hospital || '병원명미상', 
      diagnosis: [], 
      treatment: []
    });
    
    const row = map.get(key);
    if (ev.type === 'diagnosis' && Array.isArray(ev.diagnosis)) row.diagnosis.push(...ev.diagnosis);
    if (ev.type === 'treatment' && Array.isArray(ev.treatment)) row.treatment.push(...ev.treatment);
  }
  
  // 중복 제거 & 정렬
  return [...map.values()]
    .map(r => ({
      ...r,
      diagnosis: [...new Set(r.diagnosis.filter(Boolean))], 
      treatment: [...new Set(r.treatment.filter(Boolean))]
    }))
    .sort((a, b) => {
      try {
        const dateA = a.date === 'Unknown Date' ? 0 : new Date(a.date).getTime();
        const dateB = b.date === 'Unknown Date' ? 0 : new Date(b.date).getTime();
        return dateA - dateB;
      } catch (e) {
        console.log('Error sorting dates:', e);
        return 0;
      }
    });
} 