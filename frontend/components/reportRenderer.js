/**
 * 의료 문서 보고서 렌더링 컴포넌트
 * 개선된 보험 정보 검증 및 시각화 기능 통합
 */

// 네임스페이스 사용 및 중복 방지
window.VNEXSUSApp = window.VNEXSUSApp || {};

if (!window.VNEXSUSApp.ReportRenderer) {
  window.VNEXSUSApp.ReportRenderer = class ReportRenderer {
    constructor() {
        this.visualizationComponents = new window.VNEXSUSApp.VisualizationComponents();
        this.currentReport = null;
        this.filters = {
            dateRange: 'all',
            insuranceStatus: 'all',
            validationStatus: 'all'
        };
    }

    /**
     * 보고서 렌더링
     * @param {Object} reportData - 정규화된 보고서 데이터
     * @param {HTMLElement} container - 렌더링할 컨테이너
     */
    renderReport(reportData, container) {
        this.currentReport = reportData;
        
        // 컨테이너 초기화
        container.innerHTML = '';
        container.className = 'medical-report-container';
        
        // 반응형 레이아웃 적용
        this.visualizationComponents.applyResponsiveLayout(container);
        
        // 보고서 헤더 렌더링
        const header = this.renderHeader(reportData);
        container.appendChild(header);
        
        // 필터 컨트롤 렌더링
        const filters = this.renderFilters();
        container.appendChild(filters);
        
        // 보험 정보 검증 통계 렌더링
        if (reportData.insuranceValidationStats) {
            const statsChart = this.visualizationComponents.createStatsChart(reportData.insuranceValidationStats);
            container.appendChild(statsChart);
        }
        
        // 환자 정보 렌더링
        if (reportData.patientInfo) {
            const patientSection = this.renderPatientInfo(reportData.patientInfo);
            container.appendChild(patientSection);
        }
        
        // 보험 정보 렌더링
        if (reportData.insuranceInfo) {
            const insuranceSection = this.renderInsuranceInfo(reportData.insuranceInfo);
            container.appendChild(insuranceSection);
        }
        
        // 의료 기록 타임라인 렌더링
        if (reportData.medicalRecords && reportData.medicalRecords.length > 0) {
            const timeline = this.renderMedicalTimeline(reportData.medicalRecords);
            container.appendChild(timeline);
        }
        
        // 추가 노트 렌더링
        if (reportData.additionalNotes) {
            const notesSection = this.renderAdditionalNotes(reportData.additionalNotes);
            container.appendChild(notesSection);
        }
        
        // 접근성 개선
        this.enhanceAccessibility(container);
    }

    /**
     * 보고서 헤더 렌더링
     * @param {Object} reportData - 보고서 데이터
     * @returns {HTMLElement} 헤더 요소
     */
    renderHeader(reportData) {
        const header = document.createElement('header');
        header.className = 'report-header';
        header.setAttribute('role', 'banner');
        
        header.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            border-radius: 12px;
            margin-bottom: 24px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        const currentDate = new Date().toLocaleDateString('ko-KR');
        
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                <div>
                    <h1 style="
                        margin: 0 0 8px 0;
                        font-size: 28px;
                        font-weight: 700;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">의료 문서 분석 보고서</h1>
                    <p style="
                        margin: 0;
                        font-size: 16px;
                        opacity: 0.9;
                    ">AI 기반 보험 정보 검증 및 시각화 시스템</p>
                </div>
                <div style="text-align: right;">
                    <div style="
                        background: rgba(255,255,255,0.2);
                        padding: 8px 16px;
                        border-radius: 20px;
                        font-size: 14px;
                        backdrop-filter: blur(10px);
                    ">
                        생성일: ${currentDate}
                    </div>
                </div>
            </div>
        `;
        
        return header;
    }

    /**
     * 필터 컨트롤 렌더링
     * @returns {HTMLElement} 필터 요소
     */
    renderFilters() {
        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'report-filters';
        filtersContainer.setAttribute('role', 'region');
        filtersContainer.setAttribute('aria-label', '보고서 필터');
        
        filtersContainer.style.cssText = `
            background: white;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
            align-items: center;
        `;
        
        filtersContainer.innerHTML = `
            <div style="font-weight: 600; color: #333;">필터:</div>
            
            <div class="filter-group">
                <label for="date-filter" style="margin-right: 8px; font-size: 14px;">기간:</label>
                <select id="date-filter" style="
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                ">
                    <option value="all">전체</option>
                    <option value="within_3months">최근 3개월</option>
                    <option value="within_5years">최근 5년</option>
                    <option value="before_5years">5년 이전</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label for="insurance-filter" style="margin-right: 8px; font-size: 14px;">보험 상태:</label>
                <select id="insurance-filter" style="
                    padding: 6px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                ">
                    <option value="all">전체</option>
                    <option value="valid">유효</option>
                    <option value="invalid">무효</option>
                    <option value="corrected">보정됨</option>
                    <option value="filtered_out">필터링됨</option>
                </select>
            </div>
            
            <button id="reset-filters" style="
                background: #6c757d;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 14px;
                cursor: pointer;
                margin-left: auto;
            ">필터 초기화</button>
        `;
        
        // 필터 이벤트 리스너 추가
        this.attachFilterListeners(filtersContainer);
        
        return filtersContainer;
    }

    /**
     * 환자 정보 렌더링
     * @param {Object} patientInfo - 환자 정보
     * @returns {HTMLElement} 환자 정보 섹션
     */
    renderPatientInfo(patientInfo) {
        const section = document.createElement('section');
        section.className = 'patient-info-section';
        section.setAttribute('aria-labelledby', 'patient-info-title');
        
        section.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        section.innerHTML = `
            <h2 id="patient-info-title" style="
                margin: 0 0 16px 0;
                color: #333;
                font-size: 20px;
                font-weight: 600;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 8px;
            ">환자 정보</h2>
            
            <div class="patient-details" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
            ">
                ${patientInfo.name ? `<div class="detail-item">
                    <strong>이름:</strong> ${patientInfo.name}
                </div>` : ''}
                
                ${patientInfo.birthDate ? `<div class="detail-item">
                    <strong>생년월일:</strong> ${patientInfo.birthDate}
                </div>` : ''}
                
                ${patientInfo.gender ? `<div class="detail-item">
                    <strong>성별:</strong> ${patientInfo.gender}
                </div>` : ''}
                
                ${patientInfo.address ? `<div class="detail-item">
                    <strong>주소:</strong> ${patientInfo.address}
                </div>` : ''}
                
                ${patientInfo.phone ? `<div class="detail-item">
                    <strong>연락처:</strong> ${patientInfo.phone}
                </div>` : ''}
            </div>
        `;
        
        return section;
    }

    /**
     * 보험 정보 렌더링
     * @param {Object} insuranceInfo - 보험 정보
     * @returns {HTMLElement} 보험 정보 섹션
     */
    renderInsuranceInfo(insuranceInfo) {
        const section = document.createElement('section');
        section.className = 'insurance-info-section';
        section.setAttribute('aria-labelledby', 'insurance-info-title');
        
        section.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        let insuranceContent = `
            <h2 id="insurance-info-title" style="
                margin: 0 0 16px 0;
                color: #333;
                font-size: 20px;
                font-weight: 600;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 8px;
            ">보험 정보</h2>
        `;
        
        if (Array.isArray(insuranceInfo)) {
            insuranceInfo.forEach((insurance, index) => {
                insuranceContent += this.renderSingleInsurance(insurance, index);
            });
        } else {
            insuranceContent += this.renderSingleInsurance(insuranceInfo, 0);
        }
        
        section.innerHTML = insuranceContent;
        return section;
    }

    /**
     * 단일 보험 정보 렌더링
     * @param {Object} insurance - 보험 정보
     * @param {number} index - 인덱스
     * @returns {string} 보험 정보 HTML
     */
    renderSingleInsurance(insurance, index) {
        const validationBadge = insurance.validation ? 
            this.visualizationComponents.createValidationBadge(insurance.validation).outerHTML : '';
        
        return `
            <div class="insurance-item" style="
                border: 1px solid #e9ecef;
                border-radius: 6px;
                padding: 16px;
                margin-bottom: 12px;
                background: #f8f9fa;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; color: #495057; font-size: 16px;">
                        보험 ${index + 1}
                    </h3>
                    ${validationBadge}
                </div>
                
                <div class="insurance-details" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 12px;
                ">
                    ${insurance.company ? `<div class="detail-item">
                        <strong>보험사:</strong> ${insurance.company}
                    </div>` : ''}
                    
                    ${insurance.joinDate ? `<div class="detail-item">
                        <strong>가입일:</strong> ${insurance.joinDate}
                    </div>` : ''}
                    
                    ${insurance.product ? `<div class="detail-item">
                        <strong>상품명:</strong> ${insurance.product}
                    </div>` : ''}
                    
                    ${insurance.claimDate ? `<div class="detail-item">
                        <strong>청구일:</strong> ${insurance.claimDate}
                    </div>` : ''}
                    
                    ${insurance.amount ? `<div class="detail-item">
                        <strong>청구금액:</strong> ${insurance.amount}
                    </div>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * 의료 기록 타임라인 렌더링
     * @param {Array} medicalRecords - 의료 기록 배열
     * @returns {HTMLElement} 타임라인 섹션
     */
    renderMedicalTimeline(medicalRecords) {
        const section = document.createElement('section');
        section.className = 'medical-timeline-section';
        section.setAttribute('aria-labelledby', 'timeline-title');
        
        section.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        const title = document.createElement('h2');
        title.id = 'timeline-title';
        title.textContent = '의료 기록 타임라인';
        title.style.cssText = `
            margin: 0 0 20px 0;
            color: #333;
            font-size: 20px;
            font-weight: 600;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 8px;
        `;
        
        section.appendChild(title);
        
        const timeline = document.createElement('div');
        timeline.className = 'medical-timeline';
        timeline.setAttribute('role', 'list');
        
        // 필터링된 기록만 표시
        const filteredRecords = this.filterMedicalRecords(medicalRecords);
        
        if (filteredRecords.length === 0) {
            timeline.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px;
                    color: #6c757d;
                    font-style: italic;
                ">
                    선택한 필터 조건에 맞는 의료 기록이 없습니다.
                </div>
            `;
        } else {
            filteredRecords.forEach(record => {
                if (record.visualization) {
                    const card = this.visualizationComponents.createTimelineCard(record, record.visualization);
                    card.setAttribute('role', 'listitem');
                    timeline.appendChild(card);
                }
            });
        }
        
        section.appendChild(timeline);
        return section;
    }

    /**
     * 추가 노트 렌더링
     * @param {string} notes - 추가 노트
     * @returns {HTMLElement} 노트 섹션
     */
    renderAdditionalNotes(notes) {
        const section = document.createElement('section');
        section.className = 'additional-notes-section';
        section.setAttribute('aria-labelledby', 'notes-title');
        
        section.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        section.innerHTML = `
            <h2 id="notes-title" style="
                margin: 0 0 16px 0;
                color: #333;
                font-size: 20px;
                font-weight: 600;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 8px;
            ">추가 노트</h2>
            
            <div class="notes-content" style="
                background: #f8f9fa;
                padding: 16px;
                border-radius: 6px;
                border-left: 4px solid #17a2b8;
                line-height: 1.6;
                color: #495057;
            ">
                ${notes.replace(/\n/g, '<br>')}
            </div>
        `;
        
        return section;
    }

    /**
     * 필터 이벤트 리스너 연결
     * @param {HTMLElement} filtersContainer - 필터 컨테이너
     */
    attachFilterListeners(filtersContainer) {
        const dateFilter = filtersContainer.querySelector('#date-filter');
        const insuranceFilter = filtersContainer.querySelector('#insurance-filter');
        const resetButton = filtersContainer.querySelector('#reset-filters');
        
        dateFilter.addEventListener('change', (e) => {
            this.filters.dateRange = e.target.value;
            this.applyFilters();
        });
        
        insuranceFilter.addEventListener('change', (e) => {
            this.filters.validationStatus = e.target.value;
            this.applyFilters();
        });
        
        resetButton.addEventListener('click', () => {
            this.resetFilters();
            dateFilter.value = 'all';
            insuranceFilter.value = 'all';
        });
    }

    /**
     * 필터 적용
     */
    applyFilters() {
        if (this.currentReport) {
            const container = document.querySelector('.medical-report-container');
            if (container) {
                this.renderReport(this.currentReport, container);
            }
        }
    }

    /**
     * 필터 초기화
     */
    resetFilters() {
        this.filters = {
            dateRange: 'all',
            insuranceStatus: 'all',
            validationStatus: 'all'
        };
        this.applyFilters();
    }

    /**
     * 의료 기록 필터링
     * @param {Array} records - 의료 기록 배열
     * @returns {Array} 필터링된 기록 배열
     */
    filterMedicalRecords(records) {
        return records.filter(record => {
            // 날짜 범위 필터
            if (this.filters.dateRange !== 'all' && record.visualization) {
                if (record.visualization.category !== this.filters.dateRange) {
                    return false;
                }
            }
            
            // 검증 상태 필터
            if (this.filters.validationStatus !== 'all' && record.validation) {
                if (record.validation.status !== this.filters.validationStatus) {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * 접근성 개선
     * @param {HTMLElement} container - 컨테이너 요소
     */
    enhanceAccessibility(container) {
        // 키보드 네비게이션 개선
        const focusableElements = container.querySelectorAll(
            'button, select, input, [tabindex]:not([tabindex="-1"])'
        );
        
        focusableElements.forEach((element, index) => {
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    // Tab 키 네비게이션 개선 로직
                }
            });
        });
        
        // 스크린 리더를 위한 라이브 영역 설정
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        container.appendChild(liveRegion);
        
        // 필터 변경 시 스크린 리더에 알림
        this.liveRegion = liveRegion;
    }

    /**
     * 보고서 내보내기
     * @param {string} format - 내보내기 형식 ('pdf', 'html', 'json')
     */
    exportReport(format = 'html') {
        if (!this.currentReport) {
            console.error('내보낼 보고서가 없습니다.');
            return;
        }
        
        switch (format) {
            case 'html':
                this.exportAsHTML();
                break;
            case 'pdf':
                this.exportAsPDF();
                break;
            case 'json':
                this.exportAsJSON();
                break;
            default:
                console.error('지원하지 않는 형식입니다:', format);
        }
    }

    /**
     * HTML로 내보내기
     */
    exportAsHTML() {
        const container = document.querySelector('.medical-report-container');
        if (container) {
            const htmlContent = `
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>의료 문서 분석 보고서</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
                        .medical-report-container { max-width: 1200px; margin: 0 auto; }
                    </style>
                </head>
                <body>
                    ${container.innerHTML}
                </body>
                </html>
            `;
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medical_report_${new Date().toISOString().split('T')[0]}.html`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * JSON으로 내보내기
     */
    exportAsJSON() {
        const jsonContent = JSON.stringify(this.currentReport, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `medical_report_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
}

}

}

// 전역 사용을 위한 내보내기 (네임스페이스 사용으로 제거)
// 이제 window.VNEXSUSApp.ReportRenderer를 통해 접근
// 이제 window.VNEXSUSApp.ReportRenderer를 통해 접근