/**
 * AI 보고서 생성 및 채팅 기능
 * 
 * OpenAI GPT-4 Turbo를 통한 의료 보고서 생성 및 상호작용 기능을 구현합니다.
 */

// DOM 요소
const aiReportSection = document.getElementById('ai-report-section');
const generateAIReportBtn = document.getElementById('generateAIReportBtn');
const aiReportLoading = document.getElementById('ai-report-loading');
const aiReportContent = document.getElementById('ai-report-content');
const extractedTextDisplay = document.getElementById('extracted-text-display');
const autoGenerateToggle = document.getElementById('auto-generate-toggle');
const devModeToggle = document.getElementById('dev-mode-toggle');

// 채팅 UI 요소 (동적 생성)
let aiChatSection = null;
let chatContainer = null;
let chatInput = null;
let sendButton = null;

// 전역 변수
let currentSessionId = null;
let extractedText = null;
let ocrCompleted = false;
let autoGenerateReport = true; // 자동 생성 플래그
let isDevMode = false; // 개발 모드 플래그

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initAIReport);

/**
 * AI 보고서 기능 초기화
 */
function initAIReport() {
  console.log('AI 보고서 모듈 초기화');
  
  // 채팅 UI 생성
  createChatUI();
  
  // 버튼 이벤트 핸들러
  if (generateAIReportBtn) {
    generateAIReportBtn.addEventListener('click', generateAIReport);
  }
  
  // 메시지가 있을 때 UI 표시
  setTimeout(() => {
    // 메인 앱에서 발생하는 이벤트 리스너 추가
    document.addEventListener('ocrComplete', handleOCRComplete);
    document.addEventListener('timelineGenerated', handleTimelineGenerated);
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
      console.log('Auto-generating AI report...');
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
        const ocrTexts = Object.values(resultData.results).map(item => item.mergedText);
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
      alert('분석된 텍스트가 없습니다. 먼저 문서를 업로드하고 분석을 완료해주세요.');
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
      
      // 보고서 내용 표시
      aiReportContent.innerHTML = markdownToHtml(result.report);
      
      // 세션 ID 저장 (채팅용)
      currentSessionId = result.sessionId;
      
      // 채팅 섹션 활성화
      if (aiChatSection) {
        aiChatSection.classList.remove('d-none');
        // 초기 메시지 추가
        addMessage('assistant', '보고서가 생성되었습니다. 의료 보고서에 대해 질문이 있으시면 입력해주세요.');
      }
      
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
      
      // 스크롤 조정
      aiReportSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // 오류 메시지 표시
      aiReportContent.innerHTML = `<div class="alert alert-danger">보고서 생성 중 오류가 발생했습니다: ${result.error || '알 수 없는 오류'}</div>`;
      aiReportSection.classList.remove('d-none');
    }
  } catch (error) {
    console.error('AI 보고서 생성 오류:', error);
    aiReportLoading.classList.add('d-none');
    generateAIReportBtn.disabled = false;
    aiReportContent.innerHTML = `<div class="alert alert-danger">보고서 생성 중 오류가 발생했습니다: ${error.message}</div>`;
    aiReportSection.classList.remove('d-none');
  }
}



/**
 * 마크다운을 HTML로 변환하는 함수
 * @param {string} text 마크다운 텍스트
 * @returns {string} HTML 텍스트
 */
function markdownToHtml(text) {
  if (!text) return '';
  
  // 기본적인 마크다운 요소만 변환합니다
  return text
    // 코드 블록
    .replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
    // 볼드 텍스트
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 이탤릭 텍스트
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 헤더
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    // 리스트
    .replace(/^\- (.*?)$/gm, '<li>$1</li>')
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
 * 채팅 UI 생성
 */
function createChatUI() {
  // AI 보고서 섹션 다음에 채팅 섹션 추가
  if (!document.getElementById('ai-chat-section')) {
    const chatHTML = `
      <div id="ai-chat-section" class="section d-none mt-4">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
              <i class="fas fa-comments me-2"></i>AI 보고서 상담
            </h5>
            <div>
              <span id="chat-status" class="badge bg-success">연결됨</span>
              <button id="end-chat-btn" class="btn btn-sm btn-outline-danger ms-2">
                <i class="fas fa-times"></i> 상담 종료
              </button>
            </div>
          </div>
          <div class="card-body p-0">
            <div id="chat-container" class="chat-container p-3" style="height: 400px; overflow-y: auto; background-color: #f8f9fa;">
              <!-- 채팅 메시지들이 여기에 표시됩니다 -->
            </div>
            <div class="chat-input-container p-3 border-top">
              <div class="input-group">
                <input type="text" id="chat-input" class="form-control" 
                       placeholder="보고서에 대해 질문해주세요..." 
                       maxlength="500">
                <button id="send-chat-btn" class="btn btn-primary" type="button">
                  <i class="fas fa-paper-plane"></i> 전송
                </button>
              </div>
              <div class="mt-2">
                <small class="text-muted">
                  <i class="fas fa-info-circle"></i> 
                  보고서 내용에 대한 질문, 추가 설명 요청, 수정 사항 등을 입력해주세요.
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // AI 보고서 섹션 다음에 삽입
    aiReportSection.insertAdjacentHTML('afterend', chatHTML);
    
    // 채팅 CSS 스타일 추가
    addChatStyles();
  }
  
  // DOM 요소 참조 설정
  aiChatSection = document.getElementById('ai-chat-section');
  chatContainer = document.getElementById('chat-container');
  chatInput = document.getElementById('chat-input');
  sendButton = document.getElementById('send-chat-btn');
  
  // 이벤트 리스너 설정
  setupChatEventListeners();
}

/**
 * 채팅 CSS 스타일 추가
 */
function addChatStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .chat-container {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border-radius: 8px;
    }
    
    .chat-message {
      margin-bottom: 15px;
      display: flex;
      align-items: flex-start;
    }
    
    .chat-message.user {
      justify-content: flex-end;
    }
    
    .chat-message.assistant {
      justify-content: flex-start;
    }
    
    .message-bubble {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 18px;
      word-wrap: break-word;
      position: relative;
    }
    
    .chat-message.user .message-bubble {
      background: #007bff;
      color: white;
      border-bottom-right-radius: 4px;
    }
    
    .chat-message.assistant .message-bubble {
      background: white;
      color: #333;
      border: 1px solid #e9ecef;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    
    .message-time {
      font-size: 0.75rem;
      color: #6c757d;
      margin-top: 4px;
    }
    
    .typing-indicator {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: white;
      border-radius: 18px;
      border-bottom-left-radius: 4px;
      max-width: 70%;
      border: 1px solid #e9ecef;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    
    .typing-dots {
      display: flex;
      gap: 4px;
    }
    
    .typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #6c757d;
      animation: typing 1.4s infinite ease-in-out;
    }
    
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes typing {
      0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }
    
    .chat-input-container {
      background: white;
    }
    
    #chat-input:focus {
      border-color: #007bff;
      box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
  `;
  document.head.appendChild(style);
}

/**
 * 채팅 이벤트 리스너 설정
 */
function setupChatEventListeners() {
  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  }
  
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // 상담 종료 버튼
  const endChatBtn = document.getElementById('end-chat-btn');
  if (endChatBtn) {
    endChatBtn.addEventListener('click', endChatSession);
  }
}

/**
 * 메시지 전송
 */
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || !currentSessionId) return;
  
  // 사용자 메시지 추가
  addMessage('user', message);
  chatInput.value = '';
  
  // 전송 버튼 비활성화
  sendButton.disabled = true;
  
  // 타이핑 인디케이터 표시
  showTypingIndicator();
  
  try {
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: currentSessionId,
        message: message
      })
    });
    
    const result = await response.json();
    
    // 타이핑 인디케이터 제거
    hideTypingIndicator();
    
    if (result.success) {
      // AI 응답 추가
      addMessage('assistant', result.response);
    } else {
      addMessage('assistant', '죄송합니다. 응답을 생성하는 중 오류가 발생했습니다.');
    }
  } catch (error) {
    console.error('메시지 전송 오류:', error);
    hideTypingIndicator();
    addMessage('assistant', '네트워크 오류가 발생했습니다. 다시 시도해주세요.');
  } finally {
    // 전송 버튼 활성화
    sendButton.disabled = false;
    chatInput.focus();
  }
}

/**
 * 메시지 추가
 */
function addMessage(sender, content) {
  if (!chatContainer) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${sender}`;
  
  const now = new Date();
  const timeString = now.toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  messageDiv.innerHTML = `
    <div class="message-bubble">
      <div class="message-content">${formatMessage(content)}</div>
      <div class="message-time">${timeString}</div>
    </div>
  `;
  
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * 메시지 포맷팅
 */
function formatMessage(content) {
  // 기본적인 마크다운 스타일 지원
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/**
 * 타이핑 인디케이터 표시
 */
function showTypingIndicator() {
  if (!chatContainer) return;
  
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-message assistant';
  typingDiv.id = 'typing-indicator';
  
  typingDiv.innerHTML = `
    <div class="typing-indicator">
      <span class="me-2">AI가 응답 중</span>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  
  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * 타이핑 인디케이터 제거
 */
function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

/**
 * 채팅 세션 종료
 */
async function endChatSession() {
  if (!currentSessionId) return;
  
  try {
    await fetch(`/api/chat/session/${currentSessionId}/end`, {
      method: 'POST'
    });
    
    // 채팅 섹션 숨기기
    if (aiChatSection) {
      aiChatSection.classList.add('d-none');
    }
    
    // 세션 ID 초기화
    currentSessionId = null;
    
    // 채팅 컨테이너 초기화
    if (chatContainer) {
      chatContainer.innerHTML = '';
    }
    
  } catch (error) {
    console.error('채팅 세션 종료 오류:', error);
  }
}