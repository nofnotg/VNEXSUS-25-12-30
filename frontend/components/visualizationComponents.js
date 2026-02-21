/**
 * 보험 정보 처리 시스템 시각화 컴포넌트
 * WCAG 접근성 기준을 준수하는 색상 대비와 시각화 요소 제공
 */

// 네임스페이스 사용 및 중복 방지
window.VNEXSUSApp = window.VNEXSUSApp || {};

if (!window.VNEXSUSApp.VisualizationComponents) {
  window.VNEXSUSApp.VisualizationComponents = class VisualizationComponents {
    constructor() {
        this.colorScheme = {
            // 보험 가입 후 이벤트 (안전)
            after_join: {
                primary: '#28a745',
                secondary: '#d4edda',
                text: '#155724',
                border: '#c3e6cb',
                contrast: 7.2 // WCAG AAA 준수
            },
            // 가입 3개월 이내 (🔴 빨간 — 고지의무위반 우려)
            within_3months: {
                primary: '#ef4444',
                secondary: '#fee2e2',
                text: '#b91c1c',
                border: '#fca5a5',
                contrast: 6.5 // WCAG AA 준수
            },
            // 가입 5년 이내 (🟠 주황 — 주의)
            within_5years: {
                primary: '#f97316',
                secondary: '#ffedd5',
                text: '#c2410c',
                border: '#fdba74',
                contrast: 5.1 // WCAG AA 준수
            },
            // 가입 5년 이전 (중성)
            before_5years: {
                primary: '#6c757d',
                secondary: '#e2e3e5',
                text: '#383d41',
                border: '#d6d8db',
                contrast: 4.8 // WCAG AA 준수
            },
            // 정보 없음 (오류)
            unknown: {
                primary: '#dc3545',
                secondary: '#f8d7da',
                text: '#721c24',
                border: '#f5c6cb',
                contrast: 5.9 // WCAG AA 준수
            }
        };
        
        this.icons = {
            after_join: '🟢',
            within_3months: '🔴',
            within_5years: '🟠',
            before_5years: '📅',
            unknown: '❓'
        };
    }

    /**
     * 이벤트 타임라인 카드 생성
     * @param {Object} event - 의료 이벤트 데이터
     * @param {Object} visualization - 시각화 정보
     * @returns {HTMLElement} 타임라인 카드 요소
     */
    createTimelineCard(event, visualization) {
        const card = document.createElement('div');
        const colors = this.colorScheme[visualization.category] || this.colorScheme.unknown;
        
        card.className = 'timeline-card';
        card.setAttribute('role', 'article');
        card.setAttribute('aria-label', `${event.date} 의료 이벤트: ${visualization.description}`);
        
        card.style.cssText = `
            background-color: ${colors.secondary};
            border-left: 4px solid ${colors.primary};
            border-radius: 8px;
            padding: 16px;
            margin: 12px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            position: relative;
        `;
        
        // 호버 효과
        card.addEventListener('mouseenter', () => {
            card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            card.style.transform = 'translateY(-2px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            card.style.transform = 'translateY(0)';
        });
        
        // 카드 내용 구성
        card.innerHTML = `
            <div class="timeline-header" style="
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                color: ${colors.text};
                font-weight: 600;
            ">
                <span class="timeline-icon" style="
                    font-size: 20px;
                    margin-right: 8px;
                    display: inline-block;
                    width: 24px;
                    text-align: center;
                " aria-hidden="true">${this.icons[visualization.category]}</span>
                <span class="timeline-date" style="
                    font-size: 16px;
                    color: ${colors.text};
                ">${event.date}</span>
                <span class="timeline-period" style="
                    background-color: ${colors.primary};
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    margin-left: auto;
                    font-weight: 500;
                ">${visualization.period}</span>
            </div>
            
            <div class="timeline-content" style="
                color: ${colors.text};
                line-height: 1.5;
            ">
                ${event.hospital ? `<div class="hospital-info" style="margin-bottom: 8px;">
                    <strong>병원:</strong> ${event.hospital}
                </div>` : ''}
                
                ${event.diagnosis ? `<div class="diagnosis-info" style="margin-bottom: 8px;">
                    <strong>진단:</strong> ${event.diagnosis}
                </div>` : ''}
                
                ${event.treatment ? `<div class="treatment-info" style="margin-bottom: 8px;">
                    <strong>치료:</strong> ${event.treatment}
                </div>` : ''}
                
                ${event.prescription ? `<div class="prescription-info" style="margin-bottom: 8px;">
                    <strong>처방:</strong> ${event.prescription}
                </div>` : ''}
            </div>
            
            <div class="timeline-description" style="
                font-size: 12px;
                color: ${colors.text};
                opacity: 0.8;
                margin-top: 8px;
                font-style: italic;
            ">${visualization.description}</div>
        `;
        
        return card;
    }

    /**
     * 보험사 검증 상태 배지 생성
     * @param {Object} validation - 검증 정보
     * @returns {HTMLElement} 검증 상태 배지
     */
    createValidationBadge(validation) {
        const badge = document.createElement('span');
        badge.className = 'validation-badge';
        badge.setAttribute('role', 'status');
        
        let badgeColor, badgeText, badgeIcon;
        
        switch (validation.status) {
            case 'valid':
                badgeColor = '#28a745';
                badgeText = '검증됨';
                badgeIcon = '✓';
                break;
            case 'corrected':
                badgeColor = '#ffc107';
                badgeText = '보정됨';
                badgeIcon = '⚡';
                break;
            case 'filtered_out':
                badgeColor = '#dc3545';
                badgeText = '필터링됨';
                badgeIcon = '🚫';
                break;
            case 'invalid':
                badgeColor = '#6c757d';
                badgeText = '무효';
                badgeIcon = '❌';
                break;
            default:
                badgeColor = '#6c757d';
                badgeText = '알 수 없음';
                badgeIcon = '?';
        }
        
        badge.style.cssText = `
            background-color: ${badgeColor};
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: 8px;
        `;
        
        badge.innerHTML = `
            <span aria-hidden="true">${badgeIcon}</span>
            <span>${badgeText}</span>
        `;
        
        // 툴팁 추가
        badge.title = `신뢰도: ${Math.round(validation.confidence * 100)}%`;
        if (validation.originalInput && validation.originalInput !== validation.correctedInput) {
            badge.title += `\n원본: ${validation.originalInput}`;
        }
        
        return badge;
    }

    /**
     * 통계 차트 생성
     * @param {Object} stats - 통계 데이터
     * @returns {HTMLElement} 차트 요소
     */
    createStatsChart(stats) {
        const container = document.createElement('div');
        container.className = 'stats-chart';
        container.setAttribute('role', 'img');
        container.setAttribute('aria-label', '보험 정보 검증 통계 차트');
        
        container.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 16px 0;
        `;
        
        const total = stats.total || 1;
        const validPercentage = Math.round((stats.valid / total) * 100);
        const invalidPercentage = Math.round((stats.invalid / total) * 100);
        const filteredPercentage = Math.round((stats.filteredOut / total) * 100);
        
        container.innerHTML = `
            <h3 style="
                margin: 0 0 16px 0;
                color: #333;
                font-size: 18px;
                font-weight: 600;
            ">보험 정보 검증 통계</h3>
            
            <div class="stats-summary" style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            ">
                <div class="stat-item" style="
                    text-align: center;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 6px;
                ">
                    <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.valid}</div>
                    <div style="font-size: 12px; color: #666;">유효</div>
                </div>
                
                <div class="stat-item" style="
                    text-align: center;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 6px;
                ">
                    <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${stats.invalid}</div>
                    <div style="font-size: 12px; color: #666;">무효</div>
                </div>
                
                <div class="stat-item" style="
                    text-align: center;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 6px;
                ">
                    <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${stats.corrected}</div>
                    <div style="font-size: 12px; color: #666;">보정됨</div>
                </div>
                
                <div class="stat-item" style="
                    text-align: center;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 6px;
                ">
                    <div style="font-size: 24px; font-weight: bold; color: #6c757d;">${stats.filteredOut}</div>
                    <div style="font-size: 12px; color: #666;">필터링됨</div>
                </div>
            </div>
            
            <div class="progress-bar" style="
                background: #e9ecef;
                border-radius: 10px;
                height: 20px;
                overflow: hidden;
                display: flex;
            ">
                <div style="
                    background: #28a745;
                    width: ${validPercentage}%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                " title="유효: ${validPercentage}%">${validPercentage > 10 ? validPercentage + '%' : ''}</div>
                
                <div style="
                    background: #dc3545;
                    width: ${invalidPercentage}%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                " title="무효: ${invalidPercentage}%">${invalidPercentage > 10 ? invalidPercentage + '%' : ''}</div>
                
                <div style="
                    background: #6c757d;
                    width: ${filteredPercentage}%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                " title="필터링됨: ${filteredPercentage}%">${filteredPercentage > 10 ? filteredPercentage + '%' : ''}</div>
            </div>
        `;
        
        return container;
    }

    /**
     * 접근성 준수 색상 대비 검증
     * @param {string} backgroundColor - 배경색
     * @param {string} textColor - 텍스트색
     * @returns {Object} 접근성 검증 결과
     */
    validateColorContrast(backgroundColor, textColor) {
        // 간단한 색상 대비 계산 (실제로는 더 정확한 계산 필요)
        const bgLuminance = this.calculateLuminance(backgroundColor);
        const textLuminance = this.calculateLuminance(textColor);
        
        const ratio = (Math.max(bgLuminance, textLuminance) + 0.05) / 
                     (Math.min(bgLuminance, textLuminance) + 0.05);
        
        return {
            ratio: Math.round(ratio * 10) / 10,
            isAccessible: ratio >= 4.5,
            level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fail',
            recommendation: ratio < 4.5 ? '색상 대비를 높여주세요' : '접근성 기준을 만족합니다'
        };
    }

    /**
     * 색상 휘도 계산
     * @param {string} color - 색상 값
     * @returns {number} 휘도 값
     */
    calculateLuminance(color) {
        // 간단한 휘도 계산 (실제로는 더 정확한 계산 필요)
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * 반응형 레이아웃 적용
     * @param {HTMLElement} container - 컨테이너 요소
     */
    applyResponsiveLayout(container) {
        const style = document.createElement('style');
        style.textContent = `
            .medical-report-container {
                overflow-y: auto;
                max-height: 80vh;
                font-size: 1.06rem;
                line-height: 1.7;
                word-break: break-word;
                padding: 8px;
            }
            @media (max-width: 768px) {
                .timeline-card {
                    margin: 8px 0 !important;
                    padding: 12px !important;
                }
                
                .timeline-header {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                }
                
                .timeline-period {
                    margin-left: 0 !important;
                    margin-top: 8px !important;
                }
                
                .stats-chart .stats-summary {
                    grid-template-columns: repeat(2, 1fr) !important;
                }
            }
            
            @media (max-width: 480px) {
                .stats-chart .stats-summary {
                    grid-template-columns: 1fr !important;
                }
            }
        `;
        
        document.head.appendChild(style);
}

}

}

// 전역 사용을 위한 내보내기 (네임스페이스 사용으로 제거)
// 이제 window.VNEXSUSApp.VisualizationComponents를 통해 접근
