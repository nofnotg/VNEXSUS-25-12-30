// 가상 스크롤링 및 성능 최적화 클래스

class VirtualScrollOptimizer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemHeight: options.itemHeight || 25,
            bufferSize: options.bufferSize || 10,
            chunkSize: options.chunkSize || 1000,
            throttleDelay: options.throttleDelay || 16,
            ...options
        };
        
        this.data = [];
        this.visibleItems = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        
        // container가 유효한 경우에만 초기화
        if (this.container) {
            this.init();
        }
    }

    init() {
        this.setupContainer();
        this.bindEvents();
    }

    setupContainer() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'auto';
        
        // 가상 스크롤 컨테이너 생성
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';
        this.viewport.style.position = 'absolute';
        this.viewport.style.top = '0';
        this.viewport.style.left = '0';
        this.viewport.style.right = '0';
        
        // 스크롤 스페이서 생성
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-scroll-spacer';
        
        this.container.appendChild(this.spacer);
        this.container.appendChild(this.viewport);
        
        this.updateContainerHeight();
    }

    bindEvents() {
        // 스크롤 이벤트 (throttled)
        this.container.addEventListener('scroll', this.throttle(this.handleScroll.bind(this), this.options.throttleDelay));
        
        // 리사이즈 이벤트
        window.addEventListener('resize', this.throttle(this.handleResize.bind(this), 100));
    }

    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    setData(data) {
        this.data = data;
        this.totalHeight = this.data.length * this.options.itemHeight;
        this.spacer.style.height = `${this.totalHeight}px`;
        this.updateVisibleItems();
    }

    updateContainerHeight() {
        this.containerHeight = this.container.clientHeight;
    }

    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        this.updateVisibleItems();
    }

    handleResize() {
        this.updateContainerHeight();
        this.updateVisibleItems();
    }

    updateVisibleItems() {
        const visibleStart = Math.floor(this.scrollTop / this.options.itemHeight);
        const visibleEnd = Math.min(
            visibleStart + Math.ceil(this.containerHeight / this.options.itemHeight),
            this.data.length
        );
        
        // 버퍼 추가
        this.startIndex = Math.max(0, visibleStart - this.options.bufferSize);
        this.endIndex = Math.min(this.data.length, visibleEnd + this.options.bufferSize);
        
        this.renderVisibleItems();
    }

    renderVisibleItems() {
        // 기존 아이템 제거
        this.viewport.innerHTML = '';
        
        // 뷰포트 위치 조정
        this.viewport.style.transform = `translateY(${this.startIndex * this.options.itemHeight}px)`;
        
        // 보이는 아이템들 렌더링
        for (let i = this.startIndex; i < this.endIndex; i++) {
            if (this.data[i]) {
                const item = this.createItemElement(this.data[i], i);
                this.viewport.appendChild(item);
            }
        }
    }

    createItemElement(data, index) {
        const item = document.createElement('div');
        item.className = 'virtual-scroll-item';
        item.style.height = `${this.options.itemHeight}px`;
        item.style.lineHeight = `${this.options.itemHeight}px`;
        item.dataset.index = index;
        
        if (typeof this.options.renderItem === 'function') {
            item.innerHTML = this.options.renderItem(data, index);
        } else {
            item.textContent = data.toString();
        }
        
        return item;
    }

    scrollToIndex(index) {
        const targetScrollTop = index * this.options.itemHeight;
        this.container.scrollTop = targetScrollTop;
    }

    getVisibleRange() {
        return {
            start: this.startIndex,
            end: this.endIndex
        };
    }
}

// 텍스트 청크 로더 클래스
class TextChunkLoader {
    constructor(options = {}) {
        this.options = {
            chunkSize: options.chunkSize || 10000, // 문자 단위
            lineChunkSize: options.lineChunkSize || 100, // 라인 단위
            loadDelay: options.loadDelay || 50,
            ...options
        };
        
        this.chunks = [];
        this.loadedChunks = new Set();
        this.loadingChunks = new Set();
    }

    async loadText(text, container) {
        this.chunks = this.splitTextIntoChunks(text);
        this.container = container;
        
        // 첫 번째 청크 즉시 로드
        await this.loadChunk(0);
        
        // 나머지 청크들을 순차적으로 로드
        this.loadRemainingChunks();
    }

    splitTextIntoChunks(text) {
        const lines = text.split('\n');
        const chunks = [];
        
        for (let i = 0; i < lines.length; i += this.options.lineChunkSize) {
            const chunkLines = lines.slice(i, i + this.options.lineChunkSize);
            chunks.push({
                index: chunks.length,
                content: chunkLines.join('\n'),
                startLine: i,
                endLine: Math.min(i + this.options.lineChunkSize - 1, lines.length - 1)
            });
        }
        
        return chunks;
    }

    async loadChunk(chunkIndex) {
        if (this.loadedChunks.has(chunkIndex) || this.loadingChunks.has(chunkIndex)) {
            return;
        }
        
        this.loadingChunks.add(chunkIndex);
        
        // 로딩 지연 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, this.options.loadDelay));
        
        const chunk = this.chunks[chunkIndex];
        if (chunk) {
            this.renderChunk(chunk);
            this.loadedChunks.add(chunkIndex);
        }
        
        this.loadingChunks.delete(chunkIndex);
    }

    renderChunk(chunk) {
        const chunkElement = document.createElement('div');
        chunkElement.className = 'text-chunk';
        chunkElement.dataset.chunkIndex = chunk.index;
        chunkElement.innerHTML = `
            <div class="chunk-header">
                <span class="chunk-info">청크 ${chunk.index + 1} (라인 ${chunk.startLine + 1}-${chunk.endLine + 1})</span>
            </div>
            <div class="chunk-content">
                <pre>${this.escapeHtml(chunk.content)}</pre>
            </div>
        `;
        
        this.container.appendChild(chunkElement);
    }

    async loadRemainingChunks() {
        for (let i = 1; i < this.chunks.length; i++) {
            await this.loadChunk(i);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getLoadingProgress() {
        return {
            loaded: this.loadedChunks.size,
            total: this.chunks.length,
            percentage: Math.round((this.loadedChunks.size / this.chunks.length) * 100)
        };
    }
}

// 성능 모니터 클래스
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            renderTime: [],
            scrollTime: [],
            loadTime: [],
            memoryUsage: []
        };
        
        this.startTimes = new Map();
    }

    startTimer(operation) {
        this.startTimes.set(operation, performance.now());
    }

    endTimer(operation) {
        const startTime = this.startTimes.get(operation);
        if (startTime) {
            const duration = performance.now() - startTime;
            
            if (this.metrics[operation]) {
                this.metrics[operation].push(duration);
                
                // 최근 100개 기록만 유지
                if (this.metrics[operation].length > 100) {
                    this.metrics[operation].shift();
                }
            }
            
            this.startTimes.delete(operation);
            return duration;
        }
        return 0;
    }

    getAverageTime(operation) {
        const times = this.metrics[operation];
        if (!times || times.length === 0) return 0;
        
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    recordMemoryUsage() {
        const memory = this.getMemoryUsage();
        if (memory) {
            this.metrics.memoryUsage.push(memory.used);
            
            if (this.metrics.memoryUsage.length > 100) {
                this.metrics.memoryUsage.shift();
            }
        }
    }

    getPerformanceReport() {
        return {
            averageRenderTime: this.getAverageTime('renderTime'),
            averageScrollTime: this.getAverageTime('scrollTime'),
            averageLoadTime: this.getAverageTime('loadTime'),
            currentMemory: this.getMemoryUsage(),
            averageMemoryUsage: this.metrics.memoryUsage.length > 0 
                ? this.metrics.memoryUsage.reduce((sum, mem) => sum + mem, 0) / this.metrics.memoryUsage.length 
                : 0
        };
    }
}

// 전역 성능 모니터 인스턴스
window.performanceMonitor = new PerformanceMonitor();

// 성능 모니터링 시작
setInterval(() => {
    window.performanceMonitor.recordMemoryUsage();
}, 5000);