/**
 * 향상된 문맥 인식 DNA 시퀀싱 테스트
 * GPT-4o Mini + 문맥 강화 프롬프트의 성능을 검증합니다.
 */

const MedicalGeneExtractor = require('./src/dna-engine/core/geneExtractor.cjs');
const fs = require('fs').promises;
const path = require('path');

async function testEnhancedContextualExtraction() {
    console.log('🧬 향상된 문맥 인식 DNA 시퀀싱 테스트 시작...\n');
    
    try {
        // 테스트 케이스 로드
        const testCasePath = path.join(__dirname, 'src', 'rag', 'case_sample', 'Case1.txt');
        const testText = await fs.readFile(testCasePath, 'utf-8');
        
        console.log('📄 테스트 케이스: Case1.txt');
        console.log('📝 원본 텍스트 길이:', testText.length, '문자\n');
        
        // DNA 추출기 초기화
        const extractor = new MedicalGeneExtractor();
        
        // 향상된 문맥 인식 추출 실행
        console.log('🔬 향상된 문맥 인식 DNA 추출 실행 중...');
        const startTime = Date.now();
        
        const result = await extractor.extractGenes(testText, {
            enhancedContext: true,
            narrativeMode: true
        });
        
        const processingTime = Date.now() - startTime;
        
        // 결과 분석
        console.log('\n📊 추출 결과 분석:');
        console.log('- 추출된 유전자 수:', result.genes?.length || 0);
        console.log('- 처리 시간:', processingTime, 'ms');
        console.log('- 평균 신뢰도:', result.extraction_summary?.average_confidence || 'N/A');
        console.log('- 서술적 일관성:', result.extraction_summary?.narrative_coherence || 'N/A');
        console.log('- 문맥적 깊이:', result.extraction_summary?.contextual_depth || 'N/A');
        
        // 유전자별 상세 분석
        if (result.genes && result.genes.length > 0) {
            console.log('\n🧬 추출된 유전자 상세 분석:');
            
            result.genes.forEach((gene, index) => {
                console.log(`\n[Gene ${index + 1}] ${gene.id}`);
                console.log('📝 내용:', gene.content?.substring(0, 100) + '...');
                console.log('🎯 신뢰도:', gene.confidence);
                console.log('🔗 연결성:', gene.connections?.length || 0, '개 연결');
                
                if (gene.narrative_context) {
                    console.log('📖 서술적 맥락:', gene.narrative_context);
                }
                
                // 앵커 정보
                if (gene.anchors) {
                    console.log('⚓ 앵커:');
                    console.log('  - 시간적:', gene.anchors.temporal);
                    console.log('  - 공간적:', gene.anchors.spatial);
                    console.log('  - 의학적:', gene.anchors.medical);
                    console.log('  - 인과적:', gene.anchors.causal);
                }
            });
        }
        
        // 인과 관계 체인 분석
        if (result.extraction_summary?.causal_chains) {
            console.log('\n🔗 인과 관계 체인:');
            result.extraction_summary.causal_chains.forEach((chain, index) => {
                console.log(`\n[Chain ${index + 1}]`);
                console.log('순서:', chain.sequence?.join(' → '));
                console.log('설명:', chain.description);
            });
        }
        
        // 결과를 파일로 저장
        const outputPath = path.join(__dirname, 'enhanced_context_test_result.json');
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log('\n💾 상세 결과가 저장되었습니다:', outputPath);
        
        // 문맥 연관성 품질 평가
        console.log('\n📈 문맥 연관성 품질 평가:');
        
        const contextQuality = evaluateContextualQuality(result);
        console.log('- 서술형 표현 비율:', contextQuality.narrativeRatio + '%');
        console.log('- 연결성 밀도:', contextQuality.connectionDensity);
        console.log('- 인과관계 명확도:', contextQuality.causalClarity);
        console.log('- 전체 문맥 점수:', contextQuality.overallScore + '/100');
        
        if (contextQuality.overallScore >= 80) {
            console.log('✅ 우수한 문맥 연관성 품질');
        } else if (contextQuality.overallScore >= 60) {
            console.log('⚠️ 보통 수준의 문맥 연관성 품질');
        } else {
            console.log('❌ 문맥 연관성 개선 필요');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ 테스트 실행 중 오류 발생:', error.message);
        console.error('상세 오류:', error);
        throw error;
    }
}

/**
 * 문맥 연관성 품질 평가
 */
function evaluateContextualQuality(result) {
    const quality = {
        narrativeRatio: 0,
        connectionDensity: 0,
        causalClarity: 0,
        overallScore: 0
    };
    
    if (!result.genes || result.genes.length === 0) {
        return quality;
    }
    
    // 서술형 표현 비율 계산
    const narrativeGenes = result.genes.filter(gene => 
        gene.content && 
        gene.content.length > 50 && 
        !gene.content.includes('•') && 
        !gene.content.includes('-') &&
        gene.content.includes('하였') || gene.content.includes('되었') || gene.content.includes('으로 인해')
    );
    quality.narrativeRatio = Math.round((narrativeGenes.length / result.genes.length) * 100);
    
    // 연결성 밀도 계산
    const totalConnections = result.genes.reduce((sum, gene) => 
        sum + (gene.connections?.length || 0), 0
    );
    quality.connectionDensity = Math.round((totalConnections / result.genes.length) * 10) / 10;
    
    // 인과관계 명확도 계산
    const causalGenes = result.genes.filter(gene => 
        gene.anchors?.causal && 
        gene.anchors.causal.length > 10 &&
        (gene.anchors.causal.includes('인해') || 
         gene.anchors.causal.includes('결과') || 
         gene.anchors.causal.includes('때문'))
    );
    quality.causalClarity = Math.round((causalGenes.length / result.genes.length) * 100);
    
    // 전체 점수 계산
    quality.overallScore = Math.round(
        (quality.narrativeRatio * 0.4) + 
        (Math.min(quality.connectionDensity * 20, 100) * 0.3) + 
        (quality.causalClarity * 0.3)
    );
    
    return quality;
}

// 스크립트 직접 실행
if (require.main === module) {
    testEnhancedContextualExtraction()
        .then(() => {
            console.log('\n✅ 향상된 문맥 인식 테스트 완료');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ 테스트 실패:', error.message);
            process.exit(1);
        });
}

module.exports = { testEnhancedContextualExtraction, evaluateContextualQuality };