# Simple Post-processing API Test Script

Write-Host "=== Post-processing API Test Start ===" -ForegroundColor Green

# Test medical text data
$testMedicalText = "Patient: John Smith (Male, 45 years old). Visit Date: 2024-01-15. Hospital: Seoul National University Hospital Internal Medicine. Chief Complaint: Headache and dizziness due to hypertension. Present Illness: Blood pressure elevation since December 2023 (160/100 mmHg). Intermittent headache and dizziness complaints. Family History: Father with hypertension and diabetes. Diagnosis: 1. Essential hypertension (I10) 2. Tension-type headache (G44.2). Prescription: Amlodipine 5mg once daily, Aspirin 100mg once daily. Plan: Follow-up visit in 2 weeks, Blood pressure monitoring, Lifestyle modification education."

# 1. Health Check
Write-Host "`n1. Post-processing Service Health Check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/health" -Method GET
    Write-Host "Success: Service Status = $($healthResponse.data.status)" -ForegroundColor Green
    Write-Host "Uptime: $([math]::Round($healthResponse.data.uptime / 1000, 2)) seconds" -ForegroundColor Cyan
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Statistics Check
Write-Host "`n2. Post-processing Statistics Check..." -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/stats" -Method GET
    Write-Host "Success: Total Processed = $($statsResponse.data.totalProcessed)" -ForegroundColor Green
    Write-Host "Successful Processing = $($statsResponse.data.successfulProcessing)" -ForegroundColor Green
    Write-Host "Average Processing Time = $($statsResponse.data.averageProcessingTime)ms" -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Basic Post-processing Test
Write-Host "`n3. Basic Post-processing Test..." -ForegroundColor Yellow
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
        Write-Host "Success: Basic post-processing completed" -ForegroundColor Green
        Write-Host "Processing Time: $($postprocessResponse.data.processingTime)ms" -ForegroundColor Cyan
        Write-Host "Date Blocks Count: $($postprocessResponse.data.massiveDateResult.dateBlocks.Count)" -ForegroundColor Cyan
        Write-Host "Final Report Generated: $($postprocessResponse.data.finalReport -ne $null)" -ForegroundColor Cyan
    } else {
        Write-Host "Failed: $($postprocessResponse.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Final Statistics Check
Write-Host "`n4. Final Statistics Check..." -ForegroundColor Yellow
try {
    $finalStatsResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/stats" -Method GET
    Write-Host "Success: Final Total Processed = $($finalStatsResponse.data.totalProcessed)" -ForegroundColor Green
    Write-Host "Final Successful Processing = $($finalStatsResponse.data.successfulProcessing)" -ForegroundColor Green
    Write-Host "Final Average Processing Time = $($finalStatsResponse.data.averageProcessingTime)ms" -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Post-processing API Test Complete ===" -ForegroundColor Green