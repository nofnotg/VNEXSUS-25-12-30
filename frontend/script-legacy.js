// 기존 후처리 로직 전용 스크립트
// Legacy Post-processing Pipeline Script

// DOM 요소 (Legacy Tab)
const dropZoneLegacy = document.getElementById('dropZoneLegacy');
const fileInputLegacy = document.getElementById('fileInputLegacy');
const fileListLegacy = document.getElementById('fileListLegacy');
const fileCountLegacy = document.getElementById('fileCountLegacy');
const toggleFilesBtnLegacy = document.getElementById('toggleFilesBtnLegacy');
const clearBtnLegacy = document.getElementById('clearBtnLegacy');
const uploadBtnLegacy = document.getElementById('uploadBtnLegacy');

// 설정
const LEGACY_API_URL = 'http://localhost:3030/api';
const LEGACY_OCR_API_URL = `${LEGACY_API_URL}/ocr`;
const LEGACY_POSTPROCESS_API_URL = `${LEGACY_API_URL}/postprocess`;

// 상태 변수 (Legacy)
let selectedFilesLegacy = [];
let currentJobIdLegacy = null;
let pollingTimeoutLegacy = null;

// 기존 후처리 로직 초기화
function initLegacyTab() {
  console.log('기존 후처리 탭 초기화');
  
  // 이벤트 리스너 등록
  if (dropZoneLegacy) {
    dropZoneLegacy.addEventListener('click', () => fileInputLegacy?.click());
    dropZoneLegacy.addEventListener('dragover', handleDragOverLegacy);
    dropZoneLegacy.addEventListener('drop', handleDropLegacy);
  }
  
  if (fileInputLegacy) {
    fileInputLegacy.addEventListener('change', handleFileSelectLegacy);
  }
  
  if (clearBtnLegacy) {
    clearBtnLegacy.addEventListener('click', clearFilesLegacy);
  }
  
  if (uploadBtnLegacy) {
    uploadBtnLegacy.addEventListener('click', uploadFilesLegacy);
  }
  
  if (toggleFilesBtnLegacy) {
    toggleFilesBtnLegacy.addEventListener('click', toggleFileListLegacy);
  }
}

// 드래그 오버 처리 (Legacy)
function handleDragOverLegacy(e) {
  e.preventDefault();
  dropZoneLegacy.classList.add('drag-over');
}

// 드롭 처리 (Legacy)
function handleDropLegacy(e) {
  e.preventDefault();
  dropZoneLegacy.classList.remove('drag-over');
  
  const files = Array.from(e.dataTransfer.files);
  addFilesLegacy(files);
}

// 파일 선택 처리 (Legacy)
function handleFileSelectLegacy(e) {
  const files = Array.from(e.target.files);
  addFilesLegacy(files);
}

// 파일 추가 (Legacy)
function addFilesLegacy(files) {
  const validFiles = files.filter(file => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/tif'];
    return validTypes.includes(file.type);
  });
  
  if (validFiles.length !== files.length) {
    alert('지원되지 않는 파일 형식이 포함되어 있습니다. PDF, JPG, PNG, BMP, TIFF 파일만 업로드 가능합니다.');
  }
  
  // 중복 파일 제거
  validFiles.forEach(file => {
    const isDuplicate = selectedFilesLegacy.some(existingFile => 
      existingFile.name === file.name && existingFile.size === file.size
    );
    
    if (!isDuplicate) {
      selectedFilesLegacy.push(file);
    }
  });
  
  updateFileListLegacy();
  updateUploadButtonLegacy();
}

// 파일 목록 업데이트 (Legacy)
function updateFileListLegacy() {
  if (!fileCountLegacy || !fileListLegacy) return;
  
  fileCountLegacy.textContent = `${selectedFilesLegacy.length}개 파일 선택됨`;
  
  if (selectedFilesLegacy.length === 0) {
    fileListLegacy.innerHTML = '';
    if (toggleFilesBtnLegacy) toggleFilesBtnLegacy.style.display = 'none';
    return;
  }
  
  if (toggleFilesBtnLegacy) toggleFilesBtnLegacy.style.display = 'block';
  
  fileListLegacy.innerHTML = selectedFilesLegacy.map((file, index) => `
    <div class="file-item d-flex justify-content-between align-items-center p-2 border rounded mb-1">
      <div>
        <i class="bi bi-file-earmark-pdf text-danger me-2"></i>
        <span class="file-name">${file.name}</span>
        <small class="text-muted ms-2">(${formatFileSize(file.size)})</small>
      </div>
      <button class="btn btn-sm btn-outline-danger" onclick="removeFileLegacy(${index})">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join('');
}

// 파일 제거 (Legacy)
function removeFileLegacy(index) {
  selectedFilesLegacy.splice(index, 1);
  updateFileListLegacy();
  updateUploadButtonLegacy();
}

// 모든 파일 지우기 (Legacy)
function clearFilesLegacy() {
  selectedFilesLegacy = [];
  updateFileListLegacy();
  updateUploadButtonLegacy();
  
  if (fileInputLegacy) {
    fileInputLegacy.value = '';
  }
}

// 업로드 버튼 상태 업데이트 (Legacy)
function updateUploadButtonLegacy() {
  if (uploadBtnLegacy) {
    uploadBtnLegacy.disabled = selectedFilesLegacy.length === 0;
  }
}

// 파일 목록 토글 (Legacy)
function toggleFileListLegacy() {
  if (!fileListLegacy) return;
  
  const isCollapsed = fileListLegacy.classList.contains('collapsed-files');
  
  if (isCollapsed) {
    fileListLegacy.classList.remove('collapsed-files');
    if (toggleFilesBtnLegacy) toggleFilesBtnLegacy.textContent = '접기';
  } else {
    fileListLegacy.classList.add('collapsed-files');
    if (toggleFilesBtnLegacy) toggleFilesBtnLegacy.textContent = '펼치기';
  }
}

// 기존 후처리 업로드 함수
async function uploadFilesLegacy() {
  if (selectedFilesLegacy.length === 0) {
    alert('업로드할 파일을 선택해주세요.');
    return;
  }
  
  console.log('기존 후처리 업로드 시작:', selectedFilesLegacy.length, '개 파일');
  
  const formData = new FormData();
  selectedFilesLegacy.forEach(file => {
    formData.append('files', file);
  });
  
  try {
    // 기존 OCR API 사용
    const response = await fetch(`${LEGACY_OCR_API_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.jobId) {
      currentJobIdLegacy = result.jobId;
      
      // UI 업데이트
      if (uploadBtnLegacy) {
        uploadBtnLegacy.disabled = true;
        uploadBtnLegacy.textContent = '처리 중...';
      }
      
      // 상태 폴링 시작
      startPollingLegacy(result.jobId);
      
      console.log('기존 후처리 업로드 성공:', result);
    } else {
      throw new Error('Job ID를 받지 못했습니다.');
    }
    
  } catch (error) {
    console.error('기존 후처리 업로드 오류:', error);
    alert(`업로드 중 오류가 발생했습니다: ${error.message}`);
    
    // UI 복원
    if (uploadBtnLegacy) {
      uploadBtnLegacy.disabled = false;
      uploadBtnLegacy.textContent = '문서 분석 시작';
    }
  }
}

// 기존 후처리 폴링 함수
function startPollingLegacy(jobId) {
  const pollStatus = async () => {
    try {
      const response = await fetch(`${LEGACY_OCR_API_URL}/job/${jobId}/status`);
      const data = await response.json();
      
      console.log('기존 후처리 폴링 상태:', data);
      
      // 진행률 업데이트
      if (data.progress !== undefined) {
        updateProgressLegacy(data.progress, data.status);
      }
      
      if (data.status === 'completed') {
        // 결과 가져오기
        const resultResponse = await fetch(`${LEGACY_OCR_API_URL}/job/${jobId}/result`);
        const resultData = await resultResponse.json();
        
        handleLegacyResults(resultData);
        
      } else if (data.status === 'error') {
        throw new Error(data.error || '처리 중 오류가 발생했습니다.');
        
      } else {
        // 계속 폴링
        pollingTimeoutLegacy = setTimeout(pollStatus, 2000);
      }
      
    } catch (error) {
      console.error('기존 후처리 폴링 오류:', error);
      alert(`상태 확인 중 오류가 발생했습니다: ${error.message}`);
      
      // UI 복원
      if (uploadBtnLegacy) {
        uploadBtnLegacy.disabled = false;
        uploadBtnLegacy.textContent = '문서 분석 시작';
      }
    }
  };
  
  pollStatus();
}

// 진행률 업데이트 (Legacy)
function updateProgressLegacy(progress, status) {
  const progressBar = document.getElementById('progressBarLegacy');
  const progressStatus = document.getElementById('progressStatusLegacy');
  const progressContainer = document.getElementById('legacyProgressContainer');
  
  // 프로그레스 컨테이너 표시
  if (progressContainer) {
    progressContainer.style.display = 'block';
  }
  
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
    progressBar.setAttribute('aria-valuenow', progress);
  }
  
  if (progressStatus) {
    progressStatus.textContent = `기존 후처리: ${status}`;
  }
}

// 기존 후처리 결과 처리
function handleLegacyResults(resultData) {
  console.log('기존 후처리 결과:', resultData);
  
  // UI 복원
  if (uploadBtnLegacy) {
    uploadBtnLegacy.disabled = false;
    uploadBtnLegacy.textContent = '문서 분석 시작';
  }
  
  // 결과 표시
  displayLegacyResults(resultData);
}

// 기존 후처리 결과 표시
function displayLegacyResults(resultData) {
  const statusContainer = document.getElementById('statusContainer');
  
  if (statusContainer) {
    statusContainer.innerHTML = `
      <div class="alert alert-success">
        <h6><i class="bi bi-check-circle"></i> 기존 후처리 완료</h6>
        <p>총 ${Object.keys(resultData).length}개 파일이 처리되었습니다.</p>
        <button class="btn btn-sm btn-primary" onclick="showLegacyDetails()">상세 결과 보기</button>
      </div>
    `;
  }
  
  // 전역 변수에 결과 저장
  window.legacyResultData = resultData;
}

// 기존 후처리 상세 결과 표시
function showLegacyDetails() {
  if (!window.legacyResultData) return;
  
  // 모달 또는 새 창에서 결과 표시
  const newWindow = window.open('', '_blank', 'width=1200,height=800');
  newWindow.document.write(`
    <html>
      <head>
        <title>기존 후처리 결과</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="p-4">
        <h2>기존 후처리 결과</h2>
        <pre>${JSON.stringify(window.legacyResultData, null, 2)}</pre>
      </body>
    </html>
  `);
}

// 파일 크기 포맷팅 유틸리티
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 전역 함수로 노출 (HTML에서 호출 가능)
window.removeFileLegacy = removeFileLegacy;
window.showLegacyDetails = showLegacyDetails;

// 초기화
document.addEventListener('DOMContentLoaded', initLegacyTab);