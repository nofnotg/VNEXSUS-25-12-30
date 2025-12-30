(function () {
  'use strict';

  /**
   * AI 보고서 생성 기능
   * 
   * OpenAI GPT-4 Turbo를 통한 의료 보고서 생성 기능을 구현합니다.
   */

  // DOM 요소
  const aiReportSection = document.getElementById('ai-report-section');
  const generateAIReportBtn = document.getElementById('generateAIReportBtn');
  const aiReportLoading = document.getElementById('ai-report-loading');
  const aiReportContent = document.getElementById('ai-report-content');
  const extractedTextDisplay = document.getElementById('extracted-text-display');
  const autoGenerateToggle = document.getElementById('auto-generate-toggle');
  const devModeToggle = document.getElementById('dev-mode-toggle');
  const copyReportBtn = document.getElementById('copyReportBtn');

  // 전역 변수
  let currentSessionId = null;
  let extractedText = null;
  let ocrCompleted = false;
  let autoGenerateReport = true; // 자동 생성 플래그
  let isDevMode = false; // 개발 모드 플래그
  let plainTextReport = ''; // 복사용 순수 텍스트 저장
  let currentEnrollmentDate = null; // 현재 기준 가입일

  // 페이지 로드 시 초기화
  document.addEventListener('DOMContentLoaded', initAIReport);

  /**
   * AI 보고서 기능 초기화
   */
  function initAIReport() {
    console.log('AI 보고서 모듈 초기화');

    // 버튼 이벤트 핸들러
    if (generateAIReportBtn) {
      generateAIReportBtn.addEventListener('click', generateAIReport);
    }
    if (copyReportBtn) {
      copyReportBtn.addEventListener('click', copyReportContent);
      copyReportBtn.disabled = true;
    }

    // 메시지가 있을 때 UI 표시
    setTimeout(() => {
      // 메인 앱에서 발생하는 이벤트 리스너 추가
      document.addEventListener('ocrComplete', handleOCRComplete);
      document.addEventListener('timelineGenerated', handleTimelineGenerated);
      // connectReasoningStream(); // Removed unused stream connection
    }, 1000);

    // 자동 생성 토글 버튼 이벤트 리스너
    if (autoGenerateToggle) {
      // Bootstrap 스위치로 변경
      autoGenerateToggle.addEventListener('change', () => {
        autoGenerateReport = autoGenerateToggle.checked;
        console.log(`자동 생성 모드: ${autoGenerateReport ? '켜짐' : '꺼짐'}`);
      });
    }

    // 개발 모드 토글 버튼 이벤트 리스너 및 로컬 스토리지 초기화
    if (devModeToggle) {
      // 로컬 스토리지에서 개발 모드 설정 불러오기
      isDevMode = localStorage.getItem('devMode') === 'true';
      devModeToggle.checked = isDevMode;
      updateDevMode();

      // 개발 모드 토글 이벤트 처리
      devModeToggle.addEventListener('change', () => {
        isDevMode = devModeToggle.checked;
        localStorage.setItem('devMode', isDevMode);
        updateDevMode();
      });

      // 개발 모드 토글 표시 (체크 상태와 관계없이)
      const devOnlyElements = document.querySelectorAll('.dev-only');
      devOnlyElements.forEach(el => el.style.display = 'flex');
    }

    // 초기 상태 설정 
    generateAIReportBtn.disabled = true;

    // 개발자 도구 단축키 (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        isDevMode = !isDevMode;
        if (devModeToggle) devModeToggle.checked = isDevMode;
        localStorage.setItem('devMode', isDevMode);
        updateDevMode();
        console.log(`개발 모드: ${isDevMode ? '활성화' : '비활성화'}`);
      }
    });
  }

  /**
   * 개발 모드 상태 업데이트
   */
  function updateDevMode() {
    if (isDevMode) {
      document.body.classList.add('dev-mode');
    } else {
      document.body.classList.remove('dev-mode');
    }

    // 개발 모드 변경 이벤트 발생
    const event = new CustomEvent('devModeChanged', {
      detail: { isDevMode },
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  /**
   * OCR 처리 완료 이벤트 핸들러
   * @param {CustomEvent} event OCR 완료 이벤트
   */
  function handleOCRComplete(event) {
    console.log('OCR 처리 완료 이벤트 감지:', event.detail);
    if (event.detail && event.detail.text) {
      extractedText = event.detail.text;
      ocrCompleted = true;

      // OCR 완료 후 자동으로 요약표 생성 버튼 활성화
      if (generateAIReportBtn) {
        generateAIReportBtn.disabled = false;
        // 버튼에 애니메이션 효과 추가
        generateAIReportBtn.classList.add('btn-pulse');
        setTimeout(() => {
          generateAIReportBtn.classList.remove('btn-pulse');
        }, 2000);
      }

      // 추출된 텍스트가 표시 영역에 있는 경우 설정
      if (extractedTextDisplay) {
        extractedTextDisplay.textContent = event.detail.text.length > 300 ? event.detail.text.substring(0, 300) + '...' : event.detail.text;
      }

      // 자동 보고서 생성 설정이 켜져 있으면 리포트 생성 실행
      if (autoGenerateReport && event.detail.text) {
        console.log('AI 보고서 자동 생성 중...');
        setTimeout(() => {
          console.log('자동 AI 리포트 생성 시작');
          generateAIReport();
        }, 1000); // 1초 딜레이 후 자동 실행
      }
    }
  }

  /**
   * 타임라인 생성 완료 이벤트 핸들러
   * @param {CustomEvent} event 타임라인 생성 완료 이벤트
   */
  function handleTimelineGenerated(event) {
    console.log('타임라인 생성 완료 이벤트 감지:', event.detail);
    // 타임라인 데이터를 저장하여 AI 보고서 생성에 사용
    if (event.detail && event.detail.data) {
      timelineData = event.detail.data;
    }
  }

  /**
   * AI 보고서 생성 함수
   */
  async function generateAIReport() {
    try {
      // 텍스트가 추출되지 않았으면 OCR 결과 가져오기
      if (!extractedText) {
        if (resultData && resultData.results) {
          const ocrTexts = Object.values(resultData.results).map(item => item.mergedText || item.text || item.rawText || '');
          extractedText = ocrTexts.join('\n\n');
        } else {
          try {
            // 결과 API 호출
            const response = await fetch(`${API_URL}/api/ocr/result/${currentJobId}`);
            const result = await response.json();

            if (result.success && result.data) {
              extractedText = result.data.text || '';
            }
          } catch (err) {
            console.error('결과 가져오기 오류:', err);
          }
        }
      }

      if (!extractedText) {
        updateStatus('warning', '분석된 텍스트가 없습니다. 먼저 문서를 업로드하고 분석을 완료해주세요.');
        return;
      }

      // 환자 정보 수집
      const patientName = document.getElementById('patientName')?.value || '환자';
      const patientMemo = document.getElementById('patientMemo')?.value || '';
      let enrollmentDate = '';

      // 보험 정보 수집
      const insuranceElements = document.querySelectorAll('.insurance-record');
      const insuranceData = [];

      insuranceElements.forEach(el => {
        const company = el.querySelector('.insurance-company').value;
        const date = el.querySelector('.insurance-date').value;
        const product = el.querySelector('.insurance-product').value;

        if (company && date) {
          insuranceData.push({
            company,
            product,
            start_date: date
          });
        }
      });

      // 최신 보험 가입일을 기준으로 설정
      if (insuranceData.length > 0) {
        enrollmentDate = insuranceData
          .filter(ins => ins.start_date)
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0]?.start_date || '';
      }

      // 로딩 상태 표시
      aiReportLoading.classList.remove('d-none');
      generateAIReportBtn.disabled = true;

      // API 요청
      const response = await fetch(`${API_URL}/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedText,
          patientInfo: {
            name: patientName,
            dob: patientMemo, // 메모 필드에 생년월일 정보가 있을 수 있음
            enrollmentDate: enrollmentDate,
            insurance: insuranceData
          }
        })
      });

      const result = await response.json();

      // 로딩 상태 제거
      aiReportLoading.classList.add('d-none');
      generateAIReportBtn.disabled = false;

      if (result.success) {
        // 섹션 표시
        aiReportSection.classList.remove('d-none');

        // JSON 블록 파싱 및 분리
        let reportText = result.report;
        let violationAlertHtml = '';

        const jsonMatch = reportText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const alertData = JSON.parse(jsonMatch[1]);
            if (alertData.violationAlert) {
              violationAlertHtml = renderViolationAlert(alertData.violationAlert);
            }
            // JSON 블록 제거
            reportText = reportText.replace(jsonMatch[0], '').trim();
          } catch (e) {
            console.error('JSON 파싱 오류:', e);
          }
        }

        // 보고서 내용 표시 (Alert + Markdown)
        aiReportContent.innerHTML = violationAlertHtml + markdownToHtml(reportText);

        if (copyReportBtn) copyReportBtn.disabled = false;
        var rb = document.getElementById('reportProgressBar');
        var rp = document.getElementById('reportProgressPercentage');
        var rs = document.getElementById('reportProgressStatus');
        if (rb && rp && rs) {
          rb.style.width = '100%';
          rb.setAttribute('aria-valuenow', 100);
          rp.textContent = '100%';
          rs.textContent = '완료';
          rs.className = 'progress-status text-center completed';
        }

        // 세션 ID 저장
        currentSessionId = result.sessionId;

        // 타임라인 데이터 추출 및 표시
        const timelineData = extractTimelineFromReport(result.report);
        if (timelineData && timelineData.length > 0) {
          renderTimelineTable(timelineData);

          const timelineSection = document.getElementById('timeline-section');
          if (timelineSection) {
            timelineSection.classList.remove('d-none');
            document.getElementById('timeline-title').textContent = 'AI 병력사항 요약 경과표';
            timelineSection.scrollIntoView({ behavior: 'smooth' });
          }
        }

        // AI 분석 인사이트 생성 및 표시
        generateAnalysisInsights(result.report, timelineData, violationAlertHtml ? true : false);

        // 스크롤 조정
        aiReportSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        // 오류 메시지 표시
        aiReportContent.innerHTML = `<div class="alert alert-danger">보고서 생성 중 오류가 발생했습니다: ${result.error || '알 수 없는 오류'}</div>`;
        aiReportSection.classList.remove('d-none');
        if (copyReportBtn) copyReportBtn.disabled = true;
        var rb2 = document.getElementById('reportProgressBar');
        var rp2 = document.getElementById('reportProgressPercentage');
        var rs2 = document.getElementById('reportProgressStatus');
        if (rb2 && rp2 && rs2) {
          rb2.style.width = '0%';
          rb2.setAttribute('aria-valuenow', 0);
          rp2.textContent = '0%';
          rs2.textContent = '오류';
          rs2.className = 'progress-status text-center error';
        }
      }
    } catch (error) {
      console.error('AI 보고서 생성 오류:', error);
      aiReportLoading.classList.add('d-none');
      generateAIReportBtn.disabled = false;
      aiReportContent.innerHTML = `<div class="alert alert-danger">보고서 생성 중 오류가 발생했습니다: ${error.message}</div>`;
      aiReportSection.classList.remove('d-none');
      if (copyReportBtn) copyReportBtn.disabled = true;
      var rb3 = document.getElementById('reportProgressBar');
      var rp3 = document.getElementById('reportProgressPercentage');
      var rs3 = document.getElementById('reportProgressStatus');
      if (rb3 && rp3 && rs3) {
        rb3.style.width = '0%';
        rb3.setAttribute('aria-valuenow', 0);
        rp3.textContent = '0%';
        rs3.textContent = '오류';
        rs3.className = 'progress-status text-center error';
      }
    }
  }

  function copyReportContent() {
    // 순수 텍스트 버전 사용 (HTML 디자인 요소 제외)
    const text = getPlainTextForCopy();
    if (!text) return;

    try {
      navigator.clipboard.writeText(text).then(() => {
        if (copyReportBtn) {
          const orig = copyReportBtn.textContent;
          copyReportBtn.textContent = '복사됨';
          copyReportBtn.disabled = true;
          setTimeout(() => { copyReportBtn.textContent = orig; copyReportBtn.disabled = false; }, 1200);
        }
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) { }
        document.body.removeChild(ta);
        if (copyReportBtn) {
          const orig = copyReportBtn.textContent;
          copyReportBtn.textContent = '복사됨';
          copyReportBtn.disabled = true;
          setTimeout(() => { copyReportBtn.textContent = orig; copyReportBtn.disabled = false; }, 1200);
        }
      });
    } catch (_) { }
  }

  /**
   * 순수 텍스트 가져오기 (복사용)
   */
  function getPlainTextForCopy() {
    if (plainTextReport) return plainTextReport;
    const container = document.querySelector('.medical-report-container') || aiReportContent;
    return container ? (container.innerText || '') : '';
  }

  /**
   * 향상된 타임라인 렌더링 (기간 마커 포함)
   * @param {Array} events 이벤트 배열
   * @param {string} enrollmentDate 가입일 (YYYY-MM-DD)
   * @returns {string} 렌더링된 HTML
   */
  function renderEnhancedTimeline(events, enrollmentDate) {
    if (!events || events.length === 0) return '';

    const enrollDate = enrollmentDate ? new Date(enrollmentDate) : null;
    currentEnrollmentDate = enrollDate;

    // 날짜순 정렬 (과거→최신)
    const sortedEvents = [...events].sort((a, b) => {
      const dateA = new Date(String(a.date).replace(/\./g, '-'));
      const dateB = new Date(String(b.date).replace(/\./g, '-'));
      return dateA - dateB;
    });

    let html = '<div class="enhanced-timeline">';
    let plainText = '';

    // 가입일 표시 (가입일이 있는 경우)
    if (enrollDate) {
      const formattedDate = enrollDate.toISOString().split('T')[0].replace(/-/g, '.');
      html += `
        <div class="timeline-event contract-event">
          <div class="period-marker contract-date">계약</div>
          <div class="event-date-header">
            <span class="event-date">${formattedDate} (계약일)</span>
          </div>
          <div class="event-content contract">
            <div class="event-hospital">보험 계약 체결일</div>
          </div>
        </div>
      `;
      plainText += `${formattedDate} (계약일)\n보험 계약 체결일\n\n`;
    }

    sortedEvents.forEach((event, index) => {
      const eventDateStr = String(event.date).replace(/\./g, '-');
      const eventDate = new Date(eventDateStr);

      // D-day 계산 (가입일 기준)
      let dDay = '';
      let periodClass = 'normal';
      let periodLabel = '';
      let isCritical = false;

      if (enrollDate && !isNaN(eventDate)) {
        const diffTime = eventDate - enrollDate;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        dDay = diffDays >= 0 ? `D+${diffDays}` : `D${diffDays}`;

        const absDays = Math.abs(diffDays);
        if (absDays <= 90) { // 3개월 이내
          periodClass = 'critical-3m';
          periodLabel = '3m';
          isCritical = true;
        } else if (absDays <= 1825) { // 5년 이내
          periodClass = 'important-5y';
          periodLabel = '5y';
        }
      }

      const hospital = event.hospital || '';
      const diagnosis = Array.isArray(event.diagnosis) ? Array.from(new Set(event.diagnosis.map(String))).join(', ') : (event.diagnosis || '');
      const treatment = Array.isArray(event.treatment) ? Array.from(new Set(event.treatment.map(String))).join(', ') : (event.treatment || '');
      const displayDate = String(event.date).replace(/-/g, '.');

      html += `
        <div class="timeline-event">
          <div class="period-marker ${periodClass}">${periodLabel}</div>
          <div class="event-date-header">
            <span class="event-date">${displayDate}</span>
            ${dDay ? `<span class="event-d-day">(${dDay})</span>` : ''}
            ${isCritical ? '<span class="critical-badge">Critical Event</span>' : ''}
          </div>
          <div class="event-content ${isCritical ? 'critical' : periodClass === 'important-5y' ? 'important' : ''}">
            ${hospital ? `<div class="event-hospital">${hospital}</div>` : ''}
            ${diagnosis ? `<div class="event-diagnosis">진단: ${diagnosis}</div>` : ''}
            ${treatment ? `<div class="event-diagnosis">치료: ${treatment}</div>` : ''}
          </div>
        </div>
      `;

      // Plain text version
      plainText += `${displayDate}${dDay ? ` (${dDay})` : ''}\n`;
      if (hospital) plainText += `${hospital}`;
      if (diagnosis) plainText += ` | 진단: ${diagnosis}`;
      if (treatment) plainText += ` | 치료: ${treatment}`;
      plainText += '\n\n';
    });

    html += '</div>';

    // 저장: 순수 텍스트 버전
    plainTextReport = plainText;

    return html;
  }

  /**
   * 복사 기능 (순수 텍스트 사용)
   */
  function getPlainTextForCopy() {
    if (plainTextReport) return plainTextReport;
    const container = document.querySelector('.medical-report-container') || aiReportContent;
    return container ? (container.innerText || '') : '';
  }


  /**
   * 고지의무 위반 알림 렌더링
   * @param {Object} alertData 위반 알림 데이터
   * @returns {string} HTML 문자열
   */
  function renderViolationAlert(alertData) {
    if (!alertData) return '';

    const isDetected = alertData.detected;
    const badgeClass = isDetected ? 'bg-danger' : 'bg-success';
    const borderClass = isDetected ? 'border-danger' : 'border-success';
    const icon = isDetected ? 'exclamation-triangle-fill' : 'check-circle-fill';
    const titleColor = isDetected ? 'text-danger' : 'text-success';

    let timelineHtml = '';
    if (alertData.criticalEvents && alertData.criticalEvents.length > 0) {
      timelineHtml = '<div class="violation-timeline mt-4 ps-2">';
      alertData.criticalEvents.forEach((event, index) => {
        const isCritical = event.isCritical;
        const dotClass = isCritical ? 'bg-danger' : 'bg-primary';
        const dateClass = isCritical ? 'fw-bold text-danger' : 'fw-bold text-primary';

        timelineHtml += `
          <div class="timeline-item d-flex mb-4 position-relative">
            <div class="timeline-marker me-3 d-flex flex-column align-items-center" style="width: 20px;">
              <div class="rounded-circle ${dotClass} border border-white shadow-sm" style="width: 16px; height: 16px; z-index: 2;"></div>
              ${index < alertData.criticalEvents.length - 1 ? '<div class="timeline-line bg-secondary bg-opacity-25" style="width: 2px; flex-grow: 1; margin-top: -2px; margin-bottom: -10px;"></div>' : ''}
            </div>
            <div class="timeline-content pb-1">
              <div class="${dateClass} mb-1 d-flex align-items-center flex-wrap gap-2">
                <span style="font-size: 1.1rem;">${event.date}</span>
                <span class="badge bg-light text-dark border shadow-sm">${event.dDay}</span>
                ${isCritical ? '<span class="badge bg-danger-subtle text-danger border border-danger-subtle">Critical Event</span>' : ''}
              </div>
              <div class="text-secondary" style="font-size: 0.95rem;">${event.content}</div>
            </div>
          </div>
        `;
      });
      timelineHtml += '</div>';
    }

    return `
      <div class="card mb-4 shadow-sm ${borderClass}" style="border-left: 5px solid ${isDetected ? '#dc3545' : '#198754'};">
        <div class="card-body p-4">
          <div class="d-flex align-items-center mb-4">
            <div class="rounded-circle ${badgeClass} text-white d-flex align-items-center justify-content-center me-3 shadow-sm" style="width: 48px; height: 48px;">
              <i class="bi bi-${icon}" style="font-size: 1.5rem;"></i>
            </div>
            <h4 class="mb-0 fw-bold ${titleColor}" style="letter-spacing: -0.5px;">${alertData.title}</h4>
          </div>
          
          <div class="alert ${isDetected ? 'alert-danger' : 'alert-success'} bg-opacity-10 border-0 rounded-3 p-4 mb-0 position-relative">
            <i class="bi bi-quote position-absolute text-secondary opacity-25" style="top: 10px; left: 15px; font-size: 3rem; line-height: 1;"></i>
            <p class="mb-0 fs-5 fst-italic fw-medium text-dark ps-4" style="line-height: 1.6; position: relative; z-index: 1;">
              "${alertData.summary}"
            </p>
          </div>

          ${timelineHtml}
        </div>
      </div>
    `;
  }

  /**
   * 마크다운을 HTML로 변환하는 함수
   * @param {string} text 마크다운 텍스트
   * @returns {string} HTML 텍스트
   */
  function markdownToHtml(text) {
    if (!text) return '';

    // 안전한 마크다운 변환
    return text
      // 코드 블록
      .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
      // 볼드 텍스트
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // 이탤릭 텍스트
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // 헤더
      .replace(/^#### (.*?)$/gm, '<h4>$1</h4>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      // 수평선
      .replace(/^---+$/gm, '<hr>')
      // 리스트
      .replace(/^- (.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>')
      // 개행 문자를 <br>로 변환
      .replace(/\n/g, '<br>');
  }

  /**
   * AI 보고서 마크다운에서 타임라인 데이터 추출
   * @param {string} reportMarkdown 보고서 마크다운 텍스트
   * @returns {Array} 타임라인 데이터 배열
   */
  function extractTimelineFromReport(reportMarkdown) {
    try {
      const lines = reportMarkdown.split('\n');
      const timelineData = [];
      let inTable = false;
      let tableHeaders = [];

      // 마크다운 테이블 형식 파싱
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 테이블 시작 (헤더 행) 찾기
        if (line.includes('날짜') && line.includes('병원') && line.includes('내용') && !inTable) {
          inTable = true;
          tableHeaders = line.split('|').map(h => h.trim());
          continue;
        }

        // 구분선 스킵
        if (line.startsWith('------') || line === '') {
          continue;
        }

        // 테이블 데이터 행 처리
        if (inTable && line.includes('|')) {
          const cells = line.split('|').map(cell => cell.trim());

          // 날짜 행인 경우
          if (cells[1] && cells[1].match(/(\[3M\]|\[5Y\]|\d{4}-\d{2}-\d{2})/) && cells.length >= 4) {
            // 태그 제거 및 날짜 정규화
            let date = cells[1].replace(/\[3M\]|\[5Y\]/g, '').trim();
            const hospital = cells[2];
            let content = cells[3];

            // 다음 행이 키워드 행인지 확인
            let keywords = '';
            if (i + 1 < lines.length && lines[i + 1].includes('주요 키워드')) {
              keywords = lines[i + 1].split('|')[2]?.trim() || '';
              i++; // 키워드 행 처리했으므로 인덱스 증가
            }

            // 타임라인 항목 추가
            timelineData.push({
              date: date,
              hospital: hospital,
              diagnosis: [content],
              treatment: keywords ? [keywords] : []
            });
          }
        }
      }

      // 날짜 기준 올림차순(과거 → 최신) 정렬
      return timelineData.sort((a, b) => {
        const dateA = new Date(a.date.replace(/\./g, '-'));
        const dateB = new Date(b.date.replace(/\./g, '-'));
        return dateA - dateB;
      });
    } catch (error) {
      console.error('보고서에서 타임라인 데이터 추출 오류:', error);
      return [];
    }
  }

  /**
   * Connect to Backend Reasoning Stream (SSE)
   */
  /**
   * AI 분석 인사이트 생성 및 표시
   * @param {string} reportText 보고서 텍스트
   * @param {Array} timelineData 타임라인 데이터
   * @param {boolean} hasViolation 위반 사항 존재 여부
   */
  function generateAnalysisInsights(reportText, timelineData, hasViolation) {
    const container = document.getElementById('reasoning-stream-container');
    if (!container) return;

    let insights = [];

    // 1. 핵심 발견 (Key Findings)
    if (hasViolation) {
      insights.push({
        type: 'danger',
        icon: 'exclamation-triangle-fill',
        title: '고지의무 위반 위험 감지',
        desc: '가입 전 중요 병력이 발견되었습니다. 상세 내용을 확인하세요.'
      });
    }

    // 2. 타임라인 분석
    if (timelineData && timelineData.length > 0) {
      const totalEvents = timelineData.length;
      const recentEvents = timelineData.filter(e => {
        if (!currentEnrollmentDate) return false;
        const eventDate = new Date(String(e.date).replace(/\./g, '-'));
        const diffTime = Math.abs(eventDate - currentEnrollmentDate);
        return diffTime <= (90 * 24 * 60 * 60 * 1000); // 90일(3개월)
      }).length;

      insights.push({
        type: 'info',
        icon: 'bar-chart-fill',
        title: '의료 이력 통계',
        desc: `총 ${totalEvents}건의 이력이 발견되었습니다.${recentEvents > 0 ? ` (최근 3개월 내 <strong>${recentEvents}건</strong>)` : ''}`
      });
    }

    // 3. 데이터 누락 확인
    if (!currentEnrollmentDate) {
      insights.push({
        type: 'warning',
        icon: 'calendar-x',
        title: '보험 가입일 정보 없음',
        desc: '가입일 기준 기간(3개월/5년) 분석이 제한됩니다. 가입일을 입력해주세요.'
      });
    }

    // 4. 검토 요청 (랜덤 또는 특정 조건)
    // 예: 진단명이 불명확하거나 '기타'인 경우
    const ambiguousEvents = timelineData.filter(e =>
      e.diagnosis && (e.diagnosis.some(d => d.includes('기타') || d.includes('상세불명')))
    );

    if (ambiguousEvents.length > 0) {
      insights.push({
        type: 'secondary',
        icon: 'search',
        title: '상세 검토 필요',
        desc: `${ambiguousEvents[0].date} 진단명('${ambiguousEvents[0].diagnosis[0]}')에 대한 상세 확인이 권장됩니다.`
      });
    }

    // HTML 생성
    if (insights.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3">특이사항이 발견되지 않았습니다.</div>';
      return;
    }

    let html = '<div class="d-flex flex-column gap-3">';
    insights.forEach(item => {
      const colorClass = item.type === 'danger' ? 'text-danger' :
        item.type === 'warning' ? 'text-warning' :
          item.type === 'info' ? 'text-primary' : 'text-secondary';

      const bgClass = item.type === 'danger' ? 'bg-danger-subtle' :
        item.type === 'warning' ? 'bg-warning-subtle' :
          item.type === 'info' ? 'bg-primary-subtle' : 'bg-secondary-subtle';

      html += `
        <div class="d-flex align-items-start p-3 rounded-3 ${bgClass} bg-opacity-10">
          <div class="rounded-circle ${bgClass} ${colorClass} d-flex align-items-center justify-content-center flex-shrink-0 me-3" style="width: 32px; height: 32px;">
            <i class="bi bi-${item.icon}"></i>
          </div>
          <div>
            <h6 class="fw-bold mb-1 ${colorClass}">${item.title}</h6>
            <p class="mb-0 small text-dark opacity-75" style="line-height: 1.4;">${item.desc}</p>
          </div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  // 전역 네임스페이스에 필요한 함수들 노출
  window.VNEXSUSApp.AIReport = {
    initAIReport: initAIReport,
    generateAIReport: generateAIReport,
    handleOCRComplete: handleOCRComplete,
    handleTimelineGenerated: handleTimelineGenerated,
    renderEnhancedTimeline: renderEnhancedTimeline
  };

})(); // IIFE 종료
