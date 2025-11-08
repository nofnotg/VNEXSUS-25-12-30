# Available Endpoints Test Script

Write-Host "=== Available API Endpoints Test Start ===" -ForegroundColor Green

# Test available endpoints
$endpoints = @(
    @{ method = "GET"; url = "http://localhost:3030/api/status"; name = "API Status" },
    @{ method = "GET"; url = "http://localhost:3030/api/postprocess/stats"; name = "Post-process Stats" },
    @{ method = "GET"; url = "http://localhost:3030/api/postprocess/health"; name = "Post-process Health" },
    @{ method = "GET"; url = "http://localhost:3030/api/enhanced-ocr/status"; name = "Enhanced OCR Status" },
    @{ method = "GET"; url = "http://localhost:3030/api/performance/status"; name = "Performance Status" },
    @{ method = "GET"; url = "http://localhost:3030/api/cache/health"; name = "Cache Health" },
    @{ method = "GET"; url = "http://localhost:3030/api/monitoring/health"; name = "Monitoring Health" },
    @{ method = "GET"; url = "http://localhost:3030/api/intelligence/health"; name = "Intelligence Health" }
)

$successCount = 0
$totalTests = $endpoints.Count

foreach ($endpoint in $endpoints) {
    Write-Host "`n--- Testing: $($endpoint.name) ---" -ForegroundColor Yellow
    
    try {
        if ($endpoint.method -eq "GET") {
            $response = Invoke-RestMethod -Uri $endpoint.url -Method GET -TimeoutSec 10
        } else {
            $response = Invoke-RestMethod -Uri $endpoint.url -Method POST -Body "{}" -ContentType "application/json" -TimeoutSec 10
        }
        
        Write-Host "✅ Success: $($endpoint.name)" -ForegroundColor Green
        
        # Display relevant response data
        if ($response.status) {
            Write-Host "   Status: $($response.status)" -ForegroundColor Cyan
        }
        if ($response.success) {
            Write-Host "   Success: $($response.success)" -ForegroundColor Cyan
        }
        if ($response.message) {
            Write-Host "   Message: $($response.message)" -ForegroundColor Cyan
        }
        if ($response.uptime) {
            Write-Host "   Uptime: $($response.uptime)" -ForegroundColor Cyan
        }
        
        $successCount++
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "❌ Failed: $($endpoint.name) - Status: $statusCode" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Endpoint Test Summary ===" -ForegroundColor Green
Write-Host "Available Endpoints: $successCount / $totalTests" -ForegroundColor $(if ($successCount -gt 0) { "Green" } else { "Red" })

# Test a simple POST endpoint
Write-Host "`n--- Testing POST Endpoint ---" -ForegroundColor Yellow
try {
    $postData = @{
        ocrText = "Simple test text"
        options = @{
            translateTerms = $false
            requireKeywords = $false
            enableTemplateCache = $false
        }
    } | ConvertTo-Json -Depth 3

    $postResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $postData -ContentType "application/json" -TimeoutSec 10
    
    Write-Host "✅ POST Test Success" -ForegroundColor Green
    Write-Host "   Response Success: $($postResponse.success)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ POST Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Available Endpoints Test Complete ===" -ForegroundColor Green