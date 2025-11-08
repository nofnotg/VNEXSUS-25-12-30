// RingBuffer 클래스 단위 테스트
import { createLogger } from './backend/utils/enhancedLogger.js';

const logger = createLogger('RingBufferTest');

/**
 * 고정 길이 링버퍼 클래스 (테스트용)
 */
class RingBuffer {
    constructor(capacity = 10) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }

    /**
     * 요소 추가
     */
    push(item) {
        this.buffer[this.tail] = item;
        this.tail = (this.tail + 1) % this.capacity;
        
        if (this.size < this.capacity) {
            this.size++;
        } else {
            // 버퍼가 가득 찬 경우 head 이동
            this.head = (this.head + 1) % this.capacity;
        }
    }

    /**
     * 요소 제거 및 반환
     */
    pop() {
        if (this.size === 0) {
            return undefined;
        }
        
        const item = this.buffer[this.head];
        this.buffer[this.head] = undefined;
        this.head = (this.head + 1) % this.capacity;
        this.size--;
        
        return item;
    }

    /**
     * 첫 번째 요소 조회 (제거하지 않음)
     */
    peek() {
        if (this.size === 0) {
            return undefined;
        }
        return this.buffer[this.head];
    }

    /**
     * 버퍼가 비어있는지 확인
     */
    isEmpty() {
        return this.size === 0;
    }

    /**
     * 버퍼가 가득 찬지 확인
     */
    isFull() {
        return this.size === this.capacity;
    }

    /**
     * 모든 요소를 배열로 반환
     */
    toArray() {
        const result = [];
        for (let i = 0; i < this.size; i++) {
            const index = (this.head + i) % this.capacity;
            result.push(this.buffer[index]);
        }
        return result;
    }

    /**
     * 버퍼 초기화
     */
    clear() {
        this.buffer = new Array(this.capacity);
        this.head = 0;
        this.tail = 0;
        this.size = 0;
    }
}

/**
 * 테스트 실행 함수
 */
function runRingBufferTests() {
    console.log('🧪 RingBuffer 단위 테스트 시작\n');
    
    let testCount = 0;
    let passCount = 0;
    
    function test(name, testFn) {
        testCount++;
        try {
            testFn();
            console.log(`✅ ${name}`);
            passCount++;
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
        }
    }
    
    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    // 테스트 1: 기본 생성자
    test('기본 생성자 테스트', () => {
        const buffer = new RingBuffer();
        assert(buffer.capacity === 10, '기본 용량이 10이어야 함');
        assert(buffer.size === 0, '초기 크기가 0이어야 함');
        assert(buffer.isEmpty(), '초기 상태에서 비어있어야 함');
        assert(!buffer.isFull(), '초기 상태에서 가득 차지 않아야 함');
    });
    
    // 테스트 2: 커스텀 용량
    test('커스텀 용량 테스트', () => {
        const buffer = new RingBuffer(5);
        assert(buffer.capacity === 5, '용량이 5여야 함');
    });
    
    // 테스트 3: 요소 추가
    test('요소 추가 테스트', () => {
        const buffer = new RingBuffer(3);
        buffer.push('A');
        buffer.push('B');
        
        assert(buffer.size === 2, '크기가 2여야 함');
        assert(!buffer.isEmpty(), '비어있지 않아야 함');
        assert(!buffer.isFull(), '아직 가득 차지 않아야 함');
    });
    
    // 테스트 4: 버퍼 가득 참
    test('버퍼 가득 참 테스트', () => {
        const buffer = new RingBuffer(3);
        buffer.push('A');
        buffer.push('B');
        buffer.push('C');
        
        assert(buffer.size === 3, '크기가 3이어야 함');
        assert(buffer.isFull(), '가득 차야 함');
    });
    
    // 테스트 5: 오버플로우 처리
    test('오버플로우 처리 테스트', () => {
        const buffer = new RingBuffer(3);
        buffer.push('A');
        buffer.push('B');
        buffer.push('C');
        buffer.push('D'); // 오버플로우
        
        assert(buffer.size === 3, '크기가 여전히 3이어야 함');
        assert(buffer.isFull(), '가득 차야 함');
        
        const array = buffer.toArray();
        assert(array[0] === 'B', '첫 번째 요소가 B여야 함 (A가 덮어씌워짐)');
        assert(array[1] === 'C', '두 번째 요소가 C여야 함');
        assert(array[2] === 'D', '세 번째 요소가 D여야 함');
    });
    
    // 테스트 6: 요소 제거
    test('요소 제거 테스트', () => {
        const buffer = new RingBuffer(3);
        buffer.push('A');
        buffer.push('B');
        buffer.push('C');
        
        const item = buffer.pop();
        assert(item === 'A', '제거된 요소가 A여야 함');
        assert(buffer.size === 2, '크기가 2여야 함');
        assert(!buffer.isFull(), '가득 차지 않아야 함');
    });
    
    // 테스트 7: 빈 버퍼에서 제거
    test('빈 버퍼에서 제거 테스트', () => {
        const buffer = new RingBuffer(3);
        const item = buffer.pop();
        assert(item === undefined, 'undefined를 반환해야 함');
        assert(buffer.size === 0, '크기가 0이어야 함');
    });
    
    // 테스트 8: peek 기능
    test('peek 기능 테스트', () => {
        const buffer = new RingBuffer(3);
        buffer.push('A');
        buffer.push('B');
        
        const item = buffer.peek();
        assert(item === 'A', 'peek이 A를 반환해야 함');
        assert(buffer.size === 2, '크기가 변하지 않아야 함');
    });
    
    // 테스트 9: 빈 버퍼에서 peek
    test('빈 버퍼에서 peek 테스트', () => {
        const buffer = new RingBuffer(3);
        const item = buffer.peek();
        assert(item === undefined, 'undefined를 반환해야 함');
    });
    
    // 테스트 10: toArray 기능
    test('toArray 기능 테스트', () => {
        const buffer = new RingBuffer(5);
        buffer.push(1);
        buffer.push(2);
        buffer.push(3);
        
        const array = buffer.toArray();
        assert(Array.isArray(array), '배열을 반환해야 함');
        assert(array.length === 3, '배열 길이가 3이어야 함');
        assert(array[0] === 1 && array[1] === 2 && array[2] === 3, '올바른 순서여야 함');
    });
    
    // 테스트 11: clear 기능
    test('clear 기능 테스트', () => {
        const buffer = new RingBuffer(3);
        buffer.push('A');
        buffer.push('B');
        buffer.clear();
        
        assert(buffer.size === 0, '크기가 0이어야 함');
        assert(buffer.isEmpty(), '비어있어야 함');
        assert(buffer.head === 0, 'head가 0이어야 함');
        assert(buffer.tail === 0, 'tail이 0이어야 함');
    });
    
    // 테스트 12: 복합 시나리오
    test('복합 시나리오 테스트', () => {
        const buffer = new RingBuffer(4);
        
        // 추가
        buffer.push('A');
        buffer.push('B');
        buffer.push('C');
        
        // 제거
        assert(buffer.pop() === 'A', '첫 번째 pop이 A여야 함');
        
        // 더 추가
        buffer.push('D');
        buffer.push('E');
        
        // 현재 상태 확인
        const array = buffer.toArray();
        assert(array.length === 4, '길이가 4여야 함');
        assert(array[0] === 'B', '첫 번째가 B여야 함');
        assert(array[3] === 'E', '마지막이 E여야 함');
    });
    
    // 테스트 13: 성능 테스트
    test('성능 테스트', () => {
        const buffer = new RingBuffer(1000);
        const startTime = Date.now();
        
        // 10000개 요소 추가/제거
        for (let i = 0; i < 10000; i++) {
            buffer.push(i);
            if (i % 2 === 0) {
                buffer.pop();
            }
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`   📊 성능: 10000회 연산을 ${duration}ms에 완료`);
        assert(duration < 1000, '1초 이내에 완료되어야 함');
    });
    
    // 결과 출력
    console.log(`\n📊 테스트 결과: ${passCount}/${testCount} 통과`);
    
    if (passCount === testCount) {
        console.log('🎉 모든 테스트 통과!');
        logger.info('RingBuffer 단위 테스트 완료', { 
            totalTests: testCount, 
            passedTests: passCount,
            status: 'SUCCESS'
        });
        return true;
    } else {
        console.log('❌ 일부 테스트 실패');
        logger.error('RingBuffer 단위 테스트 실패', { 
            totalTests: testCount, 
            passedTests: passCount,
            failedTests: testCount - passCount,
            status: 'FAILED'
        });
        return false;
    }
}

// 메모리 사용량 테스트
function runMemoryTest() {
    console.log('\n🧠 메모리 사용량 테스트');
    
    const buffer = new RingBuffer(10000);
    const initialMemory = process.memoryUsage().heapUsed;
    
    // 대량 데이터 추가
    for (let i = 0; i < 50000; i++) {
        buffer.push({
            id: i,
            data: `test-data-${i}`,
            timestamp: new Date().toISOString()
        });
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    console.log(`📊 메모리 증가량: ${memoryIncrease.toFixed(2)} MB`);
    console.log(`📊 버퍼 크기: ${buffer.size}`);
    console.log(`📊 용량 제한: ${buffer.capacity}`);
    
    // 메모리 효율성 확인 (링버퍼는 고정 크기를 유지해야 함)
    if (buffer.size === buffer.capacity) {
        console.log('✅ 메모리 효율성: 용량 제한이 올바르게 작동함');
        return true;
    } else {
        console.log('❌ 메모리 효율성: 용량 제한이 제대로 작동하지 않음');
        return false;
    }
}

// 테스트 실행
async function main() {
    try {
        console.log('🚀 RingBuffer 종합 테스트 시작\n');
        
        const functionalTestResult = runRingBufferTests();
        const memoryTestResult = runMemoryTest();
        
        console.log('\n📋 최종 결과:');
        console.log(`   기능 테스트: ${functionalTestResult ? '✅ 통과' : '❌ 실패'}`);
        console.log(`   메모리 테스트: ${memoryTestResult ? '✅ 통과' : '❌ 실패'}`);
        
        if (functionalTestResult && memoryTestResult) {
            console.log('\n🎉 RingBuffer 클래스가 모든 테스트를 통과했습니다!');
            process.exit(0);
        } else {
            console.log('\n❌ 일부 테스트가 실패했습니다.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ 테스트 실행 중 오류 발생:', error);
        process.exit(1);
    }
}

main();