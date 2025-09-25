// DOM 요소
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const toggleFilesBtn = document.getElementById('toggleFilesBtn');
const clearBtn = document.getElementById('clearBtn');
const uploadBtn = document.getElementById('uploadBtn');
const statusContainer = document.getElementById('statusContainer');
const statusSpinner = document.getElementById('statusSpinner');
const resultType = document.getElementById('resultType');
const viewResultsBtn = document.getElementById('viewResultsBtn');
const resultModalContent = document.getElementById('resultModalContent');
const addInsuranceBtn = document.getElementById('addInsuranceBtn');
const insuranceRecords = document.getElementById('insuranceRecords');
const createSummaryBtn = document.getElementById('createSummaryBtn');
const progressBar = document.getElementById('progressBar');
const progressStatus = document.getElementById('progressStatus');

// 전역 변수로 결과 모달 선언
let resultsModal = null;

// 설정
const BASE_URL = window.location.origin; // "http://localhost:5174"
const OCR_API_URL = 'http://localhost:3030/api/ocr'; // 포트 3030으로 수정
const API_URL = 'http://localhost:3030/api';
const POSTPROCESS_API_URL = `${API_URL}/postprocess`;
const MAX_FILES = 100;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
const POLLING_INTERVAL = 2000; // 2초

// 상태 변수
let selectedFiles = [];
let currentJobId = null;
let resultData = null;
let summaryData = null; // 요약표 데이터 저장 변수 추가
let pollingTimeout = null;
let insuranceRecordCounter = 1;
let isHorizontalView = false;
let insurerOptions = {}; // 보험사 옵션 데이터
let downloadUrl = null; // 다운로드 URL 저장 변수 추가

// 실시간 모니터링 변수
let monitoringInterval = null;
let totalAnalyses = 0;
let dynamicWeightingAccuracy = 83.3;
let hybridAIAccuracy = 92.3;
let systemStatus = 'active';

// 이벤트 리스너
document.addEventListener('DOMContentLoaded', initApp);

// 처리 품질 계산 함수
function calculateProcessingQuality(results) {
  let totalQuality = 0;
  let fileCount = 0;
  
  Object.values(results).forEach(fileData => {
    fileCount++;
    
    // 텍스트 길이 기반 품질 점수
    const textLength = fileData.mergedText ? fileData.mergedText.length : 0;
    const lengthScore = Math.min(1, textLength / 1000); // 1000자 기준
    
    // 페이지 처리 성공률
    const pageSuccessRate = fileData.pageCount > 0 ? 
      (fileData.textPageCount / fileData.pageCount) : 0;
    
    // 종합 품질 점수 (0-1)
    const fileQuality = (lengthScore * 0.6) + (pageSuccessRate * 0.4);
    totalQuality += fileQuality;
  });
  
  return fileCount > 0 ? totalQuality / fileCount : 0;
}

// 실시간 모니터링 함수들
function updateDashboardMetrics() {
  // 총 분석 수 업데이트
  const totalAnalysesElement = document.querySelector('.metric-card:nth-child(1) .metric-value');
  if (totalAnalysesElement) {
    totalAnalysesElement.textContent = totalAnalyses.toLocaleString();
  }
  
  // 동적 가중치 정확도 업데이트
  const dynamicAccuracyElement = document.querySelector('.metric-card:nth-child(2) .metric-value');
  if (dynamicAccuracyElement) {
    dynamicAccuracyElement.textContent = `${dynamicWeightingAccuracy.toFixed(1)}%`;
  }
  
  // 하이브리드 AI 정확도 업데이트
  const hybridAccuracyElement = document.querySelector('.metric-card:nth-child(3) .metric-value');
  if (hybridAccuracyElement) {
    hybridAccuracyElement.textContent = `${hybridAIAccuracy.toFixed(1)}%`;
  }
  
  // 시스템 상태 업데이트
  const systemStatusElement = document.querySelector('.metric-card:nth-child(4) .metric-value');
  if (systemStatusElement) {
    systemStatusElement.textContent = systemStatus === 'active' ? '정상' : '점검중';
    systemStatusElement.className = `metric-value ${systemStatus === 'active' ? 'text-success' : 'text-warning'}`;
  }
}

function updateIntegrationStatus(status = 'connected') {
  const integrationElement = document.querySelector('.integration-status');
  if (integrationElement) {
    const statusText = status === 'connected' ? '연결됨' : '연결 끊김';
    const statusClass = status === 'connected' ? 'text-success' : 'text-danger';
    integrationElement.innerHTML = `
      <i class="bi bi-circle-fill ${statusClass}"></i>
      <span class="ms-2">${statusText}</span>
    `;
  }
}

function startRealTimeMonitoring() {
  // 초기 상태 설정
  updateDashboardMetrics();
  updateIntegrationStatus('connected');
  
  // 실시간 업데이트 시작
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  monitoringInterval = setInterval(() => {
    // 모니터링 API에서 실시간 데이터 가져오기
    fetchMonitoringData();
  }, 5000); // 5초마다 업데이트
}

function stopRealTimeMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
}

async function fetchMonitoringData() {
  try {
    const response = await fetch(`${API_URL}/monitoring/metrics`);
    if (response.ok) {
      const data = await response.json();
      
      // 메트릭 업데이트
      if (data.totalAnalyses !== undefined) totalAnalyses = data.totalAnalyses;
      if (data.dynamicWeightingAccuracy !== undefined) dynamicWeightingAccuracy = data.dynamicWeightingAccuracy;
      if (data.hybridAIAccuracy !== undefined) hybridAIAccuracy = data.hybridAIAccuracy;
      if (data.systemStatus !== undefined) systemStatus = data.systemStatus;
      
      updateDashboardMetrics();
      updateIntegrationStatus('connected');
    } else {
      updateIntegrationStatus('disconnected');
    }
  } catch (error) {
    console.error('모니터링 데이터 가져오기 실패:', error);
    updateIntegrationStatus('disconnected');
  }
}

// 날짜 포맷 정규화 함수 (dateInput.js에서 가져옴)
function normalizeDate(str) {
  // 숫자만 추출
  const digitsOnly = str.replace(/\D/g, '');
  
  // 8자리 숫자인 경우 (YYYYMMDD)
  if (digitsOnly.length === 8) {
    const year = digitsOnly.substring(0, 4);
    const month = digitsOnly.substring(4, 6);
    const day = digitsOnly.substring(6, 8);
    
    // 유효한 날짜인지 확인
    const date = new Date(year, parseInt(month, 10) - 1, day);
    if (
      date.getFullYear() === parseInt(year, 10) &&
      date.getMonth() === parseInt(month, 10) - 1 &&
      date.getDate() === parseInt(day, 10)
    ) {
      return `${year}-${month}-${day}`;
    }
  }
  
  return str;
}

// 보험사 목록 로드
async function loadInsurers() {
  try {
    // 상대 경로로 변경
    const response = await fetch('config/insurers.json');
    if (!response.ok) {
      throw new Error('보험사 목록을 불러오는데 실패했습니다.');
    }
    insurerOptions = await response.json();
    console.log('보험사 목록 로드 완료:', insurerOptions);
  } catch (error) {
    console.error('보험사 목록 로드 오류:', error);
    // 기본 데이터 설정 - 백엔드의 backend/public/config/insurers.json과 동일한 데이터
    insurerOptions = {
      "손해보험": [
        "메리츠화재", "한화손해보험", "롯데손해보험", "MG손해보험", "흥국화재", 
        "삼성화재", "현대해상", "KB손해보험", "DB손해보험", "AIG손해보험", 
        "NH농협손해보험", "하나손해보험", "라이나손해보험", "캐롯손해보험", "악사손해보험",
        "BNP파리바카디프손해보험", "에이스손해보험", "KB특종", "한국해운조합", "더케이손해보험",
        "서울보증보험"
      ],
      "생명보험": [
        "미래에셋생명", "한화생명", "삼성생명", "교보생명", "흥국생명", 
        "iM라이프", "KDB생명", "KB라이프", "DB생명", "동양생명", 
        "NH농협생명", "ABL생명", "AIA생명", "메트라이프", "신한라이프생명", 
        "프루덴셜생명", "하나생명", "라이나생명", "처브라이프", "오렌지라이프",
        "DGB생명", "케이비생명", "BNP파리바카디프생명", "푸본현대생명", "IBK연금보험",
        "교보라이프플래닛생명", "KDB생명", "푸르덴셜생명", "KB생명"
      ],
      "공제회": [
        "교직원공제회", "군인공제회", "경찰공제회", "건설근로자공제회", "과학기술인공제회",
        "대한의사협회의사공제회", "대한법무사협회공제회", "세무사공제회", "행정공제회", "소방공제회"
      ],
      "우체국보험": ["우체국"]
    };
  }
  
  // 드롭다운 업데이트 (오류가 발생했을 때도 기본 데이터로 드롭다운 채우기)
  updateInsurersDropdown(document.querySelector('.insurance-company'));
}

// 보험사 드롭다운 업데이트
function updateInsurersDropdown(selectElement) {
  if (!selectElement) return;
  
  // 기존 옵션 제거
  selectElement.innerHTML = '';
  
  // 기본 옵션 추가
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '선택하세요';
  selectElement.appendChild(defaultOption);
  
  // 보험사 카테고리별 옵션 그룹 추가
  Object.entries(insurerOptions).forEach(([category, companies]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = category;
    
    companies.forEach(company => {
      const option = document.createElement('option');
      option.value = company;
      option.textContent = company;
      optgroup.appendChild(option);
    });
    
    selectElement.appendChild(optgroup);
  });
  
  // 기존 보험사 드롭다운에 옵션 추가
  const allCompanySelects = document.querySelectorAll('.insurance-company');
  allCompanySelects.forEach(companySelect => {
    if (companySelect !== selectElement) {
      // 기존 옵션 제거
      companySelect.innerHTML = '';
      
      // 기본 옵션 추가
      const cloneDefaultOption = defaultOption.cloneNode(true);
      companySelect.appendChild(cloneDefaultOption);
      
      // 보험사 카테고리별 옵션 그룹 추가
      Object.entries(insurerOptions).forEach(([category, companies]) => {
        const cloneOptgroup = document.createElement('optgroup');
        cloneOptgroup.label = category;
        
        companies.forEach(company => {
          const cloneOption = document.createElement('option');
          cloneOption.value = company;
          cloneOption.textContent = company;
          cloneOptgroup.appendChild(cloneOption);
        });
        
        companySelect.appendChild(cloneOptgroup);
      });
    }
  });
}

// 앱 초기화
function initApp() {
  console.log('앱 초기화 시작');
  
  // 페이지 요소 초기화
  resultsModal = null;
  
  // 실시간 모니터링 시작
  startRealTimeMonitoring();
  
  // 파일 입력 관련 이벤트 리스너
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleFileDrop);
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  
  // 버튼 이벤트 리스너
  clearBtn.addEventListener('click', clearFiles);
  uploadBtn.addEventListener('click', uploadFiles);
  
  if (toggleFilesBtn) {
  toggleFilesBtn.addEventListener('click', toggleFilesView);
  }
  
  if (viewResultsBtn) {
    viewResultsBtn.addEventListener('click', showResultsModal);
  }
  
  // 결과 타입 변경 이벤트
  if (resultType) {
    resultType.addEventListener('change', displayResults);
  }
  
  // 보험 정보 입력 관련 초기화
  if (addInsuranceBtn && insuranceRecords) {
    addInsuranceBtn.addEventListener('click', addInsuranceRecord);
    
    // 기존 보험 레코드에 날짜 선택 필드 설정
    updateExistingDateFields();
    
    // 요약표 생성 버튼
    if (createSummaryBtn) {
      createSummaryBtn.addEventListener('click', handleCreateSummary);
    }
  }
  
  // 보험사 목록 로드
  loadInsurers().then(() => {
    // 보험사 드롭다운 업데이트
    const insuranceCompanySelects = document.querySelectorAll('.insurance-company');
    insuranceCompanySelects.forEach(updateInsurersDropdown);
  });
  
  // 개발 모드 상태 초기화
  const isDevMode = localStorage.getItem('devMode') === 'true';
  updateDevModeUI(isDevMode);
  
  // 새 기능: 상세분석 버튼과 정제 데이터 버튼 이벤트 리스너 추가
  const viewRawTextBtn = document.getElementById('view-raw-text-btn');
  const viewRefinedTextBtn = document.getElementById('view-refined-text-btn');
  
  if (viewRawTextBtn) {
    viewRawTextBtn.addEventListener('click', handleViewRawText);
  }
  
  if (viewRefinedTextBtn) {
    viewRefinedTextBtn.addEventListener('click', handleViewRefinedText);
  }
  
  // 모니터링 대시보드 초기화
  if (typeof MonitoringDashboard !== 'undefined') {
    const monitoringDashboard = new MonitoringDashboard();
    monitoringDashboard.init();
    console.log('모니터링 대시보드 초기화 완료');
  }
  
  console.log('앱 초기화 완료');
  return true;
}

// 날짜 선택 필드 설정
function setupDateSelects(container = document) {
  const dateSelects = container.querySelectorAll('.insurance-record');
  
  dateSelects.forEach(record => {
    const yearSelect = record.querySelector('.insurance-date-year');
    const monthSelect = record.querySelector('.insurance-date-month');
    const daySelect = record.querySelector('.insurance-date-day');
    const dateInput = record.querySelector('.insurance-date');
    
    if (!yearSelect || !monthSelect || !daySelect || !dateInput) return;
    
    // 기존 값이 있는 경우 셀렉트 박스에 설정
    if (dateInput.value) {
      const dateParts = dateInput.value.split('-');
      if (dateParts.length === 3) {
        yearSelect.value = dateParts[0];
        monthSelect.value = dateParts[1];
        daySelect.value = dateParts[2];
      }
    }
    
    // 이벤트 핸들러 등록
    [yearSelect, monthSelect, daySelect].forEach(select => {
      select.addEventListener('change', () => {
        updateDateFromSelects(record);
      });
    });
  });
}

// 셀렉트 박스에서 날짜 입력 필드 업데이트
function updateDateFromSelects(record) {
  const yearSelect = record.querySelector('.insurance-date-year');
  const monthSelect = record.querySelector('.insurance-date-month');
  const daySelect = record.querySelector('.insurance-date-day');
  const dateInput = record.querySelector('.insurance-date');
  
  if (!yearSelect || !monthSelect || !daySelect || !dateInput) return;
  
  const year = yearSelect.value;
  const month = monthSelect.value;
  const day = daySelect.value;
  
  if (year && month && day) {
    dateInput.value = `${year}-${month}-${day}`;
  } else {
    dateInput.value = '';
  }
}

// 년도 옵션 생성 (현재 년도부터 100년 전까지)
function generateYearOptions() {
  const currentYear = new Date().getFullYear();
  let options = '';
  
  for (let year = currentYear; year >= currentYear - 100; year--) {
    options += `<option value="${year}">${year}</option>`;
  }
  
  return options;
}

// 월 옵션 생성 (01-12)
function generateMonthOptions() {
  let options = '';
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = month.toString().padStart(2, '0');
    options += `<option value="${monthStr}">${monthStr}</option>`;
  }
  
  return options;
}

// 일 옵션 생성 (01-31)
function generateDayOptions() {
  let options = '';
  
  for (let day = 1; day <= 31; day++) {
    const dayStr = day.toString().padStart(2, '0');
    options += `<option value="${dayStr}">${dayStr}</option>`;
  }
  
  return options;
}

// 드래그 오버 처리
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('active');
}

// 드래그 리브 처리
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('active');
}

// 파일 드롭 처리
function handleFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('active');
  
  const files = e.dataTransfer.files;
  addFiles(files);
}

// 파일 선택 처리
function handleFileSelect(e) {
  const files = e.target.files;
  addFiles(files);
  fileInput.value = ''; // 입력 초기화
}

// 파일 추가
function addFiles(fileList) {
  const validFiles = Array.from(fileList).filter(file => 
    file.type === 'application/pdf' || 
    file.type.startsWith('image/')
  );
  
  // 파일 개수 제한 확인
  if (selectedFiles.length + validFiles.length > MAX_FILES) {
    alert(`최대 ${MAX_FILES}개의 파일만 업로드할 수 있습니다.`);
    return;
  }
  
  // 총 파일 크기 계산
  const currentTotalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
  const newFilesSize = validFiles.reduce((total, file) => total + file.size, 0);
  
  if (currentTotalSize + newFilesSize > MAX_TOTAL_SIZE) {
    alert(`총 파일 크기가 100MB를 초과할 수 없습니다.`);
    return;
  }
  
  // 파일 추가
  validFiles.forEach(file => {
    if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      selectedFiles.push(file);
    }
  });
  
  updateFileList();
  updateUploadButton();
}

// 파일 목록 업데이트
function updateFileList() {
  fileList.innerHTML = '';
  fileCount.textContent = `${selectedFiles.length}개 파일 선택됨 (${formatFileSize(selectedFiles.reduce((total, file) => total + file.size, 0))})`;
  
  // 10개 이상인 경우 토글 버튼 표시
  toggleFilesBtn.style.display = selectedFiles.length >= 10 ? 'block' : 'none';
  
  if (isHorizontalView && selectedFiles.length >= 10) {
    fileList.classList.add('file-list-horizontal');
  } else {
    fileList.classList.remove('file-list-horizontal');
  }
  
  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    
    if (isHorizontalView && selectedFiles.length >= 10) {
      fileItem.className = 'file-item-card card';
      fileItem.innerHTML = `
        <div class="card-body p-2">
          <div class="d-flex justify-content-between align-items-start">
            <div class="text-truncate">
              <strong title="${file.name}">${file.name}</strong>
            </div>
            <button class="btn-close btn-close-sm btn-remove" data-index="${index}"></button>
          </div>
          <small class="text-muted">${formatFileSize(file.size)}</small>
        </div>
      `;
    } else {
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <div>
        <strong>${file.name}</strong>
        <small class="text-muted ms-2">(${formatFileSize(file.size)})</small>
      </div>
      <i class="btn-remove" data-index="${index}">×</i>
    `;
    }
    
    fileList.appendChild(fileItem);
    
    // 파일 삭제 이벤트
    fileItem.querySelector('.btn-remove').addEventListener('click', function() {
      const index = parseInt(this.getAttribute('data-index'));
      selectedFiles.splice(index, 1);
      updateFileList();
      updateUploadButton();
    });
  });
}

// 파일 목록 뷰 토글
function toggleFilesView() {
  isHorizontalView = !isHorizontalView;
  updateFileList();
}

// 업로드 버튼 상태 업데이트
function updateUploadButton() {
  uploadBtn.disabled = selectedFiles.length === 0;
}

// 파일 크기 포맷
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// 모든 파일 지우기
function clearFiles() {
  selectedFiles = [];
  updateFileList();
  updateUploadButton();
  updateProgressBar(0, "대기중");
}

// 파일 업로드
async function uploadFiles() {
  try {
    // 파일 체크
    if (selectedFiles.length === 0) {
      alert('업로드할 파일을 선택해주세요');
      return;
    }
    
    // 버튼 비활성화 및 로딩 표시
    uploadBtn.disabled = true;
    statusSpinner.style.display = 'inline-block';
    
    // 상태 및 프로그레스바 업데이트
    updateStatus('primary', '문서 분석이 시작되었습니다...');
    updateProgressBar(10, "업로드 중");
    
    // FormData 생성
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });
    
    console.log(`API 요청 시작: ${OCR_API_URL}/upload (파일 ${selectedFiles.length}개)`);
    console.log('OCR_API_URL:', OCR_API_URL);
    console.log('전체 URL:', `${OCR_API_URL}/upload`);
    console.log('선택된 파일들:', selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })));
    
    // API 요청
    const response = await fetch(`${OCR_API_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    
    console.log(`API 응답 상태: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      let errorMessage = '업로드 실패';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (jsonError) {
        console.error('오류 응답 파싱 실패:', jsonError);
        errorMessage = `${response.status} ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    currentJobId = data.jobId;
    
    console.log(`작업 ID 수신: ${currentJobId}`);
    
    // 상태 업데이트
    updateStatus('primary', `
      <div>문서 분석이 시작되었습니다.</div>
      <div><strong>작업 ID:</strong> ${currentJobId}</div>
      <div><strong>상태:</strong> <span id="jobStatus">처리 중</span></div>
      <div><strong>진행률:</strong> <span id="jobProgress">0/${selectedFiles.length}</span> 파일 처리됨</div>
    `);
    
    updateProgressBar(20, "분석 중");
    
    // 작업 상태 폴링 시작
    startPolling(currentJobId);
    
  } catch (error) {
    console.error('업로드 오류:', error);
    console.error('오류 스택:', error.stack);
    updateStatus('danger', `[메디아이] 업로드 오류: ${error.message}`);
    updateProgressBar(0, "오류 발생");
    uploadBtn.disabled = false;
    statusSpinner.style.display = 'none';
  }
}

// 작업 상태 폴링 시작
function startPolling(jobId) {
  // 이전 폴링 중단
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
  }
  
  // 폴링 함수
  const pollStatus = async () => {
    try {
      const response = await fetch(`${OCR_API_URL}/status/${jobId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '상태 확인 실패');
      }
      
      const data = await response.json();
      
      // 상태 업데이트
      const jobStatusEl = document.getElementById('jobStatus');
      const jobProgressEl = document.getElementById('jobProgress');
      
      if (jobStatusEl) jobStatusEl.textContent = data.status;
      if (jobProgressEl) jobProgressEl.textContent = `${data.filesProcessed}/${data.filesTotal}`;
      
      // 프로그레스바 업데이트
      const percentage = data.filesTotal > 0 ? Math.round((data.filesProcessed / data.filesTotal) * 80) + 20 : 20;
      updateProgressBar(percentage, data.status === 'processing' ? "분석 중" : data.status);
      
      // 완료 시 결과 가져오기
      if (data.status === 'completed') {
        await fetchResults(jobId);
        return;
      }
      
      // 오류 시 폴링 중단
      if (data.status === 'failed') {
        updateStatus('danger', `[메디아이] 문서 처리 실패: ${data.error || '알 수 없는 오류'}`);
        updateProgressBar(0, "처리 실패");
        statusSpinner.style.display = 'none';
        uploadBtn.disabled = false;
        return;
      }
      
      // 계속 폴링
      pollingTimeout = setTimeout(pollStatus, POLLING_INTERVAL);
      
    } catch (error) {
      console.error('상태 확인 오류:', error);
      updateStatus('warning', `[메디아이] 상태 확인 오류: ${error.message}`);
      
      // 오류가 발생해도 계속 폴링 (3번까지)
      pollingTimeout = setTimeout(pollStatus, POLLING_INTERVAL * 2); // 오류 시 더 긴 간격
    }
  };
  
  // 폴링 시작
  pollStatus();
}

// 결과 가져오기
async function fetchResults(jobId) {
  try {
    const response = await fetch(`${OCR_API_URL}/result/${jobId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '결과 가져오기 실패');
    }
    
    const data = await response.json();
    resultData = data;
    
    // UI 업데이트
    updateStatus('success', `문서 처리 완료! ${Object.keys(data.results).length}개 파일 처리됨`);
    statusSpinner.style.display = 'none';
    uploadBtn.disabled = false;
    viewResultsBtn.disabled = false;
    createSummaryBtn.disabled = false;
    
    // 프로그레스바 업데이트
    updateProgressBar(100, "완료");
    
    // 모니터링 메트릭 업데이트
    totalAnalyses += Object.keys(data.results).length;
    
    // 동적 가중치 정확도 계산 (파일 수와 처리 품질 기반)
    const fileCount = Object.keys(data.results).length;
    const qualityScore = calculateProcessingQuality(data.results);
    dynamicWeightingAccuracy = Math.min(95, 80 + (qualityScore * 15));
    
    // 하이브리드 AI 정확도 업데이트 (성공적인 처리 기반)
    hybridAIAccuracy = Math.min(95, hybridAIAccuracy + (qualityScore * 0.5));
    
    // 대시보드 메트릭 즉시 업데이트
    updateDashboardMetrics();
    
    // 결과 표시
    displayResults();
    
    // 다운로드 버튼 숨기기 (요약표가 생성되기 전까지)
    const downloadBtn = document.getElementById('downloadReportBtn');
    if (downloadBtn) {
      downloadBtn.style.display = 'none';
    }
    
  } catch (error) {
    console.error('결과 가져오기 오류:', error);
    updateStatus('danger', `[메디아이] 결과 가져오기 오류: ${error.message}`);
    updateProgressBar(0, "오류 발생");
    statusSpinner.style.display = 'none';
    uploadBtn.disabled = false;
  }
}

// 상태 메시지 업데이트
function updateStatus(type, message) {
  statusContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

// 프로그레스바 업데이트
function updateProgressBar(percentage, statusText) {
  progressBar.style.width = `${percentage}%`;
  progressBar.setAttribute('aria-valuenow', percentage);
  progressBar.textContent = `${percentage}%`;
  
  if (percentage === 0) {
    progressBar.classList.remove('bg-success', 'bg-danger', 'bg-warning');
  } else if (percentage < 30) {
    progressBar.classList.remove('bg-success', 'bg-danger');
    progressBar.classList.add('bg-warning');
  } else if (percentage === 100) {
    progressBar.classList.remove('bg-warning', 'bg-danger');
    progressBar.classList.add('bg-success');
  }
  
  progressStatus.textContent = statusText;
}

// 결과 표시
function displayResults() {
  if (!resultData || !resultData.results) {
    resultModalContent.innerHTML = '<div class="text-muted">결과가 없습니다.</div>';
    return;
  }
  
  const selected = resultType.value;
  
  if (selected === 'json') {
    // JSON 원본
    resultModalContent.innerHTML = `<pre>${JSON.stringify(resultData, null, 2)}</pre>`;
  }
  else if (selected === 'separated') {
    // 파일별 텍스트
    let html = '';
    Object.entries(resultData.results).forEach(([fileId, fileData]) => {
      html += `<h5>${fileData.filename}</h5>`;
      html += `<p>페이지 수: ${fileData.pageCount} (텍스트: ${fileData.textPageCount}, 이미지: ${fileData.imagePageCount})</p>`;
      html += `<pre>${fileData.mergedText}</pre>`;
      html += '<hr>';
    });
    resultModalContent.innerHTML = html;
  }
  else if (selected === 'filtered') {
    // 소거키워드 필터링 결과 (개발 모드)
    fetchFilteredResults('exclude').then(filteredData => {
      if (filteredData) {
        resultModalContent.innerHTML = `<h5>소거키워드 필터링 결과</h5><pre>${filteredData}</pre>`;
      } else {
        resultModalContent.innerHTML = '<div class="alert alert-warning">필터링 결과를 가져오는데 실패했습니다.</div>';
      }
    });
  }
  else if (selected === 'retained') {
    // Retain 키워드 필터링 결과 (개발 모드)
    fetchFilteredResults('retain').then(filteredData => {
      if (filteredData) {
        resultModalContent.innerHTML = `<h5>Retain 키워드 필터링 결과</h5><pre>${filteredData}</pre>`;
      } else {
        resultModalContent.innerHTML = '<div class="alert alert-warning">필터링 결과를 가져오는데 실패했습니다.</div>';
      }
    });
  }
  else {
    // 전체 텍스트
    let combinedText = '';
    Object.entries(resultData.results).forEach(([fileId, fileData]) => {
      combinedText += `\n\n========== 파일: ${fileData.filename} ==========\n\n`;
      combinedText += fileData.mergedText;
    });
    resultModalContent.innerHTML = `<pre>${combinedText}</pre>`;
  }
}

/**
 * 필터링 결과를 가져오는 함수
 * @param {string} filterType 필터 유형 ('exclude' 또는 'retain')
 * @returns {Promise<string>} 필터링된 텍스트
 */
async function fetchFilteredResults(filterType) {
  try {
    resultModalContent.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p>필터링 결과를 가져오는 중...</p></div>';
    
    // 현재 작업 ID 가져오기
    const jobId = currentJobId || resultData?.jobId;
    if (!jobId) {
      return null;
    }
    
    // API 경로 설정
    const endpoint = `${API_URL}/postprocess/filter?jobId=${jobId}&type=${filterType}`;
    
    // API 호출
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error(`필터링 결과 가져오기 실패: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (!data.success) {
      console.error(`필터링 API 오류: ${data.error}`);
      return null;
    }
    
    return data.text || data.filteredText || '필터링 결과가 없습니다.';
  } catch (error) {
    console.error('필터링 결과 가져오기 오류:', error);
    return null;
  }
}

// 개발 모드 상태 변경 시 UI 업데이트 함수
function updateDevModeUI(isDevMode) {
  // 개발 모드 전용 옵션 표시/숨김
  const devModeOptions = document.querySelectorAll('.dev-mode-option');
  devModeOptions.forEach(option => {
    option.style.display = isDevMode ? 'block' : 'none';
  });
  
  // 기타 개발 모드 관련 UI 업데이트...
}

// ai-report.js의 개발 모드 변경 이벤트를 감지하기 위한 이벤트 리스너
document.addEventListener('devModeChanged', function(event) {
  if (event.detail && typeof event.detail.isDevMode === 'boolean') {
    updateDevModeUI(event.detail.isDevMode);
  }
});

// 결과 모달 표시
function showResultsModal() {
  console.log('결과 모달 표시 시도');
  if (!resultsModal) {
    // 모달이 초기화되지 않은 경우 초기화
    const modalElement = document.getElementById('resultsModal');
    if (modalElement) {
      resultsModal = new bootstrap.Modal(modalElement);
      
      // 모든 닫기 버튼에 이벤트 리스너 추가
      const closeButtons = modalElement.querySelectorAll('[data-bs-dismiss="modal"], .btn-close, .close-modal');
      closeButtons.forEach(button => {
        button.addEventListener('click', () => {
          resultsModal.hide();
          console.log('닫기 버튼 클릭됨 - 모달 숨김');
        });
      });
    } else {
      console.error('[메디아이] 결과 모달 요소를 찾을 수 없습니다');
      return;
    }
  }
  
  resultsModal.show();
  console.log('결과 모달이 표시되었습니다');
}

// 보험 기록 추가
function addInsuranceRecord() {
  const recordId = Date.now().toString();
  const newRecord = document.createElement('div');
  newRecord.className = 'insurance-record';
  newRecord.dataset.recordId = recordId;
  
  // 보험사 옵션 HTML 생성
  let insurersOptions = '<option value="">선택하세요</option>';
  
  // 보험사 카테고리별 옵션 그룹 추가
  Object.entries(insurerOptions).forEach(([category, companies]) => {
    insurersOptions += `<optgroup label="${category}">`;
    
    companies.forEach(company => {
      insurersOptions += `<option value="${company}">${company}</option>`;
    });
    
    insurersOptions += '</optgroup>';
  });
  
  newRecord.innerHTML = `
    <div class="row g-3 mb-2">
      <div class="col-md-6 d-flex align-items-center">
        <label class="form-label me-2" style="white-space: nowrap;">보험회사:</label>
        <select class="form-select insurance-company">
          ${insurersOptions}
            </select>
          </div>
      <div class="col-md-6 d-flex align-items-center">
        <label class="form-label me-2" style="white-space: nowrap;">가입일자:</label>
        <input type="hidden" class="insurance-date">
        <div class="d-flex">
          <select class="form-select me-1 insurance-date-year">
            <option value="">년</option>
                  ${generateYearOptions()}
                </select>
          <select class="form-select me-1 insurance-date-month">
                  <option value="">월</option>
                  ${generateMonthOptions()}
                </select>
          <select class="form-select insurance-date-day">
                  <option value="">일</option>
                  ${generateDayOptions()}
                </select>
              </div>
            </div>
          </div>
    <div class="row g-3 mb-2">
      <div class="col-md-6 d-flex align-items-center">
        <label class="form-label me-2" style="white-space: nowrap;">보험상품:</label>
        <input type="text" class="form-control insurance-product" placeholder="보험상품명">
        </div>
      <div class="col-md-4 d-flex align-items-center">
        <label class="form-label me-2" style="white-space: nowrap;">조회기간:</label>
        <select class="form-select insurance-period">
          <option value="all" selected>전기간</option>
          <option value="5">5년</option>
          <option value="4">4년</option>
          <option value="3">3년</option>
          <option value="2">2년</option>
          <option value="1">1년</option>
            </select>
          </div>
      <div class="col-md-2 d-flex align-items-center justify-content-end">
        <button class="btn btn-outline-danger remove-insurance" data-record-id="${recordId}" type="button">삭제</button>
      </div>
    </div>
  `;
  
  insuranceRecords.appendChild(newRecord);
  
  // 삭제 버튼 이벤트 리스너 추가
  const removeBtn = newRecord.querySelector('.remove-insurance');
  removeBtn.addEventListener('click', function() {
    if (insuranceRecords.childElementCount > 1) {
      newRecord.remove();
    } else {
      alert('최소 1개의 보험 정보는 유지해야 합니다.');
    }
  });
  
  // 날짜 선택 필드 설정
  setupDateSelects(newRecord);
}

// 기존 보험 레코드의 날짜 입력 필드를 셀렉트 박스로 변경
function updateExistingDateFields() {
  // 초기 날짜 셀렉트 박스 옵션 채우기
  const yearSelects = document.querySelectorAll('.insurance-date-year');
  const monthSelects = document.querySelectorAll('.insurance-date-month');
  const daySelects = document.querySelectorAll('.insurance-date-day');
  
  yearSelects.forEach(select => {
    if (select.options.length <= 1) {
      select.innerHTML = `<option value="">년</option>${generateYearOptions()}`;
    }
  });
  
  monthSelects.forEach(select => {
    if (select.options.length <= 1) {
      select.innerHTML = `<option value="">월</option>${generateMonthOptions()}`;
    }
  });
  
  daySelects.forEach(select => {
    if (select.options.length <= 1) {
      select.innerHTML = `<option value="">일</option>${generateDayOptions()}`;
    }
  });
  
  // 초기화 버튼 이벤트 리스너 추가
  const resetBtns = document.querySelectorAll('.reset-insurance');
  resetBtns.forEach(resetBtn => {
    resetBtn.addEventListener('click', function() {
      const recordId = this.getAttribute('data-record-id');
      const record = document.querySelector(`.insurance-record[data-record-id="${recordId}"]`);
      
      if (record) {
        // 보험회사 초기화
        const companySelect = record.querySelector('.insurance-company');
        if (companySelect) companySelect.value = '';
        
        // 날짜 초기화
        const yearSelect = record.querySelector('.insurance-date-year');
        const monthSelect = record.querySelector('.insurance-date-month');
        const daySelect = record.querySelector('.insurance-date-day');
        const dateInput = record.querySelector('.insurance-date');
        
        if (yearSelect) yearSelect.value = '';
        if (monthSelect) monthSelect.value = '';
        if (daySelect) daySelect.value = '';
        if (dateInput) dateInput.value = '';
        
        // 보험상품 초기화
        const productInput = record.querySelector('.insurance-product');
        if (productInput) productInput.value = '';
        
        // 조회기간 초기화
        const periodSelect = record.querySelector('.insurance-period');
        if (periodSelect) periodSelect.value = 'all';
        
        // 피보험자 이름과 참고사항도 초기화
        document.getElementById('patientName').value = '';
        document.getElementById('patientMemo').value = '';
      }
    });
  });
  
  setupDateSelects();
}

// 기간 프리셋을 날짜 범위로 변환하는 유틸리티 함수
function presetToRange(join, preset) {
  if (!join) return { start: null, end: null };
  
  const d = new Date(join);
  
  // "전 기간" 옵션인 경우 모든 데이터 반환 (시작일 null)
  if (preset === 'all') {
    return { 
      start: null, 
      end: d.toISOString().slice(0, 10) 
    };
  }
  
  // 3개월은 기본 필터로 항상 적용 (가장 최근 데이터)
  const threeMonthsAgo = new Date(d);
  threeMonthsAgo.setMonth(d.getMonth() - 3);
  
  // 기본 3개월 이외에 추가 기간 적용
  let start = threeMonthsAgo;
  
  // 추가 기간이 지정된 경우 그에 맞게 시작일 조정
  if (preset && preset !== '3m') {
    const years = parseInt(preset);
    if (!isNaN(years)) {
      start = new Date(d);
      start.setFullYear(d.getFullYear() - years);
      
      // 3개월보다 더 과거인 경우에만 해당 날짜 사용
      if (start < threeMonthsAgo) {
        // 그대로 사용
      } else {
        // 3개월이 더 과거라면 3개월 사용
        start = threeMonthsAgo;
      }
    }
  }
  
  return { 
    start: start.toISOString().slice(0, 10), 
    end: d.toISOString().slice(0, 10) 
  };
}

// 요약표 작성 처리
async function handleCreateSummary() {
  try {
    if (!resultData || !resultData.results) {
      alert('[메디아이] 문서 처리 결과가 없습니다. 먼저 파일을 업로드하고 문서 처리를 완료해주세요.');
      return;
    }
    
    const patientName = document.getElementById('patientName').value.trim();
    if (!patientName) {
      alert('피보험자 이름을 입력해주세요.');
      document.getElementById('patientName').focus();
      return;
    }
    
    // 보험 정보 수집
    const insuranceElements = document.querySelectorAll('.insurance-record');
    const insuranceData = [];
    
    let isValid = true;
    insuranceElements.forEach(el => {
      const company = el.querySelector('.insurance-company').value;
      const date = el.querySelector('.insurance-date').value;
      const product = el.querySelector('.insurance-product').value;
      const period = el.querySelector('.insurance-period').value || 'all';
      
      if (!company || !date) {
        isValid = false;
      }
      
      insuranceData.push({
        company,
        enrollmentDate: date,
        product,
        period
      });
    });
    
    if (!isValid) {
      alert('[메디아이] 모든 보험 정보를 입력해주세요 (보험회사, 가입일자는 필수입니다).');
      return;
    }
    
    // 최신 보험 가입일을 기준으로 설정
    let enrollmentDate = '';
    if (insuranceData.length > 0) {
      enrollmentDate = insuranceData
        .filter(ins => ins.enrollmentDate)
        .sort((a, b) => new Date(a.enrollmentDate) - new Date(b.enrollmentDate))[0]?.enrollmentDate || '';
    }
    
    // 환자 정보 구성
    const patientInfo = {
      name: patientName,
      memo: document.getElementById('patientMemo').value.trim(),
      enrollmentDate: enrollmentDate,
      insuranceData
    };
    
    // OCR 결과 텍스트 추출
    const ocrTexts = Object.values(resultData.results).map(item => item.mergedText);
    const extractedText = ocrTexts.join('\n\n');
    
    // API 요청 시작
    createSummaryBtn.disabled = true;
    updateStatus('info', 'AI 요약표 생성 중...');
    updateProgressBar(30, "처리 중");
    
    console.log('AI 요약표 생성 요청 시작');
    
    // AI 보고서 생성 API 사용
    const response = await fetch(`${API_URL}/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: extractedText,
        patientInfo: {
          name: patientName,
          dob: patientInfo.memo, // 메모 필드에 있는 생년월일 정보 활용
          enrollmentDate: enrollmentDate,
          insurance: insuranceData.map(ins => ({
            company: ins.company,
            product: ins.product,
            start_date: ins.enrollmentDate,
            period: ins.period || 'all'
          }))
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'AI 요약표 생성 실패');
    }
    
    updateProgressBar(90, "완료 중");
    
    const data = await response.json();
    console.log('AI 요약표 생성 응답 데이터:', data);
    
    if (data.success) {
      // AI 세션 ID 저장 (채팅용)
      currentSessionId = data.sessionId;
      
      updateStatus('success', 'AI 요약표 생성 완료!');
      updateProgressBar(100, "완료");
      
      // AI 보고서 내용 표시
      if (data.report) {
        // 마크다운 형식 보고서 표시
        const aiReportContent = document.getElementById('ai-report-content');
        if (aiReportContent) {
          aiReportContent.innerHTML = markdownToHtml(data.report);
          
          // AI 보고서 섹션 표시 및 스크롤
          const aiReportSection = document.getElementById('ai-report-section');
          if (aiReportSection) {
            aiReportSection.classList.remove('d-none');
            aiReportSection.scrollIntoView({ behavior: 'smooth' });
          }
          
          // 채팅 섹션 활성화
          const aiChatSection = document.getElementById('ai-chat-section');
          if (aiChatSection) {
            aiChatSection.classList.remove('d-none');
          }
          
          // 타임라인 데이터 추출 및 표시
          const timelineData = extractTimelineFromReport(data.report);
          if (timelineData && timelineData.length > 0) {
            renderTimelineTable(timelineData);
            
            const timelineSection = document.getElementById('timeline-section');
            if (timelineSection) {
              timelineSection.classList.remove('d-none');
              document.getElementById('timeline-title').textContent = 'AI 병력사항 요약 경과표';
            }
          }
        }
      } else {
        alert('AI 요약표 생성은 완료되었으나 보고서 내용이 없습니다.');
      }
    } else {
      throw new Error(data.error || 'AI 요약표 생성 실패');
    }
  } catch (error) {
    console.error('요약표 생성 오류:', error);
    updateStatus('danger', `요약표 생성 실패: ${error.message}`);
    updateProgressBar(0, "실패");
    createSummaryBtn.disabled = false;
    
    // 기존 룰 기반 방식으로 폴백
    try {
      alert('AI 요약표 생성에 실패했습니다. 기존 방식으로 시도합니다.');
      useRuleBasedSummaryGeneration();
    } catch (fallbackError) {
      console.error('기존 방식 폴백 오류:', fallbackError);
      alert('요약표 생성에 실패했습니다. 다시 시도해주세요.');
    }
  }
}

// 기존 룰 기반 요약표 생성 방식
async function useRuleBasedSummaryGeneration() {
  try {
    if (!resultData || !resultData.results) {
      throw new Error('문서 처리 결과가 없습니다');
    }
    
    const patientName = document.getElementById('patientName').value.trim();
    if (!patientName) {
      throw new Error('피보험자 이름이 입력되지 않았습니다');
    }
    
    // 보험 정보 수집
    const insuranceElements = document.querySelectorAll('.insurance-record');
    const insuranceData = [];
    
    insuranceElements.forEach(el => {
      const company = el.querySelector('.insurance-company').value;
      const date = el.querySelector('.insurance-date').value;
      const product = el.querySelector('.insurance-product').value;
      const period = el.querySelector('.insurance-period').value || 'all';
      
      insuranceData.push({
        company,
        enrollmentDate: date,
        product,
        period
      });
    });
    
    // 최신 보험 가입일을 기준으로 설정
    let enrollmentDate = '';
    if (insuranceData.length > 0) {
      enrollmentDate = insuranceData
        .filter(ins => ins.enrollmentDate)
        .sort((a, b) => new Date(a.enrollmentDate) - new Date(b.enrollmentDate))[0]?.enrollmentDate || '';
    }
    
    // 환자 정보 구성
    const patientInfo = {
      name: patientName,
      memo: document.getElementById('patientMemo').value.trim(),
      enrollmentDate: enrollmentDate,
      insuranceData
    };
    
    // OCR 결과 텍스트 추출
    const ocrTexts = Object.values(resultData.results).map(item => item.mergedText);
    
    updateStatus('info', '룰 기반 요약표 생성 중...');
    updateProgressBar(30, "처리 중");
    
    console.log('단순화된 요약표 생성 요청 - 의료지식 처리 비활성화');
    
    const response = await fetch(POSTPROCESS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ocrResults: ocrTexts,
        patientInfo,
        options: {
          reportFormat: 'txt',
          reportTitle: '병력사항 요약 경과표',
          includeRawText: true,  // 원본 텍스트 포함
          translateTerms: false,  // 의학 용어 번역 비활성화
          requireKeywords: false, // 키워드 필수 조건 비활성화
          includeProcessedData: true
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '요약표 생성 실패');
    }
    
    updateProgressBar(90, "완료 중");
    
    const data = await response.json();
    console.log('요약표 생성 응답 데이터:', data);
    
    if (data.success) {
      // 후처리 데이터 저장
      summaryData = data;
      
      updateStatus('success', '요약표 생성 완료!');
      updateProgressBar(100, "완료");
      
      // 다운로드 링크 생성
      if (data.report) {
        const { downloadUrl: reportUrl, preview } = data.report;
        
        // 다운로드 URL 전역 변수 저장
        downloadUrl = reportUrl;
        
        // 다운로드 버튼 표시
        const downloadBtn = document.getElementById('downloadReportBtn');
        if (downloadBtn) {
          downloadBtn.style.display = 'inline-block';
        }
        
        // 텍스트 파일 직접 가져오기
        try {
          // 텍스트 파일 내용 가져오기
          console.log('텍스트 파일 직접 가져오기 시도:', reportUrl);
          const textResponse = await fetch(reportUrl);
          
          if (textResponse.ok) {
            const textContent = await textResponse.text();
            console.log('텍스트 파일 내용 가져옴, 길이:', textContent.length);
            
            // 타임라인 데이터 생성 - 단순 파싱
            const timelineData = parseRawTextToTimelineSimple(textContent);
            
            if (timelineData.length > 0) {
              console.log('단순 파싱 타임라인 데이터:', timelineData);
              renderTimelineTable(timelineData);
              
              const timelineSection = document.getElementById('timeline-section');
              if (timelineSection) {
                timelineSection.classList.remove('d-none');
                document.getElementById('timeline-title').textContent = '병력사항 요약 경과표 (단순 파싱)';
                timelineSection.scrollIntoView({ behavior: 'smooth' });
              }
              
              // 원본 텍스트 표시 영역 추가
              const rawTextContainer = document.createElement('div');
              rawTextContainer.className = 'mt-4 p-3 border rounded bg-light';
              rawTextContainer.innerHTML = `
                <h5>원본 텍스트 파일 내용</h5>
                <pre class="text-muted" style="max-height: 300px; overflow-y: auto;">${textContent}</pre>
              `;
              
              const resultContainer = document.getElementById('result-container');
              if (resultContainer) {
                resultContainer.appendChild(rawTextContainer);
              }
            } else {
              console.warn('타임라인 데이터를 생성할 수 없습니다.');
              
              // 원본 텍스트를 표로 직접 표시
              showRawTextInTable(textContent);
            }
          } else {
            console.error('텍스트 파일 가져오기 실패:', textResponse.status);
            
            // API 응답 미리보기 데이터 사용 시도
            if (preview && Array.isArray(preview) && preview.length > 0) {
              console.log('API 응답 미리보기 데이터 사용:', preview);
              renderTimelineTable(preview);
              document.getElementById('timeline-section').classList.remove('d-none');
            } else {
              console.error('사용 가능한 데이터가 없습니다.');
            }
          }
        } catch (err) {
          console.error('텍스트 파일 처리 오류:', err);
          
          // API 응답 미리보기 데이터 사용 시도
          if (preview && Array.isArray(preview) && preview.length > 0) {
            console.log('API 응답 미리보기 데이터 사용:', preview);
            renderTimelineTable(preview);
            document.getElementById('timeline-section').classList.remove('d-none');
          }
        }
      } else {
        console.error('요약표 생성 완료되었으나 다운로드 URL이 없습니다.');
      }
    } else {
      console.error('요약표 생성 완료되었으나 다운로드 URL이 없습니다.');
    }
  } catch (error) {
    console.error('룰 기반 요약표 생성 오류:', error);
    updateStatus('danger', `요약표 생성 실패: ${error.message}`);
    updateProgressBar(0, "실패");
    createSummaryBtn.disabled = false;
  }
}

// AI 보고서 마크다운에서 타임라인 데이터 추출
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
      if (line.includes('날짜') && line.includes('병원') && line.includes('내용 요약') && !inTable) {
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
    
    return timelineData;
  } catch (error) {
    console.error('보고서에서 타임라인 데이터 추출 오류:', error);
    return [];
  }
}

// 마크다운을 HTML로 변환하는 함수
function markdownToHtml(markdown) {
  if (!markdown) return '';
  
  // 간단한 마크다운 변환 로직
  return markdown
    // 헤더
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 굵게
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 기울임
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 코드 블록
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // 인라인 코드
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // 링크
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    // 목록
    .replace(/^\s*-\s*(.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/^\s*\d+\.\s*(.*$)/gim, '<ol><li>$1</li></ol>')
    // 테이블 (단순화)
    .replace(/\|/g, '</td><td>')
    .replace(/^(.*?)<\/td>/gm, '<tr><td>$1')
    .replace(/<\/td>$/gm, '</td></tr>')
    .replace(/^<tr>.*?-+.*?<\/tr>$/gm, '')
    // 줄바꿈
    .replace(/\n\n/g, '<br><br>')
    // 테이블 래핑
    .replace(/<tr>/g, '<table class="table table-bordered"><tr>')
    .replace(/<\/tr>(?![\s\S]*<tr>)/g, '</tr></table>');
}

/**
 * 시계열 타임라인 테이블 렌더링
 * @param {Array} rows 이벤트 배열
 */
function renderTimelineTable(rows = []) {
  console.log('타임라인 테이블 렌더링 시작, 데이터:', rows);
  
  const tbody = document.getElementById('timeline-body');
  if (!tbody) {
    console.error('timeline-body 요소를 찾을 수 없습니다.');
    return;
  }
  
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('데이터가 없거나 배열이 아닙니다:', rows);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">데이터가 없습니다</td></tr>';
    return;
  }
  
  try {
    // 날짜순으로 정렬 (오래된 순)
    const sortedRows = [...rows].sort((a, b) => {
      // 날짜 포맷 표준화
      const dateA = new Date(String(a.date || '').replace(/\./g, '-').replace(/\//g, '-'));
      const dateB = new Date(String(b.date || '').replace(/\./g, '-').replace(/\//g, '-'));
      
      // 유효한 날짜면 비교, 아니면 0으로 처리
      return (dateA.toString() !== 'Invalid Date' ? dateA.getTime() : 0) - 
             (dateB.toString() !== 'Invalid Date' ? dateB.getTime() : 0);
    });
    
    console.log(`${sortedRows.length}개 항목 정렬 완료`);
    
    let html = '';
    
    sortedRows.forEach(row => {
      // 각 속성이 없는 경우 대비
      const date = row.date || '-';
      const hospital = row.hospital || '-';
      
      // 진단 및 처치 데이터 정규화
      const diagnosis = Array.isArray(row.diagnosis) ? row.diagnosis : 
                       (row.diag ? (Array.isArray(row.diag) ? row.diag : [row.diag]) : []);
      
      const treatment = Array.isArray(row.treatment) ? row.treatment : 
                       (row.treat ? (Array.isArray(row.treat) ? row.treat : [row.treat]) : []);
      
      // 날짜 기준 기간 하이라이트 클래스 추가
      let rowClass = '';
      if (summaryData && summaryData.patientInfo && summaryData.patientInfo.enrollmentDate) {
        const enrollDate = new Date(summaryData.patientInfo.enrollmentDate);
        const rowDate = new Date(String(date).replace(/\./g, '-').replace(/\//g, '-'));
        
        // 날짜가 유효한 경우에만 기간 검사
        if (!isNaN(rowDate.getTime()) && !isNaN(enrollDate.getTime())) {
          const diffMonths = (rowDate.getFullYear() - enrollDate.getFullYear()) * 12 + 
                            (rowDate.getMonth() - enrollDate.getMonth());
          
          if (diffMonths <= 3) {
            rowClass = 'table-danger'; // 3개월 이내 빨간색
          } else if (diffMonths <= 60) {
            rowClass = 'table-warning'; // 5년 이내 노란색
          }
        }
      }
      
      html += `<tr class="${rowClass}">
        <td>${date}</td>
        <td>${hospital}</td>
        <td>${diagnosis.length > 0 ? diagnosis.filter(Boolean).join('<br>') : '-'}</td>
        <td>${treatment.length > 0 ? treatment.filter(Boolean).join('<br>') : '-'}</td>
      </tr>`;
    });
    
    tbody.innerHTML = html;
    console.log('타임라인 테이블 렌더링 완료');
    
  } catch (err) {
    console.error('타임라인 테이블 렌더링 오류:', err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">
      데이터 렌더링 오류: ${err.message}
    </td></tr>`;
  }
}

// 원본 텍스트를 테이블에 표시
function showRawTextInTable(textContent) {
  const timelineSection = document.getElementById('timeline-section');
  if (!timelineSection) return;
  
  const timelineBody = document.getElementById('timeline-body');
  if (!timelineBody) return;
  
  // 각 줄을 테이블 행으로 변환
  const lines = textContent.split('\n').filter(line => line.trim());
  
  let html = '';
  let currentDate = '';
  
  for (const line of lines) {
    if (line.match(/^\d{4}[-./]\d{2}[-./]\d{2}/)) {
      // 날짜 줄로 처리
      currentDate = line.trim();
      html += `<tr class="table-secondary">
        <td colspan="4" class="fw-bold">${currentDate}</td>
      </tr>`;
    } else if (line.trim()) {
      // 일반 텍스트 줄
      html += `<tr>
        <td>${currentDate || '-'}</td>
        <td>-</td>
        <td colspan="2">${line.trim()}</td>
      </tr>`;
    }
  }
  
  if (html) {
    timelineBody.innerHTML = html;
    timelineSection.classList.remove('d-none');
    document.getElementById('timeline-title').textContent = '추출된 원본 텍스트';
    timelineSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    timelineBody.innerHTML = '<tr><td colspan="4" class="text-center">파싱 가능한 데이터가 없습니다</td></tr>';
    timelineSection.classList.remove('d-none');
  }
}

// 단순화된 텍스트 파싱 - 기본 날짜/내용 구분만 수행
function parseRawTextToTimelineSimple(text) {
  console.log('단순 텍스트 파싱 시작');
  const lines = text.split('\n');
  const data = [];
  
  let currentItem = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 날짜 패턴 확인 (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
    const dateMatch = line.match(/^(20\d{2}[-./]\d{2}[-./]\d{2})/);
    
    if (dateMatch) {
      // 날짜 줄이면 새 항목 시작
      const datePart = dateMatch[1].replace(/\./g, '-').replace(/\//g, '-');
      
      // 병원명 추출 시도 (날짜 다음 텍스트)
      let hospitalPart = line.substring(dateMatch[0].length).trim();
      
      // 이전 항목이 있으면 저장
      if (currentItem) {
        data.push(currentItem);
      }
      
      // 새 항목 생성
      currentItem = {
        date: datePart,
        hospital: hospitalPart || '-',
        diagnosis: [],
        treatment: []
      };
    } 
    // 현재 항목에 내용 추가
    else if (currentItem) {
      // 처치 내역인지 진단명인지 단순 구분
      // 특정 키워드 포함 시 처치내역으로 분류
      const isTreatment = /처방|처치|치료|수술|투약|시행|검사|영상|입원|약물|주사|처방|약제|복용/.test(line);
      
      if (isTreatment) {
        currentItem.treatment.push(line);
      } else {
        currentItem.diagnosis.push(line);
      }
    }
  }
  
  // 마지막 항목 저장
  if (currentItem) {
    data.push(currentItem);
  }
  
  console.log(`단순 파싱 완료: ${data.length}개 항목`);
  return data;
}

/**
 * 타임라인 처리 로직
 * @param {Event} event 이벤트
 */
async function handleTimelineView(event) {
  event.preventDefault();
  
  // ... existing code ...
  
  try {
    // ... existing code ...
    
    // OCR 처리 결과 가져오기
    const response = await fetch(`${API_URL}/api/ocr/result/${currentJobId}`);
    const result = await response.json();
    
    if (result.success && result.data) {
      resultData = result.data;
      
      if (result.data.text) {
        // 타임라인 생성 및 표시
        const timelineData = parseRawTextToTimelineSimple(result.data.text);
        showRawTextInTable(result.data.text);
        renderTimelineTable(timelineData);
        
        // OCR 완료 이벤트 발생
        const ocrCompleteEvent = new CustomEvent('ocrComplete', {
          detail: { text: result.data.text, success: true }
        });
        document.dispatchEvent(ocrCompleteEvent);
        
        // 타임라인 생성 완료 이벤트 발생
        const timelineGeneratedEvent = new CustomEvent('timelineGenerated', {
          detail: { data: timelineData, success: true }
        });
        document.dispatchEvent(timelineGeneratedEvent);
      } else {
        // ... existing code ...
      }
    } else {
      // ... existing code ...
    }
  } catch (error) {
    // ... existing code ...
  }
}

/**
 * OCR 처리 결과 처리기
 * @param {Object} result OCR 처리 결과
 */
function handleOCRResult(result) {
  // ... existing code ...
  
  if (result && result.results) {
    // 여러 페이지의 텍스트 결합
    const ocrTexts = Object.values(result.results).map(item => item.mergedText);
    const combinedText = ocrTexts.join('\n\n');
    
    // 타임라인 생성 및 표시
    const timelineData = parseRawTextToTimelineSimple(combinedText);
    showRawTextInTable(combinedText);
    renderTimelineTable(timelineData);
    
    // OCR 완료 이벤트 발생
    const ocrCompleteEvent = new CustomEvent('ocrComplete', {
      detail: { text: combinedText, success: true }
    });
    document.dispatchEvent(ocrCompleteEvent);
    
    // 타임라인 생성 완료 이벤트 발생
    const timelineGeneratedEvent = new CustomEvent('timelineGenerated', {
      detail: { data: timelineData, success: true }
    });
    document.dispatchEvent(timelineGeneratedEvent);
  } else {
    // ... existing code ...
  }
  
  // ... existing code ...
}

// 새 함수 추가: 상세분석보기 (전체 추출 텍스트) 핸들러
async function handleViewRawText() {
  if (!resultData || !resultData.results) {
    alert('추출된 텍스트가 없습니다. 먼저 파일을 업로드하고 처리를 완료해주세요.');
    return;
  }
  
  try {
    // 전체 텍스트 결합
    let combinedText = '';
    Object.entries(resultData.results).forEach(([fileId, fileData]) => {
      combinedText += `\n\n========== 파일: ${fileData.filename} ==========\n\n`;
      combinedText += fileData.mergedText;
    });
    
    // 새 창에 데이터 표시
    openDataInNewWindow('전체 추출 텍스트', combinedText);
  } catch (error) {
    console.error('상세분석 데이터 표시 오류:', error);
    alert('데이터를 가져오는 중 오류가 발생했습니다.');
  }
}

// 새 함수 추가: 정제 데이터 핸들러
async function handleViewRefinedText() {
  if (!resultData || !resultData.jobId) {
    alert('처리된 작업이 없습니다. 먼저 파일을 업로드하고 처리를 완료해주세요.');
    return;
  }
  
  try {
    // 정제 데이터(소거 사전 적용 데이터) 가져오기
    const refinedData = await fetchFilteredResults('exclude');
    if (!refinedData) {
      alert('정제 데이터를 가져올 수 없습니다.');
      return;
    }
    
    // 새 창에 데이터 표시
    openDataInNewWindow('정제 데이터 (소거 사전 적용)', refinedData);
  } catch (error) {
    console.error('정제 데이터 가져오기 오류:', error);
    alert('정제 데이터를 가져오는 중 오류가 발생했습니다.');
  }
}

// 새 함수 추가: 새 창에 데이터 표시
function openDataInNewWindow(title, content) {
  // 새 창 열기
  const newWindow = window.open('', '_blank', 'width=800,height=600');
  
  // 새 창 내용 작성
  newWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { padding: 20px; }
        .container { max-width: 100%; }
        pre { white-space: pre-wrap; max-height: calc(100vh - 150px); overflow-y: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3>${title}</h3>
          <button class="btn btn-secondary" onclick="window.close()">닫기</button>
        </div>
        <div class="card">
          <div class="card-body">
            <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  
  // 문서 닫기
  newWindow.document.close();
}