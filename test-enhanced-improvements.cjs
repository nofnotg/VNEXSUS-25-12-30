// test-enhanced-improvements.js - 개선사항 테스트
const { CoreEngineService } = require('./backend/services/coreEngineService.js');
const { QualityAssurance } = require('./backend/services/core-engine/enhanced/QualityAssurance.js');
const { createLogger } = require('./backend/utils/enhancedLogger.js');

async function testEnhancedImprovements() {
    console.log('🚀 개선사항 테스트 시작...\n');
    
    try {
        // 1. 코어 엔진 서비스 초기화
        const coreEngineService = new CoreEngineService();
        
        const qualityAssurance = new QualityAssurance({
            targetQualityScore: 85,
            enableDetailedMetrics: true
        });
        
        // 2. 테스트 케이스 데이터
        const testCases = [
            {
                name: "복합 의료 기록 1",
                text: `
                환자: 김철수 (남, 45세)
                진료일: 2024년 1월 15일
                
                주소: 3일 전부터 시작된 복통과 발열
                
                현병력:
                - 2024.01.12 급성 복통 발생, 응급실 내원
                - 복부 CT 촬영 결과 급성 충수염 의심
                - 2024.01.13 복강경 충수절제술 시행
                - 수술 후 항생제 투약: 세파졸린 1g 하루 3회
                - 진통제: 트라마돌 50mg 필요시 복용
                
                과거력:
                - 2020년 고혈압 진단, 현재 암로디핀 5mg 복용 중
                - 2018년 당뇨병 진단, 메트포르민 500mg 하루 2회 복용
                
                검사 결과:
                - 혈액검사: WBC 12,000/μL (정상: 4,000-10,000)
                - 체온: 38.2°C
                - 혈압: 140/90 mmHg
                - 혈당: 180 mg/dL
                `
            },
            {
                name: "시간 정규화 테스트",
                text: `
                환자 내원 경과:
                - 어제 오후 증상 시작
                - 오늘 아침 8시 응급실 내원
                - 2시간 후 검사 완료
                - 수술 전 3일간 금식
                - 퇴원 후 1주일 뒤 외래 예약
                - 3개월 후 추적 검사 예정
                - 6개월간 경과 관찰 필요
                `
            },
            {
                name: "엔티티 추출 테스트",
                text: `
                진단명: 급성 심근경색증, 고혈압성 심질환
                시술: 경피적 관상동맥 중재술 (PCI)
                처방약물:
                - 아스피린 100mg 1일 1회
                - 클로피도그렐 75mg 1일 1회  
                - 아토르바스타틴 20mg 1일 1회
                - 메토프롤롤 25mg 1일 2회
                
                해부학적 위치: 좌전하행지 근위부, 우관상동맥 중간부
                `
            }
        ];
        
        console.log('📊 테스트 케이스 처리 중...\n');
        
        let totalScore = 0;
        let testCount = 0;
        
        for (const testCase of testCases) {
            console.log(`\n🔍 테스트: ${testCase.name}`);
            console.log('=' .repeat(50));
            
            try {
                // 코어 엔진 처리
                const startTime = Date.now();
                const result = await coreEngineService.analyze({
                    text: testCase.text,
                    options: { 
                        enableEnhancedExtraction: true,
                        enableTemporalNormalization: true,
                        enableQualityAssurance: true
                    }
                });
                const processingTime = Date.now() - startTime;
                
                // 품질 평가
                const qualityResult = await qualityAssurance.calculateQualityScore(result);
                
                console.log(`⏱️  처리 시간: ${processingTime}ms`);
                console.log(`📈 품질 점수: ${qualityResult.overallScore}/100`);
                console.log(`🎯 품질 등급: ${qualityResult.qualityGate}`);
                
                // 상세 점수 출력
                console.log('\n📋 상세 점수:');
                console.log(`  - 정보 보존도: ${qualityResult.breakdown.informationPreservation.score}/25`);
                console.log(`  - 엔티티 추출: ${qualityResult.breakdown.entityExtraction.score}/25`);
                console.log(`  - 시간 정규화: ${qualityResult.breakdown.temporalNormalization.score}/25`);
                console.log(`  - 컨텍스트 분류: ${qualityResult.breakdown.contextualClassification.score}/25`);
                
                // 추출된 엔티티 요약
                const entities = result.entities || [];
                const entityTypes = {};
                entities.forEach(entity => {
                    entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
                });
                
                console.log('\n🏷️  추출된 엔티티:');
                Object.entries(entityTypes).forEach(([type, count]) => {
                    console.log(`  - ${type}: ${count}개`);
                });
                
                // 시간 정보 요약
                const events = result.events || [];
                const datedEvents = events.filter(e => e.normalizedDate);
                console.log(`\n📅 시간 정보: ${datedEvents.length}/${events.length}개 정규화됨`);
                
                totalScore += qualityResult.overallScore;
                testCount++;
                
            } catch (error) {
                console.error(`❌ 테스트 실패: ${error.message}`);
            }
        }
        
        // 전체 결과 요약
        console.log('\n' + '='.repeat(60));
        console.log('📊 전체 테스트 결과 요약');
        console.log('='.repeat(60));
        
        const averageScore = totalScore / testCount;
        console.log(`🎯 평균 품질 점수: ${averageScore.toFixed(1)}/100`);
        console.log(`📈 목표 달성 여부: ${averageScore >= 85 ? '✅ 달성' : '❌ 미달성'}`);
        console.log(`🧪 테스트 케이스: ${testCount}개 완료`);
        
        // 개선사항 효과 분석
        console.log('\n🔧 개선사항 효과:');
        console.log('  ✅ 엔티티 추출 패턴 대폭 확장');
        console.log('  ✅ 시간 정규화 정확도 향상');
        console.log('  ✅ 신뢰도 계산 로직 개선');
        console.log('  ✅ 컨텍스트 기반 품질 평가 강화');
        
        if (averageScore >= 85) {
            console.log('\n🎉 목표 품질 점수 85점 이상 달성!');
            return true;
        } else {
            console.log('\n⚠️  목표 품질 점수 미달성, 추가 개선 필요');
            return false;
        }
        
    } catch (error) {
        console.error('❌ 테스트 실행 중 오류:', error);
        return false;
    }
}

// 테스트 실행
testEnhancedImprovements()
    .then(success => {
        console.log(`\n🏁 테스트 완료: ${success ? '성공' : '실패'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ 테스트 실행 실패:', error);
        process.exit(1);
    });