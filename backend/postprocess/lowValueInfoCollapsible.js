/**
 * Low Value Information Collapsible Module
 *
 * 저가치 정보를 "접기/펴기" 형태로 제공
 * - 시스템이 저가치로 판단한 정보도 사용자에게 선택적으로 제공
 * - 단서로서의 가치를 놓치지 않음
 */

export class LowValueInfoCollapsible {
  constructor(options = {}) {
    this.config = {
      // 가중치 임계값
      highValueThreshold: 0.7,    // 0.7 이상: 주요 정보
      mediumValueThreshold: 0.4,  // 0.4-0.7: 보조 정보
      lowValueThreshold: 0.0,     // 0.4 미만: 저가치 정보 (접기)

      // UI 설정
      defaultExpanded: false,     // 기본값: 접힌 상태
      showCount: true,            // 접힌 항목 개수 표시
      allowToggleAll: true,       // 전체 펼치기/접기 버튼

      ...options
    };
  }

  /**
   * 의료 이벤트를 가중치별로 분류
   * @param {Array} medicalEvents - 의료 이벤트 배열
   * @returns {Object} 분류된 이벤트
   */
  classifyByWeight(medicalEvents) {
    const classified = {
      highValue: [],    // 주요 정보 (항상 표시)
      mediumValue: [],  // 보조 정보 (기본 표시)
      lowValue: []      // 저가치 정보 (기본 숨김)
    };

    for (const event of medicalEvents) {
      const weight = event.weight || event.relevanceScore || 0;

      if (weight >= this.config.highValueThreshold) {
        classified.highValue.push(event);
      } else if (weight >= this.config.mediumValueThreshold) {
        classified.mediumValue.push(event);
      } else {
        classified.lowValue.push(event);
      }
    }

    return classified;
  }

  /**
   * HTML 보고서용 접기/펴기 구조 생성
   * @param {Array} lowValueItems - 저가치 정보 배열
   * @param {string} sectionId - 섹션 ID
   * @returns {string} HTML 문자열
   */
  generateCollapsibleHTML(lowValueItems, sectionId) {
    if (!lowValueItems || lowValueItems.length === 0) {
      return '';
    }

    const itemCount = lowValueItems.length;
    const itemsHTML = lowValueItems.map((item, index) => `
      <div class="low-value-item" data-weight="${item.weight || 0}">
        <span class="item-label">${item.label || '항목'}:</span>
        <span class="item-content">${item.content || ''}</span>
        ${item.source ? `<span class="item-source">(출처: 페이지 ${item.source.page}, 좌표 ${item.source.coordinates})</span>` : ''}
        <span class="item-weight" title="연관성 가중치">가중치: ${(item.weight || 0).toFixed(3)}</span>
      </div>
    `).join('\n');

    return `
<div class="collapsible-section" id="${sectionId}">
  <button class="collapsible-toggle" onclick="toggleCollapsible('${sectionId}')">
    <span class="toggle-icon">▶</span>
    <span class="toggle-text">저가치 정보 (${itemCount}개 항목)</span>
    <span class="toggle-hint">클릭하여 펼치기/접기</span>
  </button>
  <div class="collapsible-content" style="display: none;">
    <div class="collapsible-header">
      <p class="info-message">
        ⚠️ 아래 정보는 주요 의료 이벤트와의 연관성이 낮게 평가되었으나,
        단서로서 가치가 있을 수 있어 제공됩니다.
      </p>
    </div>
    <div class="low-value-items">
      ${itemsHTML}
    </div>
  </div>
</div>

<style>
.collapsible-section {
  margin: 1rem 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.collapsible-toggle {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #f5f5f5;
  border: none;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background 0.2s;
}

.collapsible-toggle:hover {
  background: #e8e8e8;
}

.toggle-icon {
  transition: transform 0.2s;
  font-weight: bold;
}

.toggle-icon.expanded {
  transform: rotate(90deg);
}

.toggle-text {
  font-weight: 600;
  flex: 1;
}

.toggle-hint {
  font-size: 0.85rem;
  color: #666;
}

.collapsible-content {
  border-top: 1px solid #ddd;
}

.collapsible-header {
  padding: 0.75rem 1rem;
  background: #fffbf0;
  border-bottom: 1px solid #e8e8e8;
}

.info-message {
  margin: 0;
  font-size: 0.9rem;
  color: #856404;
}

.low-value-items {
  padding: 1rem;
}

.low-value-item {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: #fafafa;
  border-left: 3px solid #ccc;
  font-size: 0.9rem;
}

.item-label {
  font-weight: 600;
  color: #555;
}

.item-content {
  margin-left: 0.5rem;
}

.item-source {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #888;
}

.item-weight {
  float: right;
  padding: 0.1rem 0.4rem;
  background: #e0e0e0;
  border-radius: 3px;
  font-size: 0.75rem;
  color: #555;
}
</style>

<script>
function toggleCollapsible(sectionId) {
  const section = document.getElementById(sectionId);
  const content = section.querySelector('.collapsible-content');
  const icon = section.querySelector('.toggle-icon');

  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.classList.add('expanded');
  } else {
    content.style.display = 'none';
    icon.classList.remove('expanded');
  }
}

// 전체 펼치기/접기
function toggleAllCollapsibles(expand) {
  document.querySelectorAll('.collapsible-section').forEach(section => {
    const content = section.querySelector('.collapsible-content');
    const icon = section.querySelector('.toggle-icon');

    if (expand) {
      content.style.display = 'block';
      icon.classList.add('expanded');
    } else {
      content.style.display = 'none';
      icon.classList.remove('expanded');
    }
  });
}
</script>
    `.trim();
  }

  /**
   * Markdown 보고서용 접기/펴기 구조 생성
   * @param {Array} lowValueItems - 저가치 정보 배열
   * @param {string} sectionTitle - 섹션 제목
   * @returns {string} Markdown 문자열
   */
  generateCollapsibleMarkdown(lowValueItems, sectionTitle = '저가치 정보') {
    if (!lowValueItems || lowValueItems.length === 0) {
      return '';
    }

    const itemCount = lowValueItems.length;
    const itemsMarkdown = lowValueItems.map(item => `
- **${item.label || '항목'}**: ${item.content || ''}
  - 출처: 페이지 ${item.source?.page || '?'}, 좌표 (${item.source?.coordinates || '?'})
  - 가중치: ${(item.weight || 0).toFixed(3)}
    `).join('\n');

    return `
<details>
  <summary><strong>${sectionTitle} (${itemCount}개 항목)</strong></summary>

> ⚠️ 아래 정보는 주요 의료 이벤트와의 연관성이 낮게 평가되었으나,
> 단서로서 가치가 있을 수 있어 제공됩니다.

${itemsMarkdown}

</details>
    `.trim();
  }

  /**
   * JSON 보고서용 메타데이터 추가
   * @param {Array} medicalEvents - 의료 이벤트 배열
   * @returns {Object} 메타데이터 포함 JSON
   */
  generateCollapsibleJSON(medicalEvents) {
    const classified = this.classifyByWeight(medicalEvents);

    return {
      summary: {
        totalEvents: medicalEvents.length,
        highValueCount: classified.highValue.length,
        mediumValueCount: classified.mediumValue.length,
        lowValueCount: classified.lowValue.length
      },
      displaySuggestions: {
        highValue: {
          display: 'always_visible',
          items: classified.highValue
        },
        mediumValue: {
          display: 'default_visible',
          items: classified.mediumValue
        },
        lowValue: {
          display: 'collapsible',
          defaultExpanded: this.config.defaultExpanded,
          items: classified.lowValue,
          uiHint: '접기/펴기 기능 제공 권장'
        }
      }
    };
  }

  /**
   * Excel 보고서용 시트 분리
   * @param {Array} medicalEvents - 의료 이벤트 배열
   * @returns {Object} 시트별 데이터
   */
  generateCollapsibleExcel(medicalEvents) {
    const classified = this.classifyByWeight(medicalEvents);

    return {
      sheets: [
        {
          name: '주요 정보',
          data: classified.highValue,
          color: '#28a745' // 녹색
        },
        {
          name: '보조 정보',
          data: classified.mediumValue,
          color: '#ffc107' // 노란색
        },
        {
          name: '저가치 정보 (참고용)',
          data: classified.lowValue,
          color: '#6c757d', // 회색
          hidden: true // 기본 숨김
        }
      ]
    };
  }
}

// 싱글톤 인스턴스
let collapsibleInstance = null;

export function getCollapsibleManager(options) {
  if (!collapsibleInstance) {
    collapsibleInstance = new LowValueInfoCollapsible(options);
  }
  return collapsibleInstance;
}
