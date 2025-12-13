(function () {
  'use strict';

  // 네임스페이스를 통한 안전한 변수 관리
  if (!window.VNEXSUSApp) {
    window.VNEXSUSApp = {};
  }

  // DOM 요소를 네임스페이스에 저장
  window.VNEXSUSApp.elements = {};

  // DOM 요소 초기화 함수
  function initDOMElements() {
    const elements = window.VNEXSUSApp.elements;
    elements.dropZone = document.getElementById('dropZone');
    elements.fileInput = document.getElementById('fileInput');
    elements.fileList = document.getElementById('fileList');
    elements.fileCount = document.getElementById('fileCount');
    elements.toggleFilesBtn = document.getElementById('toggleFilesBtn');
    elements.clearBtn = document.getElementById('clearBtn');
    elements.uploadBtn = document.getElementById('uploadBtn');
    elements.statusContainer = document.getElementById('statusContainer');
    elements.statusSpinner = document.getElementById('statusSpinner');
    elements.resultType = document.getElementById('resultType');
    elements.viewResultsBtn = document.getElementById('viewResultsBtn');
    elements.resultModalContent = document.getElementById('resultModalContent');
    elements.addInsuranceBtn = document.getElementById('addInsuranceBtn');
    elements.insuranceRecords = document.getElementById('insuranceRecords');
    elements.createSummaryBtn = document.getElementById('createSummaryBtn');
    elements.progressBar = document.getElementById('progressBar');
    elements.progressStatus = document.getElementById('progressStatus');
    elements.textReviewBtn = document.getElementById('textReviewBtn');

    // 기존 코드와의 호환성을 위한 전역 변수 설정
    window.dropZone = elements.dropZone;
    window.fileInput = elements.fileInput;
    window.fileList = elements.fileList;
    window.fileCount = elements.fileCount;
    window.toggleFilesBtn = elements.toggleFilesBtn;
    window.clearBtn = elements.clearBtn;
    window.uploadBtn = elements.uploadBtn;
    window.statusContainer = elements.statusContainer;
    window.statusSpinner = elements.statusSpinner;
    window.resultType = elements.resultType;
    window.viewResultsBtn = elements.viewResultsBtn;
    window.resultModalContent = elements.resultModalContent;
    window.addInsuranceBtn = elements.addInsuranceBtn;
    window.insuranceRecords = elements.insuranceRecords;
    window.createSummaryBtn = elements.createSummaryBtn;
    window.progressBar = elements.progressBar;
    window.progressStatus = elements.progressStatus;
    window.textReviewBtn = elements.textReviewBtn;
  }

  // 전역 변수로 결과 모달 선언
  let resultsModal = null;
  let reportRenderer = null; // 새로운 보고서 렌더러 추가

  // 디버그 로그를 화면에 표시하는 함수
  // 개발 환경에서만 디버그 로그 표시 (프로덕션에서는 비활성화)
  function debugLog(message) {
    // 개발 환경에서만 로그 출력 (localhost 또는 debug 파라미터가 있을 때)
    const isDevelopment = window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      new URLSearchParams(window.location.search).has('debug');

    if (isDevelopment) {
      console.log(message);
    }
  }

  // 설정
  const BASE_URL = window.location.origin; // "http://localhost:5174"
  const OCR_API_URL = 'http://localhost:3030/api/ocr';
  const API_URL = 'http://localhost:3030/api';
  const POSTPROCESS_API_URL = `${API_URL}/postprocess`;
  const MAX_FILES = 100;
  const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB
  const POLLING_INTERVAL = 2000; // 2초

  // 워크플로우 단계 관리
  // 전역 변수들
  let selectedFiles = [];
  let currentJobId = null;
  let insuranceRecords = [];

  // Legacy workflow/event handlers removed. Initialization is performed via initApp() and initializeEventListeners().

  // 기존 함수들과의 연동을 위한 수정된 함수들
  let currentSessionId = null; // AI 세션 ID 저장용
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

  // 앱 초기화 함수
  function initApp() {
    // DOM 요소 초기화
    initDOMElements();

    // 새로운 보고서 렌더러 초기화
    if (typeof window.VNEXSUSApp !== 'undefined' && window.VNEXSUSApp.ReportRenderer) {
      reportRenderer = new window.VNEXSUSApp.ReportRenderer();
      console.log('보고서 렌더러가 초기화되었습니다.');
    } else {
      console.warn('ReportRenderer 클래스를 찾을 수 없습니다.');
    }

    // 기존 초기화 로직 계속...
    initializeEventListeners();
    loadInsurerOptions();
    initializeInsuranceDateSelectors();
    initializeRealTimeMonitoring();
  }

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
    defaultOption.textContent = '가입보험사';
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

  // 이벤트 리스너 초기화 함수
  function initializeEventListeners() {
    // 파일 입력 관련 이벤트 리스너
    if (dropZone) {
      dropZone.addEventListener('dragover', handleDragOver);
      dropZone.addEventListener('dragleave', handleDragLeave);
      dropZone.addEventListener('drop', handleFileDrop);
      dropZone.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', handleFileSelect);
    }

    // 버튼 이벤트 리스너
    if (clearBtn) {
      clearBtn.addEventListener('click', clearFiles);
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', function (event) {
        uploadFiles();
      });
    }

    if (toggleFilesBtn) {
      toggleFilesBtn.addEventListener('click', toggleFilesView);
    }

    if (viewResultsBtn) {
      viewResultsBtn.addEventListener('click', showResultsModal);
    }
    const resultsModalEl = document.getElementById('resultsModal');
    if (resultsModalEl) {
      resultsModalEl.addEventListener('keydown', handleModalKeydown);
    }
    const copyTextBtn = document.getElementById('copyTextBtn');
    if (copyTextBtn) {
      copyTextBtn.addEventListener('click', copyResultText);
    }

    // 결과 타입 변경 이벤트
    if (resultType) {
      resultType.addEventListener('change', displayResults);
    }

    // 보험 정보 입력 관련 이벤트
    if (addInsuranceBtn) {
      addInsuranceBtn.addEventListener('click', addInsuranceRecord);
    }

    if (createSummaryBtn) {
      createSummaryBtn.addEventListener('click', handleCreateSummary);
    }

    // 새 기능: 상세분석 버튼과 정제 데이터 버튼 이벤트 리스너 추가
    const viewRawTextBtn = document.getElementById('view-raw-text-btn');
    const viewRefinedTextBtn = document.getElementById('view-refined-text-btn');

    if (viewRawTextBtn) {
      viewRawTextBtn.addEventListener('click', handleViewRawText);
    }

    if (viewRefinedTextBtn) {
      viewRefinedTextBtn.addEventListener('click', handleViewRefinedText);
    }
    const textReviewBtn = document.getElementById('textReviewBtn');
    if (textReviewBtn) {
      textReviewBtn.addEventListener('click', handleTextReview);
    }
    const autoGenerateInput = document.getElementById('autoGenerateReport');
    if (autoGenerateInput) {
      autoGenerateInput.addEventListener('change', () => {
        const enabled = autoGenerateInput.checked;
        toggleRequiredIndicators(enabled);
        if (enabled) {
          showPopup('필수입력사항 [피보험자 이름/보험회사/가입일]을 입력하고 진행하세요');
        }
      });
      toggleRequiredIndicators(autoGenerateInput.checked);
    }
  }

  // 실시간 모니터링 초기화 함수
  function initializeRealTimeMonitoring() {
    // 실시간 모니터링 시작
    startRealTimeMonitoring();

    // 모니터링 대시보드 초기화
    if (typeof MonitoringDashboard !== 'undefined') {
      const monitoringDashboard = new MonitoringDashboard();
      monitoringDashboard.init();
      console.log('모니터링 대시보드 초기화 완료');
    }
  }

  // 보험사 옵션 로드 함수
  function loadInsurerOptions() {
    // 보험사 목록 로드
    loadInsurers().then(() => {
      // 보험사 드롭다운 업데이트
      const insuranceCompanySelects = document.querySelectorAll('.insurance-company');
      insuranceCompanySelects.forEach(updateInsurersDropdown);
    });
  }

  // 보험 날짜 선택기 초기화 함수
  function initializeInsuranceDateSelectors() {
    // 기존 보험 레코드에 날짜 선택 필드 설정
    updateExistingDateFields();

    // 개발 모드 상태 초기화
    const isDevMode = localStorage.getItem('devMode') === 'true';
    updateDevModeUI(isDevMode);
  }

  function toggleRequiredIndicators(required) {
    const nameInput = document.getElementById('patientName');
    const record = document.querySelector('.insurance-record');
    const companySelect = record?.querySelector('.insurance-company');
    const enrollmentInput = record?.querySelector('.insurance-date');
    if (!required) {
      if (nameInput) nameInput.classList.remove('is-invalid', 'border', 'border-danger');
      if (companySelect) companySelect.classList.remove('is-invalid', 'border', 'border-danger');
      if (enrollmentInput) {
        enrollmentInput.classList.remove('is-invalid', 'border', 'border-danger');
        enrollmentInput.style.border = '';
        enrollmentInput.style.boxShadow = '';
      }
      if (record) record.classList.remove('border', 'border-danger');
      return;
    }
    const nameMissing = !!nameInput && !nameInput.value.trim();
    const companyMissing = !!companySelect && !companySelect.value.trim();
    const dateMissing = !!enrollmentInput && !enrollmentInput.value.trim();
    if (nameInput && nameMissing) {
      nameInput.classList.add('is-invalid', 'border', 'border-danger');
    }
    if (companySelect && companyMissing) {
      companySelect.classList.add('is-invalid', 'border', 'border-danger');
    }
    if (enrollmentInput && dateMissing) {
      enrollmentInput.classList.add('is-invalid', 'border', 'border-danger');
      enrollmentInput.style.border = '2px solid #dc3545';
      enrollmentInput.style.boxShadow = '0 0 0 2px rgba(220,53,69,0.15)';
    }
    if (record && (companyMissing || dateMissing)) {
      record.classList.add('border', 'border-danger');
    }
  }

  function showPopup(message) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);z-index:9999;';
    const box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);max-width:480px;width:92%;padding:0;overflow:hidden;';
    const text = document.createElement('div');
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;background:linear-gradient(90deg,#f8fafc,#eef2ff);padding:16px 18px;border-bottom:1px solid #e5e7eb;';
    const icon = document.createElement('div');
    icon.innerHTML = '<i class="bi bi-file-earmark-text text-primary"></i>';
    icon.style.cssText = 'font-size:20px;';
    const title = document.createElement('div');
    title.textContent = '필수 입력사항 확인';
    title.style.cssText = 'font-weight:600;color:#0f172a;font-size:15px;';
    header.appendChild(icon);
    header.appendChild(title);
    text.style.cssText = 'font-size:14px;color:#111;line-height:1.6;padding:16px 18px;';
    text.innerHTML = `
      다음 항목을 먼저 입력해주세요.<br>
      <div style="margin-top:8px;padding:10px;border:1px dashed #e5e7eb;border-radius:8px;background:#f9fafb;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;display:inline-block;"></span>
          <strong>피보험자 이름</strong>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;display:inline-block;"></span>
          <strong>보험회사</strong>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;display:inline-block;"></span>
          <strong>가입일</strong>
        </div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'width:100%;border-top-left-radius:0;border-top-right-radius:0;';
    btn.textContent = '확인';
    btn.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    box.appendChild(header);
    box.appendChild(text);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // 기존 코드 (이벤트 리스너 부분 제거)
  function startApplication() {

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

    if (files && files.length > 0) {
      addFiles(files);
    }

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
      updateStatus('warning', `최대 ${MAX_FILES}개의 파일만 업로드할 수 있습니다.`);
      return;
    }

    // 총 파일 크기 계산
    const currentTotalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    const newFilesSize = validFiles.reduce((total, file) => total + file.size, 0);

    if (currentTotalSize + newFilesSize > MAX_TOTAL_SIZE) {
      updateStatus('warning', `총 파일 크기가 100MB를 초과할 수 없습니다.`);
      return;
    }

    // 파일 추가
    let addedCount = 0;
    validFiles.forEach(file => {
      if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
        selectedFiles.push(file);
        addedCount++;
      }
    });

    updateFileList();
    updateUploadButton();
  }

  // 파일 목록 업데이트
  function updateFileList() {
    if (!fileList || !fileCount) return;

    // 파일이 없을 때 표시
    if (selectedFiles.length === 0) {
      fileList.innerHTML = `
        <div class="text-center text-muted py-4 small">
          <i class="bi bi-inbox fs-4 d-block mb-2 opacity-50"></i>
          업로드된 파일이 여기에 표시됩니다
        </div>
      `;
      fileCount.innerHTML = `<i class="bi bi-files me-1"></i>0개 파일 선택됨`;
      return;
    }

    fileList.innerHTML = '';
    const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    fileCount.innerHTML = `<i class="bi bi-files me-1"></i>${selectedFiles.length}개 파일 선택됨 (${formatFileSize(totalSize)})`;

    selectedFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      const isPdf = file.type === 'application/pdf';
      const iconClass = isPdf ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-image text-primary';

      fileItem.className = 'file-item d-flex align-items-center justify-content-between p-2 mb-2 bg-white border rounded-2';
      fileItem.style.transition = 'transform 0.2s, border-color 0.2s';
      fileItem.innerHTML = `
        <div class="d-flex align-items-center">
          <i class="bi ${iconClass} fs-5 me-3"></i>
          <div>
            <div class="fw-bold small text-truncate" style="max-width: 300px;">${file.name}</div>
            <div class="text-muted" style="font-size: 0.75rem;">${formatFileSize(file.size)}</div>
          </div>
        </div>
        <button class="btn btn-link text-muted p-0 btn-remove" data-index="${index}"><i class="bi bi-x-lg"></i></button>
      `;

      fileItem.addEventListener('mouseenter', () => {
        fileItem.style.transform = 'translateX(2px)';
        fileItem.style.borderColor = '#2563eb';
      });
      fileItem.addEventListener('mouseleave', () => {
        fileItem.style.transform = '';
        fileItem.style.borderColor = '';
      });

      fileList.appendChild(fileItem);

      // 파일 삭제 이벤트
      fileItem.querySelector('.btn-remove').addEventListener('click', function () {
        const idx = parseInt(this.getAttribute('data-index'));
        selectedFiles.splice(idx, 1);
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
      console.log('uploadFiles 호출됨, selectedFiles:', selectedFiles);
      console.log('selectedFiles.length:', selectedFiles.length);

      if (selectedFiles.length === 0) {
        console.warn('선택된 파일이 없음');
        updateStatus('warning', '먼저 분석할 파일을 선택해주세요.');
        return;
      }

      const autoGenerate = document.getElementById('autoGenerateReport')?.checked;
      if (autoGenerate) {
        const patientNameValue = document.getElementById('patientName')?.value?.trim() || '';
        const firstRecord = document.querySelector('.insurance-record');
        const companyValue = firstRecord?.querySelector('.insurance-company')?.value?.trim() || '';
        const enrollmentRaw = firstRecord?.querySelector('.insurance-date')?.value?.trim() || '';
        if (!patientNameValue || !companyValue || !enrollmentRaw) {
          updateStatus('warning', '필수입력사항 [피보험자 이름/보험회사/가입일]을 입력하고 진행하세요');
          toggleRequiredIndicators(true);
          return;
        }
      }

      // FormData 생성
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // 보험 정보 수집
      const patientName = document.getElementById('patientName').value.trim();
      const patientMemo = document.getElementById('patientMemo').value.trim();

      // 보험 기록 수집 (현재 UI 클래스명과 일치하도록 수정)
      const insuranceData = [];
      document.querySelectorAll('.insurance-record').forEach(record => {
        const company = record.querySelector('.insurance-company')?.value?.trim() || '';
        const enrollmentDate = record.querySelector('.insurance-date')?.value || '';
        const productName = record.querySelector('.insurance-product')?.value?.trim() || '';
        const period = record.querySelector('.insurance-period')?.value || '';

        if (company || enrollmentDate || productName || period) {
          insuranceData.push({
            company,
            enrollmentDate,
            productName,
            period
          });
        }
      });

      formData.append('patientName', patientName);
      formData.append('patientMemo', patientMemo);
      formData.append('insuranceData', JSON.stringify(insuranceData));

      // 진행 상태 업데이트
      updateOCRProgress(10, '파일 업로드 중...');

      console.log(`API 요청 시작: ${OCR_API_URL}/upload (파일 ${selectedFiles.length}개)`);

      // API 요청
      const response = await fetch(`${OCR_API_URL}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
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

      updateOCRProgress(30, '문서 분석 시작...');

      // 작업 상태 폴링 시작
      startPolling(currentJobId);

    } catch (error) {
      console.error('업로드 오류:', error);
      console.error('오류 스택:', error.stack);
      updateOCRProgress(0, '업로드 실패: ' + error.message);
      updateStatus('danger', `[메디아이] 업로드 오류: ${error.message}`);
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
        console.log(`폴링 요청 시작: ${OCR_API_URL}/status/${jobId}`);
        const response = await fetch(`${OCR_API_URL}/status/${jobId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        console.log(`폴링 응답 상태: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('폴링 오류 응답:', errorData);
          throw new Error(errorData.error || '상태 확인 실패');
        }

        const data = await response.json();

        // 프로그레스바 업데이트 (새로운 워크플로우용)
        const percentage = data.filesTotal > 0 ? Math.round((data.filesProcessed / data.filesTotal) * 70) + 30 : 30;
        updateOCRProgress(percentage, data.status === 'processing' ? '문서 분석 중...' : data.status);

        // 완료 시 결과 가져오기
        if (data.status === 'completed') {
          await fetchResults(jobId);
          return;
        }

        // 오류 시 폴링 중단
        if (data.status === 'failed') {
          updateOCRProgress(0, '문서 분석 실패');
          updateStatus('danger', `[메디아이] 문서 처리 실패: ${data.error || '알 수 없는 오류'}`);
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
      console.log(`결과 요청 시작: ${OCR_API_URL}/result/${jobId}`);
      const response = await fetch(`${OCR_API_URL}/result/${jobId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log(`결과 응답 상태: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '결과 가져오기 실패');
      }

      const data = await response.json();
      resultData = data;

      // 새로운 워크플로우 UI 업데이트
      updateOCRProgress(100, '문서 분석 완료!');
      updateStatus('success', `문서 처리 완료! ${Object.keys(data.results).length}개 파일 처리됨`);

      // 결과 보기/요약표 버튼 활성화
      const createSummaryBtnEl = document.getElementById('createSummaryBtn');
      if (createSummaryBtnEl) createSummaryBtnEl.disabled = false;
      if (window.viewResultsBtn) window.viewResultsBtn.disabled = false;

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
      const autoGenerate = document.getElementById('autoGenerateReport')?.checked;
      if (autoGenerate) {
        setTimeout(() => {
          handleCreateSummary();
        }, 800);
      }

    } catch (error) {
      console.error('결과 가져오기 오류:', error);
      updateOCRProgress(0, '결과 가져오기 실패');
    }
  }

  // 문서 ID 포맷팅 함수
  // 상태 메시지 업데이트
  function updateStatus(type, message) {
    statusContainer.style.display = 'block';
    statusContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  }
  
  

  // 분리된 프로그레스바 업데이트 함수들
  function updateOCRProgress(percentage, statusText) {
    const ocrProgressBar = document.getElementById('ocrProgressBar');
    const ocrProgressPercentage = document.getElementById('ocrProgressPercentage');
    const ocrProgressStatus = document.getElementById('ocrProgressStatus');

    if (ocrProgressBar && ocrProgressPercentage && ocrProgressStatus) {
      ocrProgressBar.style.width = `${percentage}%`;
      ocrProgressBar.setAttribute('aria-valuenow', percentage);
      ocrProgressPercentage.textContent = `${percentage}%`;

      ocrProgressStatus.textContent = statusText;
      ocrProgressStatus.className = 'progress-status text-center';

      if (percentage > 0 && percentage < 100) {
        ocrProgressStatus.classList.add('processing');
      } else if (percentage === 100) {
        ocrProgressStatus.classList.add('completed');
      }
    }
  }

  function updateReportProgress(percentage, statusText) {
    const reportProgressBar = document.getElementById('reportProgressBar');
    const reportProgressPercentage = document.getElementById('reportProgressPercentage');
    const reportProgressStatus = document.getElementById('reportProgressStatus');

    if (reportProgressBar && reportProgressPercentage && reportProgressStatus) {
      reportProgressBar.style.width = `${percentage}%`;
      reportProgressBar.setAttribute('aria-valuenow', percentage);
      reportProgressPercentage.textContent = `${percentage}%`;

      reportProgressStatus.textContent = statusText;
      reportProgressStatus.className = 'progress-status text-center';

      if (percentage > 0 && percentage < 100) {
        reportProgressStatus.classList.add('processing');
      } else if (percentage === 100) {
        reportProgressStatus.classList.add('completed');
      }

      const copyBtn = document.getElementById('copyReportBtn');
      if (copyBtn) {
        copyBtn.disabled = percentage !== 100;
      }
    }
  }

  // 기존 프로그레스바 업데이트 (하위 호환성 유지)
  function updateProgressBar(percentage, statusText) {
    // OCR 진행 상황으로 간주
    updateOCRProgress(percentage, statusText);
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
  document.addEventListener('devModeChanged', function (event) {
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
    const contentEl = document.getElementById('resultModalContent');
    if (contentEl) { contentEl.focus(); }
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
    insurersOptions = '<option value="">가입보험사</option>';

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
        <label class="form-label me-2" style="white-space: nowrap;">가입보험사:</label>
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
    removeBtn.addEventListener('click', function () {
      if (insuranceRecords.childElementCount > 1) {
        newRecord.remove();
      } else {
        updateStatus('warning', '최소 1개의 보험 정보는 유지해야 합니다.');
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
      resetBtn.addEventListener('click', function () {
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

  /**
   * 보고서 생성 진행률 업데이트
   * @param {number} percent 진행률 (0-100)
   * @param {string} status 상태 메시지
   */
  function updateReportProgress(percent, status) {
    const progressSection = document.getElementById('reportProgressSection');
    const progressBar = document.getElementById('reportProgressBar');
    const progressPercentage = document.getElementById('reportProgressPercentage');
    const progressStatus = document.getElementById('reportProgressStatus');

    if (progressSection) {
      progressSection.style.display = 'block';
      progressSection.classList.remove('d-none');
    }

    if (progressBar) {
      progressBar.style.width = `${percent}%`;
      progressBar.setAttribute('aria-valuenow', percent);
    }

    if (progressPercentage) {
      progressPercentage.textContent = `${percent}%`;
    }

    if (progressStatus && status) {
      progressStatus.textContent = status;
    }
  }

  // 요약표 작성 처리
  async function handleCreateSummary() {
    try {
      console.log('handleCreateSummary 호출됨');
      console.log('resultData:', resultData);

      if (!resultData || !resultData.results) {
        console.warn('문서 처리 결과가 없음');
        // 더 구체적인 안내 메시지로 변경
        alert('[메디아이] 문서 처리가 완료되지 않았습니다. 먼저 파일을 업로드하고 문서 분석을 완료해주세요.');
        return;
      }

      const patientName = document.getElementById('patientName').value.trim();
      if (!patientName) {
        updateStatus('warning', '필수입력사항 [피보험자 이름/보험회사/가입일]을 입력하고 진행하세요');
        toggleRequiredIndicators(true);
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
        updateStatus('warning', '필수입력사항 [피보험자 이름/보험회사/가입일]을 입력하고 진행하세요');
        toggleRequiredIndicators(true);
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
      const ocrTexts = Object.values(resultData.results).map(item => item.mergedText || item.text || item.rawText || '');
      const extractedText = ocrTexts.join('\n\n');

      // API 요청 시작
      createSummaryBtn.disabled = true;
      updateReportProgress(10, "요약표 생성 시작");

      console.log('AI 요약표 생성 요청 시작');
      console.log('API_URL:', API_URL);
      console.log('요청 데이터:', { text: extractedText.substring(0, 100) + '...', patientInfo });

      updateReportProgress(30, "AI 분석 중");

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

      console.log('AI API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AI API 오류:', errorData);
        updateReportProgress(0, "생성 실패");
        throw new Error(errorData.error || 'AI 요약표 생성 실패');
      }

      updateReportProgress(80, "보고서 생성 중");

      const data = await response.json();
      console.log('AI 요약표 생성 응답 데이터:', data);

      if (data.success) {
        // AI 세션 ID 저장 (채팅용)
        currentSessionId = data.sessionId;

        updateReportProgress(100, "생성 완료");

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

              // 3. 보고서 탭으로 자동 전환 (사용자 요청)
              const reportTabBtn = document.getElementById('report-tab');
              if (reportTabBtn) {
                const reportTab = new bootstrap.Tab(reportTabBtn);
                reportTab.show();
              }

              // 탭 전환 후 스크롤
              setTimeout(() => {
                aiReportSection.scrollIntoView({ behavior: 'smooth' });
              }, 300);
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
          updateReportProgress(0, "보고서 내용 없음");
        }
      } else {
        throw new Error(data.error || 'AI 요약표 생성 실패');
      }
    } catch (error) {
      console.error('요약표 생성 오류:', error);
      console.error('오류 스택:', error.stack);

      // 더 구체적인 에러 메시지 제공
      let errorMessage = '요약표 생성 실패';
      if (error.message.includes('fetch')) {
        errorMessage = '서버 연결 실패. 네트워크 상태를 확인해주세요.';
      } else if (error.message.includes('AI')) {
        errorMessage = 'AI 서비스 오류가 발생했습니다.';
      } else {
        errorMessage = `요약표 생성 실패: ${error.message}`;
      }

      updateReportProgress(0, "생성 실패");
      createSummaryBtn.disabled = false;

      // 기존 룰 기반 방식으로 폴백
      try {
        console.log('룰 기반 폴백 시도 중...');
        updateReportProgress(20, "기존 방식으로 재시도");
        useRuleBasedSummaryGeneration();
      } catch (fallbackError) {
        console.error('기존 방식 폴백 오류:', fallbackError);
        updateReportProgress(0, "모든 방식 실패");
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
      const ocrTexts = Object.values(resultData.results).map(item => item.mergedText || item.text || item.rawText || '');

      updateStatus('info', '룰 기반 요약표 생성 중...');
      updateReportProgress(20, "룰 기반 분석 시작");

      console.log('단순화된 요약표 생성 요청 - 의료지식 처리 비활성화');

      updateReportProgress(40, "데이터 처리 중");

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
        updateReportProgress(0, "생성 실패");
        throw new Error(errorData.error || '요약표 생성 실패');
      }

      updateReportProgress(85, "보고서 완성 중");

      const data = await response.json();
      console.log('요약표 생성 응답 데이터:', data);

      if (data.success) {
        // 후처리 데이터 저장
        summaryData = data;

        updateStatus('success', '요약표 생성 완료!');
        updateReportProgress(100, "생성 완료");

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

          // 개선된 보고서 버튼 추가
          addEnhancedReportButton();

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

    // 가입일 가져오기 (enhanced timeline 렌더링용)
    let enrollmentDate = null;
    if (summaryData && summaryData.patientInfo && summaryData.patientInfo.enrollmentDate) {
      enrollmentDate = summaryData.patientInfo.enrollmentDate;
    } else {
      const insuranceDateInput = document.querySelector('.insurance-date');
      if (insuranceDateInput && insuranceDateInput.value) {
        enrollmentDate = insuranceDateInput.value;
      }
    }

    // 향상된 타임라인 렌더링 시도 (ai-report.js의 renderEnhancedTimeline 사용)
    if (window.VNEXSUSApp && window.VNEXSUSApp.AIReport && window.VNEXSUSApp.AIReport.renderEnhancedTimeline) {
      try {
        let enhancedContainer = document.querySelector('.enhanced-timeline-view');
        if (!enhancedContainer) {
          const tableContainer = tbody.closest('.table-responsive');
          if (tableContainer) {
            enhancedContainer = document.createElement('div');
            enhancedContainer.className = 'enhanced-timeline-view mb-4';
            tableContainer.parentElement.insertBefore(enhancedContainer, tableContainer);
          }
        }
        if (enhancedContainer) {
          const enhancedHtml = window.VNEXSUSApp.AIReport.renderEnhancedTimeline(rows, enrollmentDate);
          if (enhancedHtml) {
            enhancedContainer.innerHTML = enhancedHtml;
            console.log('향상된 타임라인 렌더링 완료');
          }
        }
      } catch (err) {
        console.error('향상된 타임라인 렌더링 오류:', err);
      }
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
      const response = await fetch(`${OCR_API_URL}/result/${currentJobId}`);
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
      const jobId = currentJobId || resultData?.jobId;
      if (jobId) {
        try {
          const resp = await fetch(`${OCR_API_URL}/result/${jobId}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.status === 'completed' && data.results) {
              resultData = data;
            }
          }
        } catch (e) {}
      }
      if (!resultData || !resultData.results) {
        updateStatus('warning', '추출된 텍스트가 없습니다. 먼저 파일을 업로드하고 처리를 완료해주세요.');
        return;
      }
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
      updateStatus('error', '데이터를 가져오는 중 오류가 발생했습니다.');
    }
  }

  async function handleTextReview() {
    if (!resultData || !resultData.results) {
      const jobId = currentJobId || resultData?.jobId;
      if (jobId) {
        try {
          const resp = await fetch(`${OCR_API_URL}/result/${jobId}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.status === 'completed' && data.results) {
              resultData = data;
            }
          }
        } catch (e) {}
      }
    }
    const selectEl = document.getElementById('resultType');
    if (selectEl) { selectEl.value = 'combined'; }
    displayResults();
    showResultsModal();
  }

  // 새 함수 추가: 정제 데이터 핸들러
  async function handleViewRefinedText() {
    if (!resultData || !resultData.jobId) {
      updateStatus('warning', '처리된 작업이 없습니다. 먼저 파일을 업로드하고 처리를 완료해주세요.');
      return;
    }

    try {
      // 정제 데이터(소거 사전 적용 데이터) 가져오기
      const refinedData = await fetchFilteredResults('exclude');
      if (!refinedData) {
        updateStatus('warning', '정제 데이터를 가져올 수 없습니다.');
        return;
      }

      // 새 창에 데이터 표시
      openDataInNewWindow('정제 데이터 (소거 사전 적용)', refinedData);
    } catch (error) {
      console.error('정제 데이터 가져오기 오류:', error);
      updateStatus('error', '정제 데이터를 가져오는 중 오류가 발생했습니다.');
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

  // ========== 개선된 보고서 생성 기능 ==========

  /**
   * 개선된 보고서 생성 함수
   * @param {string} jobId 작업 ID
   * @param {Object} options 옵션
   */
  async function generateEnhancedReport(jobId, options = {}) {
    try {
      console.log(`[개선된 보고서] 생성 시작 - jobId: ${jobId}`);

      updateStatus('info', '개선된 보고서 생성 중...');
      updateReportProgress(10, "AI 필터링 및 검증 중");

      const response = await fetch('/api/enhanced-report/generate-enhanced-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: jobId,
          options: {
            enableAIFiltering: true,
            enableVisualization: true,
            includeValidationStats: true,
            ...options
          }
        })
      });

      updateReportProgress(50, "보고서 처리 중");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '개선된 보고서 생성 실패');
      }

      const data = await response.json();
      console.log('[개선된 보고서] 생성 완료:', data);

      updateReportProgress(80, "렌더링 중");

      if (data.success && data.data) {
        // 개선된 보고서 렌더링
        await renderEnhancedReport(data.data);

        updateStatus('success', '개선된 보고서 생성 완료!');
        updateReportProgress(100, "완료");

        return data.data;
      } else {
        throw new Error('보고서 데이터가 없습니다.');
      }

    } catch (error) {
      console.error('[개선된 보고서] 생성 오류:', error);
      updateStatus('danger', `개선된 보고서 생성 실패: ${error.message}`);
      updateReportProgress(0, "오류");
      throw error;
    }
  }

  /**
   * 개선된 보고서 렌더링 함수
   * @param {Object} reportData 보고서 데이터
   */
  async function renderEnhancedReport(reportData) {
    try {
      console.log('[개선된 보고서] 렌더링 시작');

      // ReportRenderer 인스턴스 확인
      if (window.reportRenderer && typeof window.reportRenderer.renderReport === 'function') {
        // 개선된 렌더러로 보고서 렌더링
        const reportContainer = document.getElementById('enhanced-report-container') ||
          createEnhancedReportContainer();

        await window.reportRenderer.renderReport(reportData, reportContainer);

        // 컨테이너 표시
        reportContainer.classList.remove('d-none');
        reportContainer.scrollIntoView({ behavior: 'smooth' });

        console.log('[개선된 보고서] 고급 렌더링 완료');
      } else {
        console.warn('ReportRenderer가 초기화되지 않았습니다. 기본 렌더링을 사용합니다.');
        renderBasicReport(reportData);
      }

    } catch (error) {
      console.error('[개선된 보고서] 렌더링 오류:', error);
      // 기본 렌더링으로 폴백
      renderBasicReport(reportData);
    }
  }

  /**
   * 개선된 보고서 컨테이너 생성
   */
  function createEnhancedReportContainer() {
    const container = document.createElement('div');
    container.id = 'enhanced-report-container';
    container.className = 'mt-4 d-none';

    // 결과 컨테이너에 추가
    const resultContainer = document.getElementById('result-container') ||
      document.querySelector('.container');

    if (resultContainer) {
      resultContainer.appendChild(container);
    }

    return container;
  }

  /**
   * 기본 보고서 렌더링 (폴백)
   * @param {Object} reportData 보고서 데이터
   */
  function renderBasicReport(reportData) {
    console.log('[기본 보고서] 렌더링 시작');

    const container = document.getElementById('enhanced-report-container') ||
      createEnhancedReportContainer();

    const { normalizedReport, processingStats, metadata } = reportData;

    let html = `
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h4 class="mb-0">
                    <i class="bi bi-file-medical"></i> 개선된 의료 문서 분석 보고서
                </h4>
                <small>생성일: ${new Date(reportData.generatedAt || Date.now()).toLocaleString('ko-KR')}</small>
            </div>
            <div class="card-body">
    `;

    // 처리 통계
    if (processingStats) {
      html += `
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="card-title">${processingStats.totalFiles || 0}</h5>
                            <p class="card-text">처리된 파일</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="card-title">${processingStats.totalPages || 0}</h5>
                            <p class="card-text">총 페이지</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="card-title">${Math.round((processingStats.totalTextLength || 0) / 1000)}K</h5>
                            <p class="card-text">추출된 텍스트</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5 class="card-title">
                                <i class="bi bi-check-circle text-success"></i>
                            </h5>
                            <p class="card-text">AI 검증 완료</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 보험 검증 통계
    if (normalizedReport?.insuranceValidationStats) {
      const stats = normalizedReport.insuranceValidationStats;
      html += `
            <div class="mb-4">
                <h5><i class="bi bi-shield-check"></i> 보험사 검증 통계</h5>
                <div class="row">
                    <div class="col-md-2">
                        <div class="text-center">
                            <div class="h4 text-primary">${stats.total || 0}</div>
                            <small>총 검증</small>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="text-center">
                            <div class="h4 text-success">${stats.valid || 0}</div>
                            <small>유효</small>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="text-center">
                            <div class="h4 text-warning">${stats.corrected || 0}</div>
                            <small>보정됨</small>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="text-center">
                            <div class="h4 text-danger">${stats.invalid || 0}</div>
                            <small>무효</small>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="text-center">
                            <div class="h4 text-muted">${stats.filteredOut || 0}</div>
                            <small>필터됨</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 환자 정보
    if (normalizedReport?.patientInfo) {
      const patient = normalizedReport.patientInfo;
      html += `
            <div class="mb-4">
                <h5><i class="bi bi-person"></i> 환자 정보</h5>
                <div class="table-responsive">
                    <table class="table table-sm">
                        ${patient.name ? `<tr><td width="120">이름</td><td>${patient.name}</td></tr>` : ''}
                        ${patient.birthDate ? `<tr><td>생년월일</td><td>${patient.birthDate}</td></tr>` : ''}
                        ${patient.gender ? `<tr><td>성별</td><td>${patient.gender}</td></tr>` : ''}
                        ${patient.address ? `<tr><td>주소</td><td>${patient.address}</td></tr>` : ''}
                    </table>
                </div>
            </div>
        `;
    }

    // 보험 정보
    if (normalizedReport?.insuranceInfo) {
      html += `<div class="mb-4"><h5><i class="bi bi-shield"></i> 보험 정보</h5>`;

      const insuranceList = Array.isArray(normalizedReport.insuranceInfo) ?
        normalizedReport.insuranceInfo : [normalizedReport.insuranceInfo];

      insuranceList.forEach((insurance, index) => {
        html += `
                <div class="card mb-2">
                    <div class="card-body">
                        <h6>보험 ${index + 1}</h6>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                ${insurance.company ? `<tr><td width="120">보험사</td><td>${insurance.company}</td></tr>` : ''}
                                ${insurance.joinDate ? `<tr><td>가입일</td><td>${insurance.joinDate}</td></tr>` : ''}
                                ${insurance.product ? `<tr><td>상품명</td><td>${insurance.product}</td></tr>` : ''}
                                ${insurance.validationStatus ? `<tr><td>검증상태</td><td><span class="badge bg-${getValidationBadgeColor(insurance.validationStatus)}">${insurance.validationStatus}</span></td></tr>` : ''}
                            </table>
                        </div>
                    </div>
                </div>
            `;
      });

      html += `</div>`;
    }

    // 의료 기록 타임라인
    if (normalizedReport?.medicalRecords && normalizedReport.medicalRecords.length > 0) {
      html += `
            <div class="mb-4">
                <h5><i class="bi bi-clock-history"></i> 의료 기록 타임라인</h5>
                <div class="timeline">
        `;

      normalizedReport.medicalRecords.forEach((record, index) => {
        const categoryClass = getCategoryClass(record.visualization?.category);
        const categoryIcon = getCategoryIcon(record.visualization?.category);

        html += `
                <div class="timeline-item ${categoryClass}">
                    <div class="timeline-marker">
                        <i class="bi ${categoryIcon}"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="d-flex justify-content-between align-items-start">
                            <h6>${record.date || '날짜 미상'}</h6>
                            ${record.visualization?.category ? `<span class="badge bg-${getCategoryBadgeColor(record.visualization.category)}">${getCategoryLabel(record.visualization.category)}</span>` : ''}
                        </div>
                        ${record.hospital ? `<p class="mb-1"><strong>병원:</strong> ${record.hospital}</p>` : ''}
                        ${record.diagnosis ? `<p class="mb-1"><strong>진단:</strong> ${Array.isArray(record.diagnosis) ? record.diagnosis.join(', ') : record.diagnosis}</p>` : ''}
                        ${record.treatment ? `<p class="mb-1"><strong>치료:</strong> ${Array.isArray(record.treatment) ? record.treatment.join(', ') : record.treatment}</p>` : ''}
                        ${record.notes ? `<p class="mb-0 text-muted"><small>${record.notes}</small></p>` : ''}
                    </div>
                </div>
            `;
      });

      html += `
                </div>
            </div>
        `;
    }

    html += `
            </div>
        </div>
    `;

    // 타임라인 스타일 추가
    addTimelineStyles();

    container.innerHTML = html;
    container.classList.remove('d-none');

    console.log('[기본 보고서] 렌더링 완료');
  }

  /**
   * 타임라인 스타일 추가
   */
  function addTimelineStyles() {
    if (!document.getElementById('timeline-styles')) {
      const style = document.createElement('style');
      style.id = 'timeline-styles';
      style.textContent = `
            .timeline {
                position: relative;
                padding-left: 30px;
            }
            .timeline::before {
                content: '';
                position: absolute;
                left: 15px;
                top: 0;
                bottom: 0;
                width: 2px;
                background: #dee2e6;
            }
            .timeline-item {
                position: relative;
                margin-bottom: 20px;
            }
            .timeline-marker {
                position: absolute;
                left: -22px;
                top: 5px;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: #fff;
                border: 2px solid #dee2e6;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            }
            .timeline-content {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid #dee2e6;
            }
            .timeline-item.within_3months .timeline-marker { border-color: #dc3545; background: #fff5f5; }
            .timeline-item.within_3months .timeline-content { border-left-color: #dc3545; }
            .timeline-item.within_5years .timeline-marker { border-color: #ffc107; background: #fffbf0; }
            .timeline-item.within_5years .timeline-content { border-left-color: #ffc107; }
            .timeline-item.after_join .timeline-marker { border-color: #28a745; background: #f0fff4; }
            .timeline-item.after_join .timeline-content { border-left-color: #28a745; }
            .timeline-item.before_5years .timeline-marker { border-color: #6c757d; background: #f8f9fa; }
            .timeline-item.before_5years .timeline-content { border-left-color: #6c757d; }
        `;
      document.head.appendChild(style);
    }
  }

  /**
   * 헬퍼 함수들
   */
  function getValidationBadgeColor(status) {
    switch (status) {
      case 'valid': return 'success';
      case 'corrected': return 'warning';
      case 'invalid': return 'danger';
      default: return 'secondary';
    }
  }

  function getCategoryClass(category) {
    return category || 'unknown';
  }

  function getCategoryIcon(category) {
    switch (category) {
      case 'within_3months': return 'bi-exclamation-triangle';
      case 'within_5years': return 'bi-info-circle';
      case 'after_join': return 'bi-check-circle';
      case 'before_5years': return 'bi-clock';
      default: return 'bi-question-circle';
    }
  }

  function getCategoryBadgeColor(category) {
    switch (category) {
      case 'within_3months': return 'danger';
      case 'within_5years': return 'warning';
      case 'after_join': return 'success';
      case 'before_5years': return 'secondary';
      default: return 'light';
    }
  }

  function getCategoryLabel(category) {
    switch (category) {
      case 'within_3months': return '3개월 이내';
      case 'within_5years': return '5년 이내';
      case 'after_join': return '가입 후';
      case 'before_5years': return '5년 이전';
      default: return '미분류';
    }
  }

  /**
   * 작업 ID로 개선된 보고서 생성
   * @param {string} jobId 작업 ID
   */
  async function generateEnhancedReportFromJobId(jobId) {
    if (!jobId) {
      updateStatus('warning', '작업 ID가 없습니다. 먼저 OCR 처리를 완료해주세요.');
      return;
    }

    try {
      await generateEnhancedReport(jobId);
    } catch (error) {
      console.error('개선된 보고서 생성 실패:', error);
    }
  }

  /**
   * 개선된 보고서 버튼을 기존 UI에 추가
   */
  function addEnhancedReportButton() {
    // 기존 다운로드 버튼 찾기
    const downloadBtn = document.getElementById('downloadReportBtn');
    if (!downloadBtn) return;

    // 이미 버튼이 있는지 확인
    if (document.getElementById('enhancedReportBtn')) return;

    // 개선된 보고서 생성 버튼 생성
    const enhancedReportBtn = document.createElement('button');
    enhancedReportBtn.id = 'enhancedReportBtn';
    enhancedReportBtn.className = 'btn btn-primary ms-2';
    enhancedReportBtn.innerHTML = '<i class="bi bi-magic"></i> 개선된 보고서 생성';
    enhancedReportBtn.onclick = () => {
      const jobId = getCurrentJobId();
      if (jobId) {
        generateEnhancedReportFromJobId(jobId);
      } else {
        updateStatus('warning', '작업 ID를 찾을 수 없습니다.');
      }
    };

    // 다운로드 버튼 옆에 추가
    downloadBtn.parentNode.insertBefore(enhancedReportBtn, downloadBtn.nextSibling);
  }

  /**
   * 현재 작업 ID 가져오기
   */
  function getCurrentJobId() {
    // 전역 변수에서 jobId 찾기
    if (window.currentJobId) return window.currentJobId;
    if (window.jobId) return window.jobId;
    if (resultData && resultData.jobId) return resultData.jobId;

    // URL 파라미터에서 찾기
    const urlParams = new URLSearchParams(window.location.search);
    const jobIdFromUrl = urlParams.get('jobId');
    if (jobIdFromUrl) return jobIdFromUrl;

    return null;
  }

  // 전역 네임스페이스에 필요한 함수들 노출
  window.VNEXSUSApp.initApp = initApp;
  window.VNEXSUSApp.showResultsModal = showResultsModal;
  window.VNEXSUSApp.getCurrentJobId = getCurrentJobId;

  function selectElementText(el) {
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.addRange(range);
  }

  function handleModalKeydown(e) {
    const isCtrlA = (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A');
    if (!isCtrlA) return;
    const contentEl = document.getElementById('resultModalContent');
    if (!contentEl) return;
    selectElementText(contentEl);
    e.preventDefault();
    e.stopPropagation();
  }

  async function copyResultText() {
    const contentEl = document.getElementById('resultModalContent');
    if (!contentEl) return;
    const text = contentEl.innerText || '';
    const btn = document.getElementById('copyTextBtn');
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (__) { }
      document.body.removeChild(ta);
    }
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '복사됨';
      btn.disabled = true;
      setTimeout(function () { btn.textContent = orig; btn.disabled = false; }, 1200);
    }
  }

})(); // IIFE 종료
