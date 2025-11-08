/**
 * 날짜 추출 테스트 케이스 20종
 * 목표: 80% 이상 추출률 달성
 */

export const dateExtractionTestCases = [
    // 1. 기본 날짜 형식
    {
        id: 'basic-date-1',
        text: '환자는 2024년 1월 15일에 입원하였습니다.',
        expectedDates: [
            { date: '2024-01-15', type: 'admission', confidence: 0.9 }
        ],
        category: 'basic'
    },

    // 2. 상대적 날짜 표현
    {
        id: 'relative-date-1',
        text: '수술은 다음날인 1월 16일에 진행되었습니다.',
        expectedDates: [
            { date: '2024-01-16', type: 'surgery', confidence: 0.8, relative: true }
        ],
        category: 'relative'
    },

    // 3. 복합 날짜 표현
    {
        id: 'complex-date-1',
        text: '퇴원 예정일은 수술 후 3일째인 1월 19일입니다.',
        expectedDates: [
            { date: '2024-01-19', type: 'discharge', confidence: 0.7, calculation: 'surgery+3days' }
        ],
        category: 'complex'
    },

    // 4. 미래 예약 날짜
    {
        id: 'future-date-1',
        text: '재진료는 퇴원 후 1주일 뒤에 예정되어 있습니다.',
        expectedDates: [
            { date: '2024-01-26', type: 'followup', confidence: 0.6, calculation: 'discharge+1week' }
        ],
        category: 'future'
    },

    // 5. 약물 복용 기간
    {
        id: 'medication-period-1',
        text: '항생제는 2024년 2월 1일부터 2월 7일까지 복용하세요.',
        expectedDates: [
            { date: '2024-02-01', type: 'medication_start', confidence: 0.9 },
            { date: '2024-02-07', type: 'medication_end', confidence: 0.9 }
        ],
        category: 'period'
    },

    // 6. 검사 일정
    {
        id: 'test-schedule-1',
        text: 'CT 촬영은 내일 오전 10시에 예정되어 있습니다.',
        expectedDates: [
            { date: '2024-01-16', type: 'ct_scan', confidence: 0.7, time: '10:00', relative: true }
        ],
        category: 'test'
    },

    // 7. 과거 병력
    {
        id: 'medical-history-1',
        text: '환자는 2023년 12월에 당뇨병 진단을 받았습니다.',
        expectedDates: [
            { date: '2023-12', type: 'diagnosis', confidence: 0.8, precision: 'month' }
        ],
        category: 'history'
    },

    // 8. 응급실 내원
    {
        id: 'emergency-1',
        text: '어제 밤 11시경 응급실로 내원하였습니다.',
        expectedDates: [
            { date: '2024-01-14', type: 'emergency_visit', confidence: 0.7, time: '23:00', relative: true }
        ],
        category: 'emergency'
    },

    // 9. 수술 예정
    {
        id: 'surgery-schedule-1',
        text: '맹장 수술이 이번 주 금요일로 예정되어 있습니다.',
        expectedDates: [
            { date: '2024-01-19', type: 'surgery', confidence: 0.6, relative: true, weekday: 'friday' }
        ],
        category: 'surgery'
    },

    // 10. 입원 기간
    {
        id: 'hospitalization-period-1',
        text: '1월 10일부터 1월 20일까지 10일간 입원 치료를 받았습니다.',
        expectedDates: [
            { date: '2024-01-10', type: 'admission', confidence: 0.9 },
            { date: '2024-01-20', type: 'discharge', confidence: 0.9 }
        ],
        category: 'period'
    },

    // 11. 모호한 날짜 표현
    {
        id: 'ambiguous-date-1',
        text: '지난달 말경에 증상이 시작되었습니다.',
        expectedDates: [
            { date: '2023-12-30', type: 'symptom_onset', confidence: 0.4, precision: 'approximate' }
        ],
        category: 'ambiguous'
    },

    // 12. 다중 날짜 문서
    {
        id: 'multiple-dates-1',
        text: '1차 검사: 1월 5일, 2차 검사: 1월 12일, 3차 검사: 1월 19일 예정',
        expectedDates: [
            { date: '2024-01-05', type: 'test_1st', confidence: 0.9 },
            { date: '2024-01-12', type: 'test_2nd', confidence: 0.9 },
            { date: '2024-01-19', type: 'test_3rd', confidence: 0.8 }
        ],
        category: 'multiple'
    },

    // 13. 시간 포함 날짜
    {
        id: 'datetime-1',
        text: '2024년 1월 15일 오후 2시 30분에 외래 진료 예약',
        expectedDates: [
            { date: '2024-01-15', type: 'appointment', confidence: 0.9, time: '14:30' }
        ],
        category: 'datetime'
    },

    // 14. 계산이 필요한 날짜
    {
        id: 'calculated-date-1',
        text: '수술 후 2주 뒤에 실밥 제거 예정입니다.',
        expectedDates: [
            { date: '2024-01-30', type: 'suture_removal', confidence: 0.6, calculation: 'surgery+2weeks' }
        ],
        category: 'calculated'
    },

    // 15. 계절/월 표현
    {
        id: 'seasonal-date-1',
        text: '작년 겨울부터 기침 증상이 지속되고 있습니다.',
        expectedDates: [
            { date: '2023-12', type: 'symptom_onset', confidence: 0.5, precision: 'season' }
        ],
        category: 'seasonal'
    },

    // 16. 연령 기반 날짜
    {
        id: 'age-based-date-1',
        text: '환자는 30세 때 첫 수술을 받았습니다.',
        expectedDates: [
            { date: '2019', type: 'first_surgery', confidence: 0.4, precision: 'year', ageBasedCalculation: true }
        ],
        category: 'age_based'
    },

    // 17. 주기적 치료
    {
        id: 'periodic-treatment-1',
        text: '매주 화요일마다 물리치료를 받고 있습니다.',
        expectedDates: [
            { date: '2024-01-16', type: 'physical_therapy', confidence: 0.7, recurring: 'weekly', weekday: 'tuesday' }
        ],
        category: 'periodic'
    },

    // 18. 응급 상황 시간
    {
        id: 'emergency-time-1',
        text: '새벽 3시경 갑작스런 복통으로 응급실 내원',
        expectedDates: [
            { date: '2024-01-15', type: 'emergency_visit', confidence: 0.6, time: '03:00', relative: true }
        ],
        category: 'emergency'
    },

    // 19. 복합 의료 일정
    {
        id: 'complex-schedule-1',
        text: '수술 전 검사는 1월 14일, 수술은 1월 16일, 퇴원은 1월 20일 예정',
        expectedDates: [
            { date: '2024-01-14', type: 'preop_test', confidence: 0.9 },
            { date: '2024-01-16', type: 'surgery', confidence: 0.9 },
            { date: '2024-01-20', type: 'discharge', confidence: 0.8 }
        ],
        category: 'complex_schedule'
    },

    // 20. 불완전한 날짜 정보
    {
        id: 'incomplete-date-1',
        text: '올해 초에 건강검진을 받았고, 이상 소견은 없었습니다.',
        expectedDates: [
            { date: '2024-01', type: 'health_checkup', confidence: 0.3, precision: 'quarter' }
        ],
        category: 'incomplete'
    }
];

// 테스트 실행 함수
export async function runDateExtractionTests(hybridProcessor) {
    const results = {
        total: dateExtractionTestCases.length,
        passed: 0,
        failed: 0,
        extractionRate: 0,
        details: []
    };

    for (const testCase of dateExtractionTestCases) {
        try {
            const response = await hybridProcessor.processDocument({
                text: testCase.text
            });

            const extractedDates = response.result?.dates || [];
            const expectedCount = testCase.expectedDates.length;
            const extractedCount = extractedDates.length;
            
            const isSuccess = extractedCount >= Math.ceil(expectedCount * 0.8); // 80% 기준
            
            if (isSuccess) {
                results.passed++;
            } else {
                results.failed++;
            }

            results.details.push({
                id: testCase.id,
                category: testCase.category,
                success: isSuccess,
                expected: expectedCount,
                extracted: extractedCount,
                extractionRate: extractedCount / expectedCount,
                dates: extractedDates
            });

        } catch (error) {
            results.failed++;
            results.details.push({
                id: testCase.id,
                category: testCase.category,
                success: false,
                error: error.message
            });
        }
    }

    results.extractionRate = results.passed / results.total;
    return results;
}

// 카테고리별 분석
export function analyzeByCategory(testResults) {
    const categoryStats = {};
    
    testResults.details.forEach(detail => {
        if (!categoryStats[detail.category]) {
            categoryStats[detail.category] = {
                total: 0,
                passed: 0,
                extractionRate: 0
            };
        }
        
        categoryStats[detail.category].total++;
        if (detail.success) {
            categoryStats[detail.category].passed++;
        }
    });

    Object.keys(categoryStats).forEach(category => {
        const stats = categoryStats[category];
        stats.extractionRate = stats.passed / stats.total;
    });

    return categoryStats;
}