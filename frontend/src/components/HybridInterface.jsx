import React, { useState, useEffect, useRef } from 'react';
import './HybridInterface.css';

const HybridInterface = () => {
  // 상태 관리
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [systemStatus, setSystemStatus] = useState('ready');
  const [config, setConfig] = useState({
    enableDetailedAnalysis: true,
    enablePerformanceMetrics: true,
    qualityThreshold: 0.8,
    enableFallback: true
  });
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // 시스템 상태 모니터링
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        const response = await fetch('/api/hybrid/status');
        const status = await response.json();
        setSystemStatus(status.status);
      } catch (error) {
        console.error('시스템 상태 확인 실패:', error);
        setSystemStatus('error');
      }
    };

    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 30000); // 30초마다 상태 확인
    return () => clearInterval(interval);
  }, []);

  // 파일 드래그 앤 드롭 처리
  const handleDragOver = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('drag-over');
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/') ||
      file.type === 'text/plain'
    );
    
    setFiles(prev => [...prev, ...validFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type
    }))]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 문서 처리 실행
  const processDocuments = async () => {
    if (files.length === 0) {
      alert('처리할 파일을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setResults(null);
    setPerformanceMetrics(null);

    try {
      const formData = new FormData();
      files.forEach(fileItem => {
        formData.append('files', fileItem.file);
      });
      
      formData.append('config', JSON.stringify(config));

      const response = await fetch('/api/hybrid/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`처리 실패: ${response.status}`);
      }

      const result = await response.json();
      setResults(result);
      
      // 성능 메트릭 가져오기
      const metricsResponse = await fetch('/api/hybrid/metrics');
      const metrics = await metricsResponse.json();
      setPerformanceMetrics(metrics);

    } catch (error) {
      console.error('문서 처리 오류:', error);
      alert(`처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 설정 업데이트
  const updateConfig = async (newConfig) => {
    try {
      const response = await fetch('/api/hybrid/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      });

      if (response.ok) {
        setConfig(newConfig);
      }
    } catch (error) {
      console.error('설정 업데이트 실패:', error);
    }
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 신뢰도 색상 계산
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#10b981'; // 녹색
    if (confidence >= 0.6) return '#f59e0b'; // 주황색
    return '#ef4444'; // 빨간색
  };

  return (
    <div className="hybrid-interface">
      {/* 헤더 */}
      <div className="hybrid-header">
        <h2>하이브리드 문서 분석 시스템</h2>
        <div className={`system-status status-${systemStatus}`}>
          <i className={`bi bi-${systemStatus === 'ready' ? 'check-circle' : systemStatus === 'processing' ? 'clock' : 'exclamation-triangle'}`}></i>
          <span>{systemStatus === 'ready' ? '준비됨' : systemStatus === 'processing' ? '처리중' : '오류'}</span>
        </div>
      </div>

      <div className="hybrid-content">
        {/* 설정 패널 */}
         <div className="config-panel">
           <h4>통합 파이프라인 설정</h4>
           
           <div className="config-group">
             <label>
               <input
                 type="checkbox"
                 checked={config.enableDetailedAnalysis}
                 onChange={(e) => updateConfig({...config, enableDetailedAnalysis: e.target.checked})}
                 disabled={isProcessing}
               />
               상세 분석 활성화
             </label>
           </div>

           <div className="config-group">
             <label>
               <input
                 type="checkbox"
                 checked={config.enablePerformanceMetrics}
                 onChange={(e) => updateConfig({...config, enablePerformanceMetrics: e.target.checked})}
                 disabled={isProcessing}
               />
               성능 메트릭 수집
             </label>
           </div>

           <div className="config-group">
             <label>품질 임계값: {Math.round(config.qualityThreshold * 100)}%</label>
             <input
               type="range"
               min="0.5"
               max="1"
               step="0.05"
               value={config.qualityThreshold}
               onChange={(e) => updateConfig({...config, qualityThreshold: parseFloat(e.target.value)})}
               disabled={isProcessing}
             />
           </div>

           <div className="config-group">
             <label>
               <input
                 type="checkbox"
                 checked={config.enableFallback}
                 onChange={(e) => updateConfig({...config, enableFallback: e.target.checked})}
                 disabled={isProcessing}
               />
               폴백 처리 활성화
             </label>
           </div>
         </div>

        {/* 파일 업로드 영역 */}
        <div className="upload-section">
          <div 
            ref={dropZoneRef}
            className="drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="bi bi-cloud-upload"></i>
            <p>파일을 드래그하거나 클릭하여 업로드</p>
            <small>PDF, 이미지, 텍스트 파일 지원</small>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {/* 파일 목록 */}
          {files.length > 0 && (
            <div className="file-list">
              <h5>선택된 파일 ({files.length}개)</h5>
              {files.map(fileItem => (
                <div key={fileItem.id} className="file-item">
                  <div className="file-info">
                    <i className={`bi bi-${fileItem.type.includes('pdf') ? 'file-pdf' : fileItem.type.includes('image') ? 'image' : 'file-text'}`}></i>
                    <span className="file-name">{fileItem.name}</span>
                    <span className="file-size">({formatFileSize(fileItem.size)})</span>
                  </div>
                  <button 
                    className="btn-remove"
                    onClick={() => removeFile(fileItem.id)}
                    disabled={isProcessing}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 처리 버튼 */}
          <button 
            className="process-btn"
            onClick={processDocuments}
            disabled={isProcessing || files.length === 0}
          >
            {isProcessing ? (
              <>
                <i className="bi bi-arrow-clockwise spin"></i>
                처리 중...
              </>
            ) : (
              <>
                <i className="bi bi-play-fill"></i>
                문서 분석 시작
              </>
            )}
          </button>
        </div>

        {/* 결과 표시 영역 */}
        {results && (
          <div className="results-section">
            <h4>분석 결과</h4>
            
            {/* 요약 정보 */}
             <div className="result-summary">
               <div className="summary-card">
                 <h6>처리 모드</h6>
                 <span className="mode-badge mode-unified">
                   통합 파이프라인
                 </span>
               </div>
               
               <div className="summary-card">
                 <h6>품질 점수</h6>
                 <div className="confidence-display">
                   <div 
                     className="confidence-bar"
                     style={{ 
                       width: `${(results.qualityScore || 0) * 100}%`,
                       backgroundColor: getConfidenceColor(results.qualityScore || 0)
                     }}
                   ></div>
                   <span>{Math.round((results.qualityScore || 0) * 100)}%</span>
                 </div>
               </div>
               
               <div className="summary-card">
                 <h6>처리 시간</h6>
                 <span>{results.performanceMetrics?.totalTime || 0}ms</span>
               </div>
             </div>

            {/* 상세 결과 */}
             <div className="detailed-results">
               {results.results?.map((result, index) => (
                 <div key={index} className="result-item">
                   <h6>파일: {result.filename}</h6>
                   
                   {/* 파이프라인 단계별 결과 */}
                   {result.pipelineStages && (
                     <div className="pipeline-stages">
                       <h7>파이프라인 단계</h7>
                       {Object.entries(result.pipelineStages).map(([stage, stageResult]) => (
                         <div key={stage} className="stage-result">
                           <strong>{stage}:</strong>
                           <span className="stage-status">
                             {stageResult.status} ({Math.round((stageResult.confidence || 0) * 100)}%)
                           </span>
                         </div>
                       ))}
                     </div>
                   )}
                   
                   {result.processedData && (
                     <div className="analysis-section">
                       <h7>처리된 데이터</h7>
                       <div className="analysis-content">
                         <p><strong>추출된 날짜:</strong> {result.processedData.dates?.join(', ') || '없음'}</p>
                         <p><strong>의료 정보:</strong> {result.processedData.medicalInfo?.documentType || '미분류'}</p>
                         <p><strong>품질 점수:</strong> {Math.round((result.qualityScore || 0) * 100)}%</p>
                       </div>
                     </div>
                   )}
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* 성능 메트릭 */}
        {performanceMetrics && (
          <div className="metrics-section">
            <h4>성능 메트릭</h4>
            <div className="metrics-grid">
              <div className="metric-card">
                <h6>총 처리 시간</h6>
                <span className="metric-value">{performanceMetrics.totalTime || 0}ms</span>
              </div>
              <div className="metric-card">
                <h6>파이프라인 효율성</h6>
                <span className="metric-value">{Math.round((performanceMetrics.efficiency || 0) * 100)}%</span>
              </div>
              <div className="metric-card">
                <h6>평균 품질 점수</h6>
                <span className="metric-value">{Math.round((performanceMetrics.averageQuality || 0) * 100)}%</span>
              </div>
              <div className="metric-card">
                <h6>처리된 문서</h6>
                <span className="metric-value">{performanceMetrics.processedDocuments || 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HybridInterface;