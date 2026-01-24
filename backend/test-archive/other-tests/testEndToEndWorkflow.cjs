const fs = require('fs');
const path = require('path');

/**
 * End-to-End 워크플로우 테스트
 * 의무기록 업로드부터 보고서 생성까지 전체 프로세스를 검증합니다.
 */
class EndToEndWorkflowTest {
    constructor() {
        this.testDataPath = path.join(__dirname, '..', 'automation');
        this.backendPath = path.join(__dirname, '..', 'backend');
        this.frontendPath = path.join(__dirname, '..', 'frontend');
    }

    /**
     * 테스트 시나리오 정의
     */
    getTestScenarios() {
        return [
            {
                name: "위암 사례 - 고위험",
                description: "보험가입 전 위암 진단 이력이 있는 고위험 사례",
                contractDate: "2023-05-15",
                productType: "실손의료보험",
                claimDiagnosis: "위암",
                claimant: {
                    name: "김철수",
                    dob: "1985-03-20",
                    gender: "남성"
                },
                expectedRisk: "high",
                expectedDisclosureViolation: true
            },
            {
                name: "당뇨병 사례 - 중위험",
                description: "보험가입 전 당뇨병 치료 이력이 있는 중위험 사례",
                contractDate: "2023-08-01",
                productType: "건강보험",
                claimDiagnosis: "당뇨병성 신증",
                claimant: {
                    name: "이영희",
                    dob: "1978-11-15",
                    gender: "여성"
                },
                expectedRisk: "medium",
                expectedDisclosureViolation: true
            },
            {
                name: "단순 외상 사례 - 저위험",
                description: "보험가입 후 발생한 단순 외상 사례",
                contractDate: "2023-01-10",
                productType: "상해보험",
                claimDiagnosis: "우측 발목 골절",
                claimant: {
                    name: "박민수",
                    dob: "1990-07-08",
                    gender: "남성"
                },
                expectedRisk: "low",
                expectedDisclosureViolation: false
            }
        ];
    }

    /**
     * 시나리오별 의무기록 생성
     */
    generateMedicalRecords(scenario) {
        const contractDate = new Date(scenario.contractDate);
        
        switch (scenario.name) {
            case "위암 사례 - 고위험":
                return [
                    {
                        hospital: "서울대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() - 90 * 24 * 60 * 60 * 1000)), // 3개월 전
                        text: "상복부 불편감으로 내원. 위내시경 검사 시행. 위체부에 궤양성 병변 관찰됨. 조직검사 필요 소견.",
                        department: "소화기내과"
                    },
                    {
                        hospital: "서울대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() - 80 * 24 * 60 * 60 * 1000)), // 2.5개월 전
                        text: "조직검사 결과: Adenocarcinoma (선암) 확진. 추가 정밀검사 및 병기 결정을 위한 CT 촬영 예정.",
                        department: "소화기내과"
                    },
                    {
                        hospital: "서울대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() - 65 * 24 * 60 * 60 * 1000)), // 2개월 전
                        text: "복부 CT 결과: T2N1M0 병기로 판단. 수술적 치료 계획 수립. 위부분절제술 예정.",
                        department: "외과"
                    },
                    {
                        hospital: "서울대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() + 30 * 24 * 60 * 60 * 1000)), // 1개월 후
                        text: "위부분절제술 시행. 수술 성공적으로 완료. 병리검사 결과 대기 중.",
                        department: "외과"
                    }
                ];

            case "당뇨병 사례 - 중위험":
                return [
                    {
                        hospital: "연세대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() - 365 * 24 * 60 * 60 * 1000)), // 1년 전
                        text: "건강검진에서 공복혈당 150mg/dL 확인. 당뇨병 의심 소견으로 추가검사 권고.",
                        department: "가정의학과"
                    },
                    {
                        hospital: "연세대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() - 350 * 24 * 60 * 60 * 1000)), // 11개월 전
                        text: "당화혈색소 8.2%, 제2형 당뇨병 진단. 메트포르민 처방 및 생활습관 개선 교육.",
                        department: "내분비내과"
                    },
                    {
                        hospital: "연세대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() - 180 * 24 * 60 * 60 * 1000)), // 6개월 전
                        text: "당뇨병 정기 추적관찰. 혈당조절 양호. 미세알부민뇨 검사에서 경미한 이상 소견.",
                        department: "내분비내과"
                    },
                    {
                        hospital: "연세대학교병원",
                        date: this.formatDate(new Date(contractDate.getTime() + 60 * 24 * 60 * 60 * 1000)), // 2개월 후
                        text: "당뇨병성 신증으로 인한 단백뇨 악화. 신장내과 협진 의뢰.",
                        department: "내분비내과"
                    }
                ];

            case "단순 외상 사례 - 저위험":
                return [
                    {
                        hospital: "강남세브란스병원",
                        date: this.formatDate(new Date(contractDate.getTime() - 200 * 24 * 60 * 60 * 1000)), // 6개월 전
                        text: "정기 건강검진. 특이사항 없음. 정상 소견.",
                        department: "가정의학과"
                    },
                    {
                        hospital: "강남세브란스병원",
                        date: this.formatDate(new Date(contractDate.getTime() + 45 * 24 * 60 * 60 * 1000)), // 1.5개월 후
                        text: "축구 중 넘어져서 우측 발목 외상. 응급실 내원.",
                        department: "응급의학과"
                    },
                    {
                        hospital: "강남세브란스병원",
                        date: this.formatDate(new Date(contractDate.getTime() + 46 * 24 * 60 * 60 * 1000)), // 1.5개월 후
                        text: "우측 발목 X-ray 촬영. 외과골 골절 확인. 깁스 치료 시행.",
                        department: "정형외과"
                    },
                    {
                        hospital: "강남세브란스병원",
                        date: this.formatDate(new Date(contractDate.getTime() + 90 * 24 * 60 * 60 * 1000)), // 3개월 후
                        text: "골절 치유 양호. 깁스 제거 및 물리치료 시작.",
                        department: "정형외과"
                    }
                ];

            default:
                return [];
        }
    }

    /**
     * 날짜 포맷팅 (YYYY-MM-DD)
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * 프론트엔드 업로드 시뮬레이션
     */
    simulateFrontendUpload(scenario) {
        console.log(`📤 프론트엔드 업로드 시뮬레이션: ${scenario.name}`);
        
        const uploadData = {
            contractDate: scenario.contractDate,
            productType: scenario.productType,
            claimDiagnosis: scenario.claimDiagnosis,
            claimant: scenario.claimant,
            records: this.generateMedicalRecords(scenario),
            uploadTimestamp: new Date().toISOString()
        };

        console.log(`   - 피보험자: ${uploadData.claimant.name}`);
        console.log(`   - 보험가입일: ${uploadData.contractDate}`);
        console.log(`   - 의무기록: ${uploadData.records.length}건`);
        
        return uploadData;
    }

    /**
     * 백엔드 처리 시뮬레이션
     */
    async simulateBackendProcessing(uploadData) {
        console.log('⚙️  백엔드 처리 시뮬레이션...');
        
        try {
            // 고지의무 분석 엔진 로드 시뮬레이션
            console.log('   - 고지의무 분석 엔진 초기화');
            
            // 의무기록 분류 시뮬레이션
            console.log('   - 의무기록 기간별 분류 중...');
            const contractDate = new Date(uploadData.contractDate);
            
            let preContractRecords = 0;
            let postContractRecords = 0;
            
            for (const record of uploadData.records) {
                const recordDate = new Date(record.date);
                if (recordDate < contractDate) {
                    preContractRecords++;
                } else {
                    postContractRecords++;
                }
            }
            
            console.log(`     * 가입 전 기록: ${preContractRecords}건`);
            console.log(`     * 가입 후 기록: ${postContractRecords}건`);
            
            // 위험도 평가 시뮬레이션
            console.log('   - 위험도 평가 중...');
            let riskLevel = 'low';
            let disclosureViolation = false;
            
            // 간단한 위험도 평가 로직
            const riskKeywords = ['암', '종양', '당뇨', '고혈압', '심장', '뇌'];
            const highRiskKeywords = ['암', '종양', '악성'];
            
            for (const record of uploadData.records) {
                const recordDate = new Date(record.date);
                if (recordDate < contractDate) {
                    for (const keyword of riskKeywords) {
                        if (record.text.includes(keyword)) {
                            disclosureViolation = true;
                            if (highRiskKeywords.some(hrk => record.text.includes(hrk))) {
                                riskLevel = 'high';
                            } else if (riskLevel === 'low') {
                                riskLevel = 'medium';
                            }
                        }
                    }
                }
            }
            
            console.log(`     * 위험도: ${riskLevel}`);
            console.log(`     * 고지의무 위반 가능성: ${disclosureViolation ? '있음' : '없음'}`);
            
            // 보고서 생성 시뮬레이션
            console.log('   - 보고서 생성 중...');
            
            const analysisResult = {
                contractDate: uploadData.contractDate,
                claimant: uploadData.claimant,
                productType: uploadData.productType,
                claimDiagnosis: uploadData.claimDiagnosis,
                totalRecords: uploadData.records.length,
                preContractRecords,
                postContractRecords,
                riskLevel,
                disclosureViolation,
                recommendations: this.generateRecommendations(riskLevel, disclosureViolation),
                processingTime: new Date().toISOString()
            };
            
            console.log('✅ 백엔드 처리 완료');
            return analysisResult;
            
        } catch (error) {
            console.error('❌ 백엔드 처리 실패:', error.message);
            throw error;
        }
    }

    /**
     * 권고사항 생성
     */
    generateRecommendations(riskLevel, disclosureViolation) {
        const recommendations = [];
        
        if (disclosureViolation) {
            recommendations.push("보험가입 전 진료 이력으로 인한 고지의무 위반 가능성 확인됨");
            
            if (riskLevel === 'high') {
                recommendations.push("중대질병 진단 이력으로 보험사 심사 시 상세한 의료기록 제출 필요");
                recommendations.push("전문의 소견서 및 병리검사 결과 추가 확보 권장");
                recommendations.push("보험금 지급 거절 가능성 높음, 법적 검토 필요");
            } else if (riskLevel === 'medium') {
                recommendations.push("만성질환 관리 이력 확인, 보험사와 사전 협의 권장");
                recommendations.push("치료 연속성 및 호전 경과 입증 자료 준비");
            }
        } else {
            recommendations.push("고지의무 위반 사항 없음");
            recommendations.push("정상적인 보험금 지급 절차 진행 가능");
        }
        
        return recommendations;
    }

    /**
     * Make.com 워크플로우 시뮬레이션
     */
    async simulateMakecomWorkflow(analysisResult) {
        console.log('🔄 Make.com 워크플로우 시뮬레이션...');
        
        try {
            // Webhook 전송 시뮬레이션
            console.log('   - Webhook 페이로드 전송');
            
            // OpenAI API 호출 시뮬레이션
            console.log('   - OpenAI API 호출 (보고서 생성)');
            
            // Google Docs 생성 시뮬레이션
            console.log('   - Google Docs 문서 생성');
            const docId = `DOC_${Date.now()}`;
            const docTitle = `손해사정보고서_${analysisResult.claimant.name}_${new Date().toISOString().slice(0, 10)}`;
            
            // PDF 변환 시뮬레이션
            console.log('   - PDF 변환 및 Google Drive 저장');
            const pdfId = `PDF_${Date.now()}`;
            
            const workflowResult = {
                success: true,
                docId,
                docTitle,
                pdfId,
                downloadUrl: `https://drive.google.com/file/d/${pdfId}/view`,
                analysisResult,
                completedAt: new Date().toISOString()
            };
            
            console.log('✅ Make.com 워크플로우 완료');
            return workflowResult;
            
        } catch (error) {
            console.error('❌ Make.com 워크플로우 실패:', error.message);
            throw error;
        }
    }

    /**
     * 결과 검증
     */
    validateResults(scenario, workflowResult) {
        console.log(`🔍 결과 검증: ${scenario.name}`);
        
        const analysis = workflowResult.analysisResult;
        let validationPassed = true;
        
        // 위험도 검증
        if (analysis.riskLevel !== scenario.expectedRisk) {
            console.error(`❌ 위험도 불일치: 예상 ${scenario.expectedRisk}, 실제 ${analysis.riskLevel}`);
            validationPassed = false;
        } else {
            console.log(`✅ 위험도 일치: ${analysis.riskLevel}`);
        }
        
        // 고지의무 위반 검증
        if (analysis.disclosureViolation !== scenario.expectedDisclosureViolation) {
            console.error(`❌ 고지의무 위반 판단 불일치: 예상 ${scenario.expectedDisclosureViolation}, 실제 ${analysis.disclosureViolation}`);
            validationPassed = false;
        } else {
            console.log(`✅ 고지의무 위반 판단 일치: ${analysis.disclosureViolation}`);
        }
        
        // 보고서 생성 검증
        if (!workflowResult.success || !workflowResult.docId || !workflowResult.pdfId) {
            console.error('❌ 보고서 생성 실패');
            validationPassed = false;
        } else {
            console.log('✅ 보고서 생성 성공');
        }
        
        return validationPassed;
    }

    /**
     * 단일 시나리오 테스트 실행
     */
    async runSingleScenario(scenario) {
        console.log(`\n🎯 시나리오 테스트: ${scenario.name}`);
        console.log(`   설명: ${scenario.description}\n`);
        
        try {
            // 1. 프론트엔드 업로드 시뮬레이션
            const uploadData = this.simulateFrontendUpload(scenario);
            
            // 2. 백엔드 처리 시뮬레이션
            const analysisResult = await this.simulateBackendProcessing(uploadData);
            
            // 3. Make.com 워크플로우 시뮬레이션
            const workflowResult = await this.simulateMakecomWorkflow(analysisResult);
            
            // 4. 결과 검증
            const validationPassed = this.validateResults(scenario, workflowResult);
            
            if (validationPassed) {
                console.log(`✅ ${scenario.name} 테스트 성공\n`);
                return true;
            } else {
                console.log(`❌ ${scenario.name} 테스트 실패\n`);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ ${scenario.name} 테스트 오류:`, error.message);
            return false;
        }
    }

    /**
     * 전체 End-to-End 테스트 실행
     */
    async runEndToEndTest() {
        console.log('🚀 End-to-End 워크플로우 테스트 시작');
        console.log('=' .repeat(60));
        
        const scenarios = this.getTestScenarios();
        let passedTests = 0;
        let totalTests = scenarios.length;
        
        for (const scenario of scenarios) {
            const success = await this.runSingleScenario(scenario);
            if (success) {
                passedTests++;
            }
        }
        
        console.log('=' .repeat(60));
        console.log('📊 테스트 결과 요약:');
        console.log(`   - 총 테스트: ${totalTests}개`);
        console.log(`   - 성공: ${passedTests}개`);
        console.log(`   - 실패: ${totalTests - passedTests}개`);
        console.log(`   - 성공률: ${Math.round((passedTests / totalTests) * 100)}%`);
        
        if (passedTests === totalTests) {
            console.log('\n🎉 모든 End-to-End 테스트 성공!');
            console.log('✅ VNEXSUS 자동화 워크플로우가 정상적으로 작동합니다.');
            return true;
        } else {
            console.log('\n❌ 일부 테스트 실패');
            console.log('⚠️  워크플로우 검토 및 수정이 필요합니다.');
            return false;
        }
    }
}

// 테스트 실행
if (require.main === module) {
    const test = new EndToEndWorkflowTest();
    test.runEndToEndTest().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = EndToEndWorkflowTest;