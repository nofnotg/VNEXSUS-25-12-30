/**
 * 의료 타임라인 생성기 - 브라우저 버전
 */
class MedicalTimelineGenerator {
  constructor() {
    this.DATE_REGEX = [
      /\d{4}-\d{2}-\d{2}/g,
      /\d{4}\.\d{2}\.\d{2}/g,
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,
    ];
    
    // 병원명과 보험사 패턴
    this.HOSPITAL_REGEX = /([가-힣A-Za-z0-9]+(?:대학교)?(?:병원|의원|클리닉|센터))/;
    this.INSURANCE_REGEX = /([가-힣A-Za-z0-9]+(?:\s+)?(?:손해보험|생명|화재|보험|캐피탈))/;
    
    // 알려진 기관명 목록
    this.KNOWN_INSTITUTIONS = [
      '건국대학교병원', '서울대학교병원', '세브란스병원', '서울아산병원', 
      '삼성서울병원', '분당서울대병원', '고려대학교병원', '가톨릭대학교병원',
      'MG 손해보험', 'MG손해보험', '삼성화재', '교보생명', '한화생명',
      '롯데손해보험', '메리츠화재', 'DB손해보험', '현대해상', '흥국생명'
    ];
  }

  parseDate(raw) {
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw.replace(/\./g, '-');
    const match = raw.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    return null;
  }

  findInstitution(text) {
    // 알려진 기관명 먼저 확인
    for (const inst of this.KNOWN_INSTITUTIONS) {
      if (text.includes(inst)) {
        return inst;
      }
    }
    
    // 정규식으로 검색
    const hospitalMatch = text.match(this.HOSPITAL_REGEX);
    if (hospitalMatch) return hospitalMatch[0];
    
    const insuranceMatch = text.match(this.INSURANCE_REGEX);
    if (insuranceMatch) return insuranceMatch[0];
    
    // MG 손해보험 특별 처리
    if (text.includes('MG') && text.includes('손해보험')) {
      return 'MG 손해보험';
    }
    
    return null;
  }

  extractBlocks(text) {
    // 빈 줄로 블록 나누기 시도
    const paragraphs = text.split(/\n\s*\n+/);
    const blocks = [];
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      const lines = paragraph.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      
      // 블록 내 날짜 찾기
      let dateFound = false;
      let date = null;
      
      for (const line of lines) {
        for (const regex of this.DATE_REGEX) {
          const matches = line.match(regex);
          if (matches && matches.length > 0) {
            date = this.parseDate(matches[0]);
            dateFound = true;
            break;
          }
        }
        if (dateFound) break;
      }
      
      if (!date) continue; // 날짜가 없으면 건너뛰기
      
      // 기관명 찾기
      let institution = null;
      const fullText = lines.join(' ');
      
      institution = this.findInstitution(fullText);
      
      blocks.push({
        date,
        hospital: institution,
        lines,
        text: fullText
      });
    }
    
    return blocks;
  }

  extractEvents(text) {
    const blocks = this.extractBlocks(text);
    const events = [];

    for (const block of blocks) {
      if (!block.date) continue;
      
      // 이벤트 설명 찾기 - 가장 유의미한 라인 고르기
      const eventPatterns = [
        /진단명\s*:\s*(.*)/i,
        /진단\s*:\s*(.*)/i,
        /치료내용\s*:\s*(.*)/i,
        /치료\s*:\s*(.*)/i,
        /수술\s*:\s*(.*)/i,
        /수술\s*시행\s*:\s*(.*)/i,
        /가입/,
        /입원/,
        /내원/,
        /청구/
      ];
      
      let description = null;
      
      // 패턴과 일치하는 라인 찾기
      for (const pattern of eventPatterns) {
        for (const line of block.lines) {
          if (pattern.test(line) && !line.startsWith('내원일')) {
            // 패턴이 캡처 그룹이 있으면 그 값 사용
            const match = line.match(pattern);
            if (match && match[1]) {
              description = match[1].trim();
            } else {
              description = line;
            }
            break;
          }
        }
        if (description) break;
      }
      
      // 패턴에 맞는 라인이 없으면 두 번째 라인 사용
      if (!description && block.lines.length > 1) {
        description = block.lines[1];
      } else if (!description) {
        description = '내용 없음';
      }
      
      events.push({
        date: block.date,
        description: description.replace(/\s+/g, ' ').slice(0, 200),
        institution: block.hospital || '기관명 미확인',
      });
    }

    return this.sortAndDedup(events);
  }

  sortAndDedup(events) {
    // 중복 제거 - 같은 날짜에 같은 기관에서 발생한 이벤트는 가장 자세한 설명으로 통합
    const eventsByDateAndInst = {};
    
    for (const event of events) {
      const key = `${event.date}|${event.institution}`;
      
      if (!eventsByDateAndInst[key] || 
          eventsByDateAndInst[key].description.length < event.description.length) {
        eventsByDateAndInst[key] = event;
      }
    }
    
    // 객체를 배열로 변환하고 날짜순 정렬
    return Object.values(eventsByDateAndInst).sort((a, b) => a.date.localeCompare(b.date));
  }

  formatAsText(events) {
    return events.map(e => `${e.date} | ${e.description} | ${e.institution}`).join('\n');
  }
}

// 샘플 데이터
const SAMPLE_DATA = `2023.12.20
(무)원더풀 355 간편보험 가입
MG 손해보험


2024.07.22
내원일: 2024.07.22
진단명: B-세포형 만성 림프구성 백혈병(C91.1)
치료내용: 항암치료 시행
건국대학교병원


2022년 5월 10일
내원일자: 2022.05.10
복통으로 내원
담낭염 진단
서울아산병원


2023-08-15
수술 시행: 담낭절제술
입원기간: 2023-08-15 ~ 2023-08-20
삼성서울병원`;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    const medicalText = document.getElementById('medicalText');
    const processBtn = document.getElementById('processBtn');
    const resultDiv = document.getElementById('result');
    const loadSampleBtn = document.getElementById('loadSample');
    const clearBtn = document.getElementById('clearBtn');
    
    // 타임라인 생성기 인스턴스
    const generator = new MedicalTimelineGenerator();
    
    // 처리 버튼 클릭 이벤트
    processBtn.addEventListener('click', () => {
        const text = medicalText.value.trim();
        
        if (!text) {
            resultDiv.innerHTML = '<div class="timeline-item" style="border-left-color: #e74c3c;">텍스트를 입력해주세요.</div>';
            return;
        }
        
        try {
            const events = generator.extractEvents(text);
            
            if (events.length === 0) {
                resultDiv.innerHTML = '<div class="timeline-item" style="border-left-color: #e74c3c;">이벤트를 추출할 수 없습니다. 텍스트 형식을 확인하세요.</div>';
                return;
            }
            
            // 결과 표시
            displayTimeline(events);
        } catch (error) {
            console.error('이벤트 추출 오류:', error);
            resultDiv.innerHTML = `<div class="timeline-item" style="border-left-color: #e74c3c;">오류 발생: ${error.message}</div>`;
        }
    });
    
    // 샘플 데이터 불러오기
    loadSampleBtn.addEventListener('click', () => {
        medicalText.value = SAMPLE_DATA;
    });
    
    // 초기화 버튼
    clearBtn.addEventListener('click', () => {
        medicalText.value = '';
        resultDiv.innerHTML = '';
    });
    
    // 타임라인 표시 함수
    function displayTimeline(events) {
        let html = '';
        
        for (const event of events) {
            html += `
                <div class="timeline-item">
                    <div class="timeline-date">${event.date}</div>
                    <div class="timeline-desc">${event.description}</div>
                    <div class="timeline-inst">${event.institution}</div>
                </div>
            `;
        }
        
        resultDiv.innerHTML = html;
    }
}); 