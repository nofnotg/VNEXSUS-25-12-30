// DOM 요소
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const clearBtn = document.getElementById('clearBtn');
const uploadBtn = document.getElementById('uploadBtn');
const statusContainer = document.getElementById('statusContainer');
const statusSpinner = document.getElementById('statusSpinner');
const resultContainer = document.getElementById('resultContainer');
const resultType = document.getElementById('resultType');

// 설정
const API_URL = 'http://localhost:3000/api/ocr';
const MAX_FILES = 8;
const POLLING_INTERVAL = 2000; // 2초

// 상태 변수
let selectedFiles = [];
let currentJobId = null;
let resultData = null;
let pollingTimeout = null;

// 이벤트 리스너
document.addEventListener('DOMContentLoaded', initApp);

// 앱 초기화
function initApp() {
  // 파일 입력 관련 이벤트
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleFileDrop);
  fileInput.addEventListener('change', handleFileSelect);
  
  // 버튼 이벤트
  clearBtn.addEventListener('click', clearFiles);
  uploadBtn.addEventListener('click', uploadFiles);
  
  // 결과 표시 형식 변경 이벤트
  resultType.addEventListener('change', displayResults);
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
  const pdfFiles = Array.from(fileList).filter(file => 
    file.type === 'application/pdf'
  );
  
  if (selectedFiles.length + pdfFiles.length > MAX_FILES) {
    alert(`최대 ${MAX_FILES}개의 파일만 업로드할 수 있습니다.`);
    return;
  }
  
  // 파일 추가
  pdfFiles.forEach(file => {
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
  
  selectedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <div>
        <strong>${file.name}</strong>
        <small class="text-muted ms-2">(${formatFileSize(file.size)})</small>
      </div>
      <i class="btn-remove" data-index="${index}">×</i>
    `;
    
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
}

// 파일 업로드
async function uploadFiles() {
  try {
    if (selectedFiles.length === 0) return;
    
    // UI 업데이트
    uploadBtn.disabled = true;
    statusSpinner.style.display = 'inline-block';
    updateStatus('info', '파일 업로드 중...');
    
    // FormData 생성
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('pdfs', file);
    });
    
    // API 요청
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '업로드 실패');
    }
    
    const data = await response.json();
    currentJobId = data.jobId;
    
    // 상태 업데이트
    updateStatus('primary', `
      <div>OCR 작업이 시작되었습니다.</div>
      <div><strong>작업 ID:</strong> ${currentJobId}</div>
      <div><strong>상태:</strong> <span id="jobStatus">처리 중</span></div>
      <div><strong>진행률:</strong> <span id="jobProgress">0/${selectedFiles.length}</span> 파일 처리됨</div>
    `);
    
    // 작업 상태 폴링 시작
    startPolling(currentJobId);
    
  } catch (error) {
    console.error('업로드 오류:', error);
    updateStatus('danger', `오류: ${error.message}`);
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
      const response = await fetch(`${API_URL}/status/${jobId}`);
      
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
      
      // 완료 시 결과 가져오기
      if (data.status === 'completed') {
        await fetchResults(jobId);
        return;
      }
      
      // 오류 시 폴링 중단
      if (data.status === 'failed') {
        updateStatus('danger', `OCR 처리 실패: ${data.error || '알 수 없는 오류'}`);
        statusSpinner.style.display = 'none';
        uploadBtn.disabled = false;
        return;
      }
      
      // 계속 폴링
      pollingTimeout = setTimeout(pollStatus, POLLING_INTERVAL);
      
    } catch (error) {
      console.error('상태 확인 오류:', error);
      updateStatus('warning', `상태 확인 오류: ${error.message}`);
      
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
    const response = await fetch(`${API_URL}/result/${jobId}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '결과 가져오기 실패');
    }
    
    const data = await response.json();
    resultData = data;
    
    // UI 업데이트
    updateStatus('success', `OCR 처리 완료! ${Object.keys(data.results).length}개 파일 처리됨`);
    statusSpinner.style.display = 'none';
    uploadBtn.disabled = false;
    
    // 결과 표시
    displayResults();
    
  } catch (error) {
    console.error('결과 가져오기 오류:', error);
    updateStatus('danger', `결과 가져오기 오류: ${error.message}`);
    statusSpinner.style.display = 'none';
    uploadBtn.disabled = false;
  }
}

// 상태 메시지 업데이트
function updateStatus(type, message) {
  statusContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

// 결과 표시
function displayResults() {
  if (!resultData || !resultData.results) {
    resultContainer.innerHTML = '<div class="text-muted">결과가 없습니다.</div>';
    return;
  }
  
  const selected = resultType.value;
  
  if (selected === 'json') {
    // JSON 원본
    resultContainer.innerHTML = `<pre>${JSON.stringify(resultData, null, 2)}</pre>`;
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
    resultContainer.innerHTML = html;
  }
  else {
    // 전체 텍스트
    let combinedText = '';
    Object.entries(resultData.results).forEach(([fileId, fileData]) => {
      combinedText += `\n\n========== 파일: ${fileData.filename} ==========\n\n`;
      combinedText += fileData.mergedText;
    });
    resultContainer.innerHTML = `<pre>${combinedText}</pre>`;
  }
} 