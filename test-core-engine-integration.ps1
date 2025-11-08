# Core Engine Service Integration Test Script

Write-Host "=== Core Engine Service Integration Test Start ===" -ForegroundColor Green

# Test OCR processing endpoint
Write-Host "`n--- Testing OCR Processing ---" -ForegroundColor Yellow
try {
    $ocrTestData = @{
        imageData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"
        options = @{
            language = "ko"
            confidence = 0.8
        }
    } | ConvertTo-Json -Depth 3

    $ocrResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/ocr/process" -Method POST -Body $ocrTestData -ContentType "application/json"
    
    if ($ocrResponse.success) {
        Write-Host "✅ OCR Processing Success" -ForegroundColor Green
        Write-Host "   Extracted Text Length: $($ocrResponse.data.text.Length)" -ForegroundColor Cyan
        Write-Host "   Confidence: $($ocrResponse.data.confidence)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ OCR Processing Failed: $($ocrResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ OCR Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test full pipeline integration
Write-Host "`n--- Testing Full Pipeline Integration ---" -ForegroundColor Yellow
try {
    $pipelineData = @{
        imageData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"
        ocrOptions = @{
            language = "ko"
            confidence = 0.8
        }
        postProcessOptions = @{
            translateTerms = $true
            requireKeywords = $true
            enableTemplateCache = $true
        }
    } | ConvertTo-Json -Depth 3

    $pipelineResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/process/full" -Method POST -Body $pipelineData -ContentType "application/json"
    
    if ($pipelineResponse.success) {
        Write-Host "✅ Full Pipeline Success" -ForegroundColor Green
        Write-Host "   OCR Text Length: $($pipelineResponse.data.ocrResult.text.Length)" -ForegroundColor Cyan
        Write-Host "   Post-processing Steps: $($pipelineResponse.data.postProcessResult.pipeline.Count)" -ForegroundColor Cyan
        Write-Host "   Total Processing Time: $($pipelineResponse.data.totalProcessingTime)ms" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Full Pipeline Failed: $($pipelineResponse.message)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Pipeline Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test health check
Write-Host "`n--- Testing Health Check ---" -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/health" -Method GET
    
    if ($healthResponse.status -eq "healthy") {
        Write-Host "✅ Health Check Passed" -ForegroundColor Green
        Write-Host "   Uptime: $($healthResponse.uptime)" -ForegroundColor Cyan
        Write-Host "   Memory Usage: $($healthResponse.memory.used)MB / $($healthResponse.memory.total)MB" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Health Check Failed: $($healthResponse.status)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Health Check Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test system stats
Write-Host "`n--- Testing System Stats ---" -ForegroundColor Yellow
try {
    $statsResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/stats" -Method GET
    
    Write-Host "✅ System Stats Retrieved" -ForegroundColor Green
    Write-Host "   Total Requests: $($statsResponse.totalRequests)" -ForegroundColor Cyan
    Write-Host "   Successful Requests: $($statsResponse.successfulRequests)" -ForegroundColor Cyan
    Write-Host "   Average Response Time: $($statsResponse.averageResponseTime)ms" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Stats Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Core Engine Service Integration Test Complete ===" -ForegroundColor Green