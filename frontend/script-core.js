// 코어엔진 전용 스크립트
// Core Engine Pipeline Script

// DOM 요소 (Core Engine Tab)
const dropZoneCore = document.getElementById('dropZoneCore');
const fileInputCore = document.getElementById('fileInputCore');
const fileListCore = document.getElementById('fileListCore');
const fileCountCore = document.getElementById('fileCountCore');
const toggleFilesBtnCore = document.getElementById('toggleFilesBtnCore');
const clearBtnCore = document.getElementById('clearBtnCore');
const uploadBtnCore = document.getElementById('uploadBtnCore');

// 코어엔진 메타데이터 입력 요소
const contractDate = document.getElementById('contractDate');
const claimDiagnosis = document.getElementById('claimDiagnosis');
const patientNameCore = document.getElementById('patientNameCore');
const patientDobCore = document.getElementById('patientDobCore');

// 설정
const CORE_API_URL = 'http://localhost:3030/api';
const CORE_ENHANCED_API_URL = `${CORE_API_URL}/enhanced`;

// 상태 변수 (Core Engine)
let selectedFilesCore = [];
let currentJobIdCore = null;
let pollingTimeoutCore = null;

// 코어엔진 탭 초기화
function initCoreEngineTab() {
  console.log('코어엔진 탭 초기화');
  
  // 이벤트 리스너 등록
  if (dropZoneCore) {
    dropZoneCore.addEventListener('click', () => fileInputCore?.click());
    dropZoneCore.addEventListener('dragover', handleDragOverCore);
    dropZoneCore.addEventListener('drop', handleDropCore);
  }
  
  if (fileInputCore) {
    fileInputCore.addEventListener('change', handleFileSelectCore);
  }
  
  if (clearBtnCore) {
    clearBtnCore.addEventListener('click', clearFilesCore);
  }
  
  if (uploadBtnCore) {
    uploadBtnCore.addEventListener('click', uploadFilesCore);
  }
  
  if (toggleFilesBtnCore) {
    toggleFilesBtnCore.addEventListener('click', toggleFileListCore);
  }
  
  // 코어엔진 상태 확인
  checkCoreEngineStatus();
}

// 드래그 오버 처리 (Core)
function handleDragOverCore(e) {
  e.preventDefault();
  dropZoneCore.classList.add('drag-over');
}

// 드롭 처리 (Core)
function handleDropCore(e) {
  e.preventDefault();
  dropZoneCore.classList.remove('drag-over');
  
  const files = Array.from(e.dataTransfer.files);
  addFilesCore(files);
}

// 파일 선택 처리 (Core)
function handleFileSelectCore(e) {
  const files = Array.from(e.target.files);
  addFilesCore(files);
}

// 파일 추가 (Core)
function addFilesCore(files) {
  const validFiles = files.filter(file => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/tif'];
    return validTypes.includes(file.type);
  });
  
  if (validFiles.length !== files.length) {
    alert('지원되지 않는 파일 형식이 포함되어 있습니다. PDF, JPG, PNG, BMP, TIFF 파일만 업로드 가능합니다.');
  }
  
  // 중복 파일 제거
  validFiles.forEach(file => {
    const isDuplicate = selectedFilesCore.some(existingFile => 
      existingFile.name === file.name && existingFile.size === file.size
    );
    
    if (!isDuplicate) {
      selectedFilesCore.push(file);
    }
  });
  
  updateFileListCore();
  updateUploadButtonCore();
}

// 파일 목록 업데이트 (Core)
function updateFileListCore() {
  if (!fileCountCore || !fileListCore) return;
  
  fileCountCore.textContent = `${selectedFilesCore.length}개 파일 선택됨`;
  
  if (selectedFilesCore.length === 0) {
    fileListCore.innerHTML = '';
    if (toggleFilesBtnCore) toggleFilesBtnCore.style.display = 'none';
    return;
  }
  
  if (toggleFilesBtnCore) toggleFilesBtnCore.style.display = 'block';
  
  fileListCore.innerHTML = selectedFilesCore.map((file, index) => `
    <div class="file-item d-flex justify-content-between align-items-center p-2 border rounded mb-1">
      <div>
        <i class="bi bi-file-earmark-pdf text-danger me-2"></i>
        <span class="file-name">${file.name}</span>
        <small class="text-muted ms-2">(${formatFileSizeCore(file.size)})</small>
      </div>
      <button class="btn btn-sm btn-outline-danger" onclick="removeFileCore(${index})">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join('');
}

// 파일 제거 (Core)
function removeFileCore(index) {
  selectedFilesCore.splice(index, 1);
  updateFileListCore();
  updateUploadButtonCore();
}

// 모든 파일 지우기 (Core)
function clearFilesCore() {
  selectedFilesCore = [];
  updateFileListCore();
  updateUploadButtonCore();
  
  if (fileInputCore) {
    fileInputCore.value = '';
  }
}

// 업로드 버튼 상태 업데이트 (Core)
function updateUploadButtonCore() {
  if (uploadBtnCore) {
    uploadBtnCore.disabled = selectedFilesCore.length === 0;
  }
}

// 파일 목록 토글 (Core)
function toggleFileListCore() {
  if (!fileListCore) return;
  
  const isCollapsed = fileListCore.classList.contains('collapsed-files');
  
  if (isCollapsed) {
    fileListCore.classList.remove('collapsed-files');
    if (toggleFilesBtnCore) toggleFilesBtnCore.textContent = '접기';
  } else {
    fileListCore.classList.add('collapsed-files');
    if (toggleFilesBtnCore) toggleFilesBtnCore.textContent = '펼치기';
  }
}

// 코어엔진 메타데이터 수집
function getCoreEngineMetadata() {
  // 고지의무 윈도우 수집
  const windows = [];
  if (document.getElementById('window3m')?.checked) windows.push('3m');
  if (document.getElementById('window2y')?.checked) windows.push('2y');
  if (document.getElementById('window5y')?.checked) windows.push('5y');
  
  return {
    contractDate: contractDate?.value || '',
    claimDiagnosis: claimDiagnosis?.value || '',
    patientName: patientNameCore?.value || '',
    patientDob: patientDobCore?.value || '',
    disclosureWindows: windows.join(','),
    reportType: 'enhanced'
  };
}

// 코어엔진 상태 확인
function checkCoreEngineStatus() {
  return fetch(`${CORE_ENHANCED_API_URL}/status`)
    .then(response => response.json())
    .then(data => {
      console.log('코어엔진 상태:', data);
      return data.enabled;
    })
    .catch(error => {
      console.warn('코어엔진 상태 확인 실패:', error);
      return false;
    });
}

// 코어엔진 업로드 함수
async function uploadFilesCore() {
  if (selectedFilesCore.length === 0) {
    alert('업로드할 파일을 선택해주세요.');
    return;
  }
  
  const metadata = getCoreEngineMetadata();
  
  console.log('코어엔진 업로드 시작:', {
    files: selectedFilesCore.length,
    metadata: metadata
  });
  
  const formData = new FormData();
  selectedFilesCore.forEach(file => {
    formData.append('files', file);
  });
  
  // 메타데이터 추가
  Object.entries(metadata).forEach(([key, value]) => {
    if (value) formData.append(key, value);
  });
  
  try {
    // 코어엔진 API 사용
    const response = await fetch(`${CORE_ENHANCED_API_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.jobId) {
      currentJobIdCore = result.jobId;
      
      // UI 업데이트
      if (uploadBtnCore) {
        uploadBtnCore.disabled = true;
        uploadBtnCore.textContent = '처리 중...';
      }
      
      // 상태 폴링 시작
      startPollingCore(result.jobId);
      
      console.log('코어엔진 업로드 성공:', result);
    } else {
      throw new Error('Job ID를 받지 못했습니다.');
    }
    
  } catch (error) {
    console.error('코어엔진 업로드 오류:', error);
    alert(`업로드 중 오류가 발생했습니다: ${error.message}`);
    
    // UI 복원
    if (uploadBtnCore) {
      uploadBtnCore.disabled = false;
      uploadBtnCore.textContent = '향상된 분석 시작';
    }
  }
}

// 코어엔진 폴링 함수
function startPollingCore(jobId) {
  const pollStatus = async () => {
    try {
      const response = await fetch(`${CORE_ENHANCED_API_URL}/job/${jobId}/status`);
      const data = await response.json();
      
      console.log('코어엔진 폴링 상태:', data);
      
      // 진행률 업데이트
      if (data.progress !== undefined) {
        updateProgressCore(data.progress, `${data.status} (코어엔진: ${data.coreEngineEnabled ? 'ON' : 'OFF'})`);
      }
      
      if (data.status === 'completed') {
        // 결과 가져오기
        const resultResponse = await fetch(`${CORE_ENHANCED_API_URL}/job/${jobId}/result`);
        const resultData = await resultResponse.json();
        
        handleCoreEngineResults(resultData);
        
      } else if (data.status === 'error') {
        throw new Error(data.error || '처리 중 오류가 발생했습니다.');
        
      } else {
        // 계속 폴링
        pollingTimeoutCore = setTimeout(pollStatus, 2000);
      }
      
    } catch (error) {
      console.error('코어엔진 폴링 오류:', error);
      alert(`상태 확인 중 오류가 발생했습니다: ${error.message}`);
      
      // UI 복원
      if (uploadBtnCore) {
        uploadBtnCore.disabled = false;
        uploadBtnCore.textContent = '향상된 분석 시작';
      }
    }
  };
  
  pollStatus();
}

// 진행률 업데이트 (Core)
function updateProgressCore(progress, status) {
  const progressBar = document.getElementById('progressBar');
  const progressStatus = document.getElementById('progressStatus');
  
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
  }
  
  if (progressStatus) {
    progressStatus.textContent = status;
  }
}

// 코어엔진 결과 처리
function handleCoreEngineResults(resultData) {
  console.log('코어엔진 결과:', resultData);
  
  // UI 복원
  if (uploadBtnCore) {
    uploadBtnCore.disabled = false;
    uploadBtnCore.textContent = '향상된 분석 시작';
  }
  
  // 결과 표시
  displayCoreEngineResults(resultData);
}

// 코어엔진 결과 표시
function displayCoreEngineResults(resultData) {
  const statusContainer = document.getElementById('statusContainer');
  
  if (statusContainer) {
    statusContainer.innerHTML = `
      <div class="alert alert-success">
        <h6><i class="bi bi-cpu"></i> 코어엔진 분석 완료</h6>
        <p>고지의무 분석, 질환별 규칙 적용, AI 기반 요약이 완료되었습니다.</p>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-primary" onclick="showCoreEngineDetails()">상세 결과 보기</button>
          <button class="btn btn-sm btn-success" onclick="downloadCoreEngineReport()">요약표 다운로드</button>
        </div>
      </div>
    `;
  }
  
  // 전역 변수에 결과 저장
  window.coreEngineResultData = resultData;
  
  // 다운로드 버튼 활성화
  const downloadBtn = document.getElementById('downloadReportBtn');
  if (downloadBtn) {
    downloadBtn.style.display = 'inline-block';
  }
}

// 코어엔진 상세 결과 표시
function showCoreEngineDetails() {
  if (!window.coreEngineResultData) return;
  
  // 모달 또는 새 창에서 결과 표시
  const newWindow = window.open('', '_blank', 'width=1200,height=800');
  newWindow.document.write(`
    <html>
      <head>
        <title>코어엔진 분석 결과</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="p-4">
        <h2>코어엔진 분석 결과</h2>
        <div class="row">
          <div class="col-md-6">
            <h4>고지의무 분석</h4>
            <pre>${JSON.stringify(window.coreEngineResultData.disclosure || {}, null, 2)}</pre>
          </div>
          <div class="col-md-6">
            <h4>AI 요약</h4>
            <pre>${JSON.stringify(window.coreEngineResultData.summary || {}, null, 2)}</pre>
          </div>
        </div>
        <h4>전체 결과</h4>
        <pre>${JSON.stringify(window.coreEngineResultData, null, 2)}</pre>
      </body>
    </html>
  `);
}

// 코어엔진 요약표 다운로드
function downloadCoreEngineReport() {
  if (!window.coreEngineResultData) {
    alert('다운로드할 결과가 없습니다.');
    return;
  }
  
  // 요약표 다운로드 API 호출
  fetch(`${CORE_ENHANCED_API_URL}/job/${currentJobIdCore}/download`)
    .then(response => {
      if (!response.ok) {
        throw new Error('다운로드 실패');
      }
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `core_engine_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })
    .catch(error => {
      console.error('다운로드 오류:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    });
}

// 파일 크기 포맷팅 유틸리티
function formatFileSizeCore(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 전역 함수로 노출 (HTML에서 호출 가능)
window.removeFileCore = removeFileCore;
window.showCoreEngineDetails = showCoreEngineDetails;
window.downloadCoreEngineReport = downloadCoreEngineReport;

// 초기화
document.addEventListener('DOMContentLoaded', initCoreEngineTab);