# Complete Workflow Integration Test and Report Script

Write-Host "=== VNEXSUS Complete Workflow Integration Test ===" -ForegroundColor Green
Write-Host "Test Started: $(Get-Date)" -ForegroundColor Cyan

# Initialize test results
$testResults = @{
    StartTime = Get-Date
    TotalTests = 0
    PassedTests = 0
    FailedTests = 0
    TestDetails = @()
}

# Function to add test result
function Add-TestResult {
    param($TestName, $Status, $Details, $ResponseTime = 0)
    
    $testResults.TotalTests++
    if ($Status -eq "PASS") {
        $testResults.PassedTests++
        Write-Host "✅ $TestName" -ForegroundColor Green
    } else {
        $testResults.FailedTests++
        Write-Host "❌ $TestName" -ForegroundColor Red
    }
    
    $testResults.TestDetails += @{
        Name = $TestName
        Status = $Status
        Details = $Details
        ResponseTime = $ResponseTime
        Timestamp = Get-Date
    }
    
    if ($Details) {
        Write-Host "   $Details" -ForegroundColor Cyan
    }
}

Write-Host "`n=== 1. System Health Check ===" -ForegroundColor Yellow

# Test 1: API Status
try {
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/status" -Method GET -TimeoutSec 10
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.success -and $response.status -eq "healthy") {
        Add-TestResult "API Status Check" "PASS" "Service is healthy" $responseTime
    } else {
        Add-TestResult "API Status Check" "FAIL" "Service status: $($response.status)" $responseTime
    }
} catch {
    Add-TestResult "API Status Check" "FAIL" "Error: $($_.Exception.Message)"
}

# Test 2: Post-processing Health
try {
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/health" -Method GET -TimeoutSec 10
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.success) {
        Add-TestResult "Post-processing Health" "PASS" "Post-processing service is healthy" $responseTime
    } else {
        Add-TestResult "Post-processing Health" "FAIL" "Health check failed" $responseTime
    }
} catch {
    Add-TestResult "Post-processing Health" "FAIL" "Error: $($_.Exception.Message)"
}

Write-Host "`n=== 2. Core Functionality Tests ===" -ForegroundColor Yellow

# Test 3: Simple Text Processing
try {
    $startTime = Get-Date
    $body = @{
        ocrText = "Hospital visit 2024-01-15. Patient diagnosis: Hypertension."
        options = @{
            translateTerms = $false
            requireKeywords = $false
            enableTemplateCache = $false
        }
    } | ConvertTo-Json -Depth 3

    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.success) {
        Add-TestResult "Simple Text Processing" "PASS" "Processing time: $($response.data.statistics.processingTime)ms" $responseTime
    } else {
        Add-TestResult "Simple Text Processing" "FAIL" "Processing failed: $($response.message)" $responseTime
    }
} catch {
    Add-TestResult "Simple Text Processing" "FAIL" "Error: $($_.Exception.Message)"
}

# Test 4: Complex Medical Text Processing
try {
    $startTime = Get-Date
    $complexText = @"
2024-01-15 서울대학교병원
환자명: 김철수 (남, 45세)
진료과: 내과
주치의: 박의사

주요 증상:
- 고혈압 (160/100 mmHg)
- 당뇨병 (공복혈당 180mg/dL)
- 고지혈증

처방:
- 아모디핀 5mg 1일 1회
- 메트포르민 500mg 1일 2회

다음 진료 예약: 2024-02-15
"@

    $body = @{
        ocrText = $complexText
        options = @{
            translateTerms = $true
            requireKeywords = $true
            enableTemplateCache = $true
        }
    } | ConvertTo-Json -Depth 3

    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 20
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.success) {
        $organizedCount = if ($response.data.organizedData) { $response.data.organizedData.Count } else { 0 }
        Add-TestResult "Complex Medical Text Processing" "PASS" "Organized data items: $organizedCount, Processing time: $($response.data.statistics.processingTime)ms" $responseTime
    } else {
        Add-TestResult "Complex Medical Text Processing" "FAIL" "Processing failed: $($response.message)" $responseTime
    }
} catch {
    Add-TestResult "Complex Medical Text Processing" "FAIL" "Error: $($_.Exception.Message)"
}

Write-Host "`n=== 3. Advanced Features Tests ===" -ForegroundColor Yellow

# Test 5: Debug Mode Processing
try {
    $startTime = Get-Date
    $body = @{
        ocrText = "2024-03-10 병원 방문. 혈압 측정 결과 정상."
        options = @{
            translateTerms = $true
            requireKeywords = $false
            enableTemplateCache = $true
            includeDebug = $true
        }
    } | ConvertTo-Json -Depth 3

    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/debug" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.success) {
        Add-TestResult "Debug Mode Processing" "PASS" "Debug info included" $responseTime
    } else {
        Add-TestResult "Debug Mode Processing" "FAIL" "Debug processing failed: $($response.message)" $responseTime
    }
} catch {
    Add-TestResult "Debug Mode Processing" "FAIL" "Error: $($_.Exception.Message)"
}

# Test 6: Statistics Retrieval
try {
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/stats" -Method GET -TimeoutSec 10
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.success) {
        Add-TestResult "Statistics Retrieval" "PASS" "Total processed: $($response.totalProcessed), Success rate: $($response.successfulProcessing)" $responseTime
    } else {
        Add-TestResult "Statistics Retrieval" "FAIL" "Stats retrieval failed" $responseTime
    }
} catch {
    Add-TestResult "Statistics Retrieval" "FAIL" "Error: $($_.Exception.Message)"
}

Write-Host "`n=== 4. Performance and Monitoring Tests ===" -ForegroundColor Yellow

# Test 7: Performance Monitoring
try {
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/performance/status" -Method GET -TimeoutSec 10
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.success) {
        Add-TestResult "Performance Monitoring" "PASS" "Status: $($response.status)" $responseTime
    } else {
        Add-TestResult "Performance Monitoring" "FAIL" "Performance check failed" $responseTime
    }
} catch {
    Add-TestResult "Performance Monitoring" "FAIL" "Error: $($_.Exception.Message)"
}

# Test 8: Cache Health
try {
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/cache/health" -Method GET -TimeoutSec 10
    $responseTime = ((Get-Date) - $startTime).TotalMilliseconds
    
    if ($response.status -eq "healthy") {
        Add-TestResult "Cache Health Check" "PASS" "Cache is healthy" $responseTime
    } else {
        Add-TestResult "Cache Health Check" "FAIL" "Cache status: $($response.status)" $responseTime
    }
} catch {
    Add-TestResult "Cache Health Check" "FAIL" "Error: $($_.Exception.Message)"
}

# Calculate test completion time
$testResults.EndTime = Get-Date
$testResults.TotalDuration = ($testResults.EndTime - $testResults.StartTime).TotalSeconds

Write-Host "`n=== INTEGRATION TEST REPORT ===" -ForegroundColor Green
Write-Host "Test Execution Summary:" -ForegroundColor White
Write-Host "  Start Time: $($testResults.StartTime)" -ForegroundColor Cyan
Write-Host "  End Time: $($testResults.EndTime)" -ForegroundColor Cyan
Write-Host "  Total Duration: $([math]::Round($testResults.TotalDuration, 2)) seconds" -ForegroundColor Cyan
Write-Host "  Total Tests: $($testResults.TotalTests)" -ForegroundColor Cyan
Write-Host "  Passed: $($testResults.PassedTests)" -ForegroundColor Green
Write-Host "  Failed: $($testResults.FailedTests)" -ForegroundColor Red
Write-Host "  Success Rate: $([math]::Round(($testResults.PassedTests / $testResults.TotalTests) * 100, 1))%" -ForegroundColor $(if ($testResults.PassedTests -eq $testResults.TotalTests) { "Green" } else { "Yellow" })

Write-Host "`nDetailed Test Results:" -ForegroundColor White
foreach ($test in $testResults.TestDetails) {
    $statusColor = if ($test.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "  [$($test.Status)] $($test.Name)" -ForegroundColor $statusColor
    if ($test.ResponseTime -gt 0) {
        Write-Host "    Response Time: $([math]::Round($test.ResponseTime, 0))ms" -ForegroundColor Gray
    }
    if ($test.Details) {
        Write-Host "    Details: $($test.Details)" -ForegroundColor Gray
    }
}

# Generate JSON report
$jsonReport = $testResults | ConvertTo-Json -Depth 4
$reportPath = "c:\VNEXSUS_Bin\integration-test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$jsonReport | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host "`nReport saved to: $reportPath" -ForegroundColor Cyan

# Final status
if ($testResults.FailedTests -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED! VNEXSUS system is fully operational." -ForegroundColor Green
} elseif ($testResults.PassedTests -gt $testResults.FailedTests) {
    Write-Host "`n⚠️  Most tests passed, but some issues detected. System is mostly operational." -ForegroundColor Yellow
} else {
    Write-Host "`n❌ Multiple test failures detected. System requires attention." -ForegroundColor Red
}

Write-Host "`n=== Integration Test Complete ===" -ForegroundColor Green