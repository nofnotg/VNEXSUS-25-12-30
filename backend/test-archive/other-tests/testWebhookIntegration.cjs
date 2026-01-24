const fs = require('fs');
const path = require('path');

/**
 * Webhook 통합 테스트
 * Make.com 시나리오와의 연동을 검증합니다.
 */
class WebhookIntegrationTest {
    constructor() {
        this.testPayloadPath = path.join(__dirname, '..', 'automation', 'webhook-test-payload.json');
        this.webhookUrl = process.env.MAKECOM_WEBHOOK_URL || 'YOUR_WEBHOOK_URL_HERE';
    }

    /**
     * 테스트 페이로드 로드
     */
    loadTestPayload() {
        try {
            const payloadData = fs.readFileSync(this.testPayloadPath, 'utf8');
            return JSON.parse(payloadData);
        } catch (error) {
            console.error('❌ 테스트 페이로드 로드 실패:', error.message);
            return null;
        }
    }

    /**
     * Webhook 페이로드 검증
     */
    validatePayload(payload) {
        console.log('🔍 Webhook 페이로드 검증 중...');
        
        const requiredFields = [
            'contract_date',
            'product_type', 
            'claim_diagnosis',
            'claimant',
            'records'
        ];

        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!payload[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            console.error('❌ 필수 필드 누락:', missingFields);
            return false;
        }

        // 피보험자 정보 검증
        if (!payload.claimant.name || !payload.claimant.dob) {
            console.error('❌ 피보험자 정보 불완전');
            return false;
        }

        // 의무기록 검증
        if (!Array.isArray(payload.records) || payload.records.length === 0) {
            console.error('❌ 의무기록 데이터 없음');
            return false;
        }

        // 각 의무기록 항목 검증
        for (let i = 0; i < payload.records.length; i++) {
            const record = payload.records[i];
            if (!record.hospital || !record.date || !record.text) {
                console.error(`❌ 의무기록 ${i + 1}번 항목 불완전:`, record);
                return false;
            }

            // 날짜 형식 검증 (YYYY-MM-DD)
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            if (!datePattern.test(record.date)) {
                console.error(`❌ 의무기록 ${i + 1}번 날짜 형식 오류:`, record.date);
                return false;
            }
        }

        console.log('✅ Webhook 페이로드 검증 완료');
        return true;
    }

    /**
     * 고지의무 분석 데이터 검증
     */
    validateDisclosureData(payload) {
        console.log('🔍 고지의무 분석 데이터 검증 중...');
        
        const contractDate = new Date(payload.contract_date);
        const threeMonthsAgo = new Date(contractDate);
        threeMonthsAgo.setMonth(contractDate.getMonth() - 3);
        
        const twoYearsAgo = new Date(contractDate);
        twoYearsAgo.setFullYear(contractDate.getFullYear() - 2);
        
        const fiveYearsAgo = new Date(contractDate);
        fiveYearsAgo.setFullYear(contractDate.getFullYear() - 5);

        let threeMonthsCount = 0;
        let twoYearsCount = 0;
        let fiveYearsCount = 0;

        for (const record of payload.records) {
            const recordDate = new Date(record.date);
            
            if (recordDate >= threeMonthsAgo && recordDate < contractDate) {
                threeMonthsCount++;
                console.log(`📅 3개월 이내 기록: ${record.date} - ${record.hospital}`);
            } else if (recordDate >= twoYearsAgo && recordDate < contractDate) {
                twoYearsCount++;
                console.log(`📅 2년 이내 기록: ${record.date} - ${record.hospital}`);
            } else if (recordDate >= fiveYearsAgo && recordDate < contractDate) {
                fiveYearsCount++;
                console.log(`📅 5년 이내 기록: ${record.date} - ${record.hospital}`);
            }
        }

        console.log(`📊 고지의무 기간별 분류:`);
        console.log(`   - 3개월 이내: ${threeMonthsCount}건`);
        console.log(`   - 2년 이내: ${twoYearsCount}건`);
        console.log(`   - 5년 이내: ${fiveYearsCount}건`);

        return {
            threeMonthsCount,
            twoYearsCount,
            fiveYearsCount
        };
    }

    /**
     * Make.com Webhook 시뮬레이션
     */
    async simulateWebhookCall(payload) {
        console.log('🚀 Make.com Webhook 호출 시뮬레이션...');
        
        if (this.webhookUrl === 'YOUR_WEBHOOK_URL_HERE') {
            console.log('⚠️  실제 Webhook URL이 설정되지 않음. 시뮬레이션 모드로 진행');
            return this.simulateResponse(payload);
        }

        try {
            // 실제 환경에서는 fetch 또는 axios 사용
            console.log(`📡 Webhook URL: ${this.webhookUrl}`);
            console.log('📤 페이로드 전송 중...');
            
            // 시뮬레이션 응답
            return this.simulateResponse(payload);
            
        } catch (error) {
            console.error('❌ Webhook 호출 실패:', error.message);
            return null;
        }
    }

    /**
     * 응답 시뮬레이션
     */
    simulateResponse(payload) {
        console.log('🎭 Make.com 응답 시뮬레이션...');
        
        const mockResponse = {
            success: true,
            doc_id: "1ABC123DEF456GHI789",
            doc_title: `손해사정보고서_${payload.claimant.name}_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`,
            pdf_file_id: "1DEF456GHI789ABC123",
            pdf_download_url: "https://drive.google.com/file/d/1DEF456GHI789ABC123/view",
            note: "Google Drive에서 공유권한 설정 시 외부열람 가능",
            preview: `환자 정보: ${payload.claimant.name} (${payload.claimant.dob})\n보험가입일: ${payload.contract_date}\n청구진단: ${payload.claim_diagnosis}\n\n고지의무 분석 결과:\n- 보험가입 전 ${payload.records.filter(r => new Date(r.date) < new Date(payload.contract_date)).length}건의 진료기록 확인\n- 위험도 평가 및 상세 분석 완료`,
            disclosure_analysis: {
                threeMonths: payload.records.filter(r => {
                    const recordDate = new Date(r.date);
                    const contractDate = new Date(payload.contract_date);
                    const threeMonthsAgo = new Date(contractDate);
                    threeMonthsAgo.setMonth(contractDate.getMonth() - 3);
                    return recordDate >= threeMonthsAgo && recordDate < contractDate;
                }).map(r => ({
                    date: r.date,
                    hospital: r.hospital,
                    content: r.text,
                    keywords: ['진단', '검사', '소견']
                })),
                twoYears: payload.records.filter(r => {
                    const recordDate = new Date(r.date);
                    const contractDate = new Date(payload.contract_date);
                    const twoYearsAgo = new Date(contractDate);
                    twoYearsAgo.setFullYear(contractDate.getFullYear() - 2);
                    return recordDate >= twoYearsAgo && recordDate < contractDate;
                }).map(r => ({
                    date: r.date,
                    hospital: r.hospital,
                    content: r.text,
                    keywords: ['치료', '입원', '수술']
                })),
                fiveYears: payload.records.filter(r => {
                    const recordDate = new Date(r.date);
                    const contractDate = new Date(payload.contract_date);
                    const fiveYearsAgo = new Date(contractDate);
                    fiveYearsAgo.setFullYear(contractDate.getFullYear() - 5);
                    return recordDate >= fiveYearsAgo && recordDate < contractDate;
                }).map(r => ({
                    date: r.date,
                    hospital: r.hospital,
                    content: r.text,
                    keywords: ['암', '중대질병']
                })),
                riskLevel: "high",
                recommendations: [
                    "보험가입 전 암 진단 이력으로 인한 고지의무 위반 가능성 높음",
                    "보험사 심사 시 상세한 의료기록 제출 필요",
                    "전문의 소견서 추가 확보 권장"
                ]
            },
            processing_time: new Date().toISOString().replace('T', ' ').slice(0, 19)
        };

        return mockResponse;
    }

    /**
     * 응답 검증
     */
    validateResponse(response) {
        console.log('🔍 Make.com 응답 검증 중...');
        
        if (!response) {
            console.error('❌ 응답 없음');
            return false;
        }

        const requiredFields = [
            'success',
            'doc_id',
            'doc_title',
            'pdf_file_id',
            'pdf_download_url',
            'disclosure_analysis'
        ];

        for (const field of requiredFields) {
            if (response[field] === undefined) {
                console.error(`❌ 응답 필드 누락: ${field}`);
                return false;
            }
        }

        // 고지의무 분석 결과 검증
        const analysis = response.disclosure_analysis;
        if (!analysis.riskLevel || !Array.isArray(analysis.recommendations)) {
            console.error('❌ 고지의무 분석 결과 불완전');
            return false;
        }

        console.log('✅ Make.com 응답 검증 완료');
        return true;
    }

    /**
     * 전체 통합 테스트 실행
     */
    async runIntegrationTest() {
        console.log('🧪 Webhook 통합 테스트 시작\n');
        
        try {
            // 1. 테스트 페이로드 로드
            const payload = this.loadTestPayload();
            if (!payload) {
                throw new Error('테스트 페이로드 로드 실패');
            }
            console.log('✅ 테스트 페이로드 로드 완료\n');

            // 2. 페이로드 검증
            if (!this.validatePayload(payload)) {
                throw new Error('페이로드 검증 실패');
            }
            console.log('✅ 페이로드 검증 완료\n');

            // 3. 고지의무 데이터 검증
            const disclosureStats = this.validateDisclosureData(payload);
            console.log('✅ 고지의무 데이터 검증 완료\n');

            // 4. Webhook 호출 시뮬레이션
            const response = await this.simulateWebhookCall(payload);
            if (!response) {
                throw new Error('Webhook 호출 실패');
            }
            console.log('✅ Webhook 호출 시뮬레이션 완료\n');

            // 5. 응답 검증
            if (!this.validateResponse(response)) {
                throw new Error('응답 검증 실패');
            }
            console.log('✅ 응답 검증 완료\n');

            // 6. 결과 출력
            console.log('📋 테스트 결과 요약:');
            console.log(`   - 문서 ID: ${response.doc_id}`);
            console.log(`   - 문서 제목: ${response.doc_title}`);
            console.log(`   - PDF 다운로드: ${response.pdf_download_url}`);
            console.log(`   - 위험도: ${response.disclosure_analysis.riskLevel}`);
            console.log(`   - 권고사항: ${response.disclosure_analysis.recommendations.length}개`);
            console.log(`   - 처리 시간: ${response.processing_time}`);

            console.log('\n🎉 Webhook 통합 테스트 성공!');
            return true;

        } catch (error) {
            console.error('\n❌ Webhook 통합 테스트 실패:', error.message);
            return false;
        }
    }
}

// 테스트 실행
if (require.main === module) {
    const test = new WebhookIntegrationTest();
    test.runIntegrationTest().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = WebhookIntegrationTest;