# Comprehensive Post-processing API Test Script

Write-Host "=== Comprehensive Post-processing API Test Start ===" -ForegroundColor Green

# Test data with various medical scenarios
$testCases = @(
    @{
        name = "Basic Medical Visit"
        text = "2024-01-15 Hospital visit. Patient John Smith. Blood pressure 160/100. Diagnosis: Hypertension. Prescription: Amlodipine 5mg daily."
        options = @{
            translateTerms = $true
            requireKeywords = $true
            enableTemplateCache = $true
        }
    },
    @{
        name = "Surgery Record"
        text = "2024-02-20 Seoul National University Hospital. Surgery: Appendectomy. Patient: Jane Doe. Surgeon: Dr. Kim. Duration: 2 hours."
        options = @{
            translateTerms = $true
            requireKeywords = $true
            enableTemplateCache = $true
        }
    },
    @{
        name = "Multiple Dates"
        text = "2024-01-10 Initial consultation. 2024-01-15 Follow-up visit. 2024-01-20 Lab results. Blood test normal."
        options = @{
            translateTerms = $false
            requireKeywords = $false
            enableTemplateCache = $false
        }
    }
)

$successCount = 0
$totalTests = $testCases.Count

foreach ($testCase in $testCases) {
    Write-Host "`n--- Testing: $($testCase.name) ---" -ForegroundColor Yellow
    
    try {
        $body = @{
            ocrText = $testCase.text
            options = $testCase.options
        } | ConvertTo-Json -Depth 3

        Write-Host "Request: $($testCase.text.Substring(0, [Math]::Min(50, $testCase.text.Length)))..." -ForegroundColor Cyan
        
        $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $body -ContentType "application/json"
        
        if ($response.success) {
            Write-Host "✅ Success" -ForegroundColor Green
            Write-Host "   Pipeline Steps: $($response.data.pipeline.Count)" -ForegroundColor Cyan
            Write-Host "   Processing Time: $($response.data.statistics.processingTime)ms" -ForegroundColor Cyan
            
            if ($response.data.organizedData) {
                Write-Host "   Organized Data Items: $($response.data.organizedData.Count)" -ForegroundColor Cyan
            }
            
            if ($response.data.reportData) {
                Write-Host "   Report Generated: Yes" -ForegroundColor Cyan
            }
            
            $successCount++
        } else {
            Write-Host "❌ Failed: $($response.message)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test Summary ===" -ForegroundColor Green
Write-Host "Successful Tests: $successCount / $totalTests" -ForegroundColor $(if ($successCount -eq $totalTests) { "Green" } else { "Yellow" })

# Test report generation endpoint
Write-Host "`n--- Testing Report Generation ---" -ForegroundColor Yellow
try {
    $reportResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/stats" -Method GET
    Write-Host "✅ Stats Retrieved" -ForegroundColor Green
    Write-Host "   Total Processed: $($reportResponse.totalProcessed)" -ForegroundColor Cyan
    Write-Host "   Successful: $($reportResponse.successfulProcessing)" -ForegroundColor Cyan
    Write-Host "   Average Time: $($reportResponse.averageProcessingTime)ms" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Stats Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Comprehensive Post-processing Test Complete ===" -ForegroundColor Green