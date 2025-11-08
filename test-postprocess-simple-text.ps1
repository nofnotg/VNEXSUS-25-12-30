# Simple Post-processing API Test Script

Write-Host "=== Simple Post-processing API Test Start ===" -ForegroundColor Green

# Very simple test text
$simpleText = "Hospital visit 2024-01-15"

Write-Host "`n1. Testing with very simple text..." -ForegroundColor Yellow
try {
    $body = @{
        ocrText = $simpleText
        options = @{
            translateTerms = $false
            requireKeywords = $false
            enableTemplateCache = $false
        }
    } | ConvertTo-Json -Depth 2

    Write-Host "Request Body: $body" -ForegroundColor Cyan
    
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "Success: Response received" -ForegroundColor Green
    Write-Host "Response Type: $($response.GetType().Name)" -ForegroundColor Cyan
    
    if ($response -is [string]) {
        Write-Host "Response (String): $response" -ForegroundColor Cyan
    } else {
        Write-Host "Response Keys: $($response.PSObject.Properties.Name -join ', ')" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host "Exception Type: $($_.Exception.GetType().Name)" -ForegroundColor Red
    Write-Host "Exception Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    }
}

Write-Host "`n=== Simple Post-processing API Test Complete ===" -ForegroundColor Green