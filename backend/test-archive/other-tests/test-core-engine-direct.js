// test-core-engine-direct.js - 코어 엔진 직접 테스트
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const coreEngineService = require('./services/coreEngineService');

async function testCoreEngine() {
    console.log('🧪 코어 엔진 직접 테스트 시작\n');
    
    try {
        // 1. 헬스 체크
        console.log('1. 헬스 체크 테스트');
        const health = coreEngineService.getHealthStatus();
        console.log('   상태:', health.status);
        console.log('   활성화:', health.enabled);
        console.log('   엔진들:', health.engines);
        
        if (!health.enabled) {
            console.log('⚠️  코어 엔진이 비활성화되어 있습니다.');
            console.log('   환경변수 USE_CORE_ENGINE=true로 설정하세요.');
            return;
        }
        
        // 2. 간단한 텍스트 분석 테스트
        console.log('\n2. 간단한 텍스트 분석 테스트');
        const simpleText = "2024년 1월 15일 고혈압 진단받음. 아스피린 처방.";
        
        const result = await coreEngineService.analyze({
            text: simpleText,
            options: {
                qualityGate: 'draft'
            }
        });
        
        console.log('   분석 결과:', result.success ? '성공' : '실패');
        if (result.success) {
            console.log('   스켈레톤 JSON 생성:', !!result.data.skeletonJson);
            console.log('   품질 게이트:', result.data.qualityGate);
        } else {
            console.log('   오류:', result.error);
        }
        
        // 3. 통합 파이프라인 테스트 (계약일 포함)
        console.log('\n3. 통합 파이프라인 테스트');
        const pipelineParams = {
            contractDate: '2024-01-01',
            records: [
                {
                    date: '2024-01-15',
                    diagnosis: '고혈압',
                    hospital: '서울대병원'
                }
            ],
            claimDiagnosis: '고혈압',
            systemPrompt: '의료 기록을 분석해주세요.',
            userPrompt: '고지의무 분석을 수행해주세요.'
        };
        
        const pipelineResult = await coreEngineService.runIntegratedPipeline(pipelineParams);
        console.log('   파이프라인 결과:', pipelineResult.success ? '성공' : '실패');
        if (pipelineResult.success) {
            console.log('   고지의무 분석:', !!pipelineResult.disclosureResult);
            console.log('   질환 분류:', !!pipelineResult.classificationResult);
        }
        
        console.log('\n✅ 코어 엔진 테스트 완료');
        
    } catch (error) {
        console.error('❌ 테스트 중 오류 발생:', error.message);
        console.error('   스택:', error.stack);
    }
}

// 테스트 실행
testCoreEngine().catch(console.error);