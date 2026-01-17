import IntegratedSystemValidator from './IntegratedSystemValidator.js';

console.log('=== 간단한 시스템 검증 ===');

async function simpleValidation() {
    try {
        const validator = new IntegratedSystemValidator();
        console.log('✓ IntegratedSystemValidator 생성 완료');
        
        // 모듈 초기화만 테스트
        const initResult = await validator._initializeAllModules();
        
        console.log('\n모듈 초기화 결과:');
        console.log('- 성공:', initResult.success);
        console.log('- 초기화된 모듈 수:', initResult.initializedModules?.length || 0);
        
        if (initResult.initializedModules) {
            console.log('- 초기화된 모듈들:', initResult.initializedModules.join(', '));
        }
        
        // 각 모듈 상태 확인
        console.log('\n모듈 상태:');
        Object.keys(validator.modules).forEach(moduleName => {
            const module = validator.modules[moduleName];
            console.log(`- ${moduleName}: ${module ? '✓ 활성' : '❌ 비활성'}`);
        });
        
        console.log('\n✓ 간단한 시스템 검증 완료');
        
    } catch (error) {
        console.error('❌ 검증 실패:', error.message);
        console.error('상세 오류:', error.stack);
    }
}

simpleValidation();