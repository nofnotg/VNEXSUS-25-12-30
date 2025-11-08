# 후처리 API 테스트 스크립트

Write-Host "=== 후처리 API 테스트 시작 ===" -ForegroundColor Green

# Test medical text data
$testMedicalText = @"
Patient: John Smith (Male, 45 years old)
Visit Date: 2024-01-15
Hospital: Seoul National University Hospital Internal Medicine

Chief Complaint: Headache and dizziness due to hypertension

Present Illness:
- Blood pressure elevation since December 2023 (160/100 mmHg)
- Intermittent headache and dizziness complaints
- Family History: Father with hypertension and diabetes

Diagnosis:
1. Essential hypertension (I10)
2. Tension-type headache (G44.2)

Prescription:
- Amlodipine 5mg once daily
- Aspirin 100mg once daily

Plan:
- Follow-up visit in 2 weeks
- Blood pressure monitoring
- Lifestyle modification education
"@

# 1. 후처리 헬스 체크
Write-Host "`n1. 후처리 서비스 상태 확인..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/health" -Method GET
    Write-Host "✅ 후처리 서비스 상태: $($healthResponse.data.status)" -ForegroundColor Green
    Write-Host "   업타임: $([math]::Round($healthResponse.data.uptime / 1000, 2))초" -ForegroundColor Cyan
} catch {
    Write-Host "❌ 후처리 서비스 상태 확인 실패: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. 후처리 통계 확인
Write-Host "`n2. 후처리 통계 확인..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/stats" -Method GET
    Write-Host "✅ 총 처리 건수: $($statsResponse.data.totalProcessed)" -ForegroundColor Green
    Write-Host "   성공 처리 건수: $($statsResponse.data.successfulProcessing)" -ForegroundColor Green
    Write-Host "   평균 처리 시간: $($statsResponse.data.averageProcessingTime)ms" -ForegroundColor Green
} catch {
    Write-Host "❌ 후처리 통계 확인 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 기본 후처리 테스트
Write-Host "`n3. 기본 후처리 테스트..." -ForegroundColor Yellow
try {
    $postprocessBody = @{
        ocrText = $testMedicalText
        options = @{
            translateTerms = $false
            requireKeywords = $false
            useAIExtraction = $false
            reportFormat = "json"
        }
    } | ConvertTo-Json -Depth 3

    $postprocessResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $postprocessBody -ContentType "application/json"
    
    if ($postprocessResponse.success) {
        Write-Host "✅ 기본 후처리 성공" -ForegroundColor Green
        Write-Host "   처리 시간: $($postprocessResponse.data.processingTime)ms" -ForegroundColor Cyan
        Write-Host "   처리된 블록 수: $($postprocessResponse.data.massiveDateResult.dateBlocks.Count)" -ForegroundColor Cyan
        Write-Host "   최종 보고서 생성: $($postprocessResponse.data.finalReport -ne $null)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 기본 후처리 실패: $($postprocessResponse.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 기본 후처리 테스트 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. 향상된 후처리 테스트 (AI 추출 포함)
Write-Host "`n4. 향상된 후처리 테스트 (AI 추출 포함)..." -ForegroundColor Yellow
try {
    $enhancedBody = @{
        ocrText = $testMedicalText
        options = @{
            translateTerms = $true
            requireKeywords = $true
            useAIExtraction = $true
            reportFormat = "json"
            aiExtractionOptions = @{
                extractDiagnoses = $true
                extractMedications = $true
                extractDates = $true
            }
        }
    } | ConvertTo-Json -Depth 3

    $enhancedResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $enhancedBody -ContentType "application/json"
    
    if ($enhancedResponse.success) {
        Write-Host "✅ 향상된 후처리 성공" -ForegroundColor Green
        Write-Host "   처리 시간: $($enhancedResponse.data.processingTime)ms" -ForegroundColor Cyan
        Write-Host "   AI 추출 데이터: $($enhancedResponse.data.aiExtractedData -ne $null)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 향상된 후처리 실패: $($enhancedResponse.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 향상된 후처리 테스트 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. 최종 통계 확인
Write-Host "`n5. 최종 통계 확인..." -ForegroundColor Yellow
try {
    $finalStatsResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/stats" -Method GET
    Write-Host "✅ 최종 총 처리 건수: $($finalStatsResponse.data.totalProcessed)" -ForegroundColor Green
    Write-Host "   최종 성공 처리 건수: $($finalStatsResponse.data.successfulProcessing)" -ForegroundColor Green
    Write-Host "   최종 평균 처리 시간: $($finalStatsResponse.data.averageProcessingTime)ms" -ForegroundColor Green
} catch {
    Write-Host "❌ 최종 통계 확인 실패: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== 후처리 API 테스트 완료 ===" -ForegroundColor Green