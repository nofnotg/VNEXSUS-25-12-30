# Post-processing API Debug Test Script

Write-Host "=== Post-processing API Debug Test Start ===" -ForegroundColor Green

# Simple test medical text
$testMedicalText = "2024-01-15 Hospital visit. Patient John Smith. Blood pressure 160/100. Diagnosis: Hypertension. Prescription: Amlodipine 5mg daily."

# Test with minimal options first
Write-Host "`n1. Testing with minimal options..." -ForegroundColor Yellow
try {
    $minimalBody = @{
        ocrText = $testMedicalText
        options = @{}
    } | ConvertTo-Json -Depth 2

    Write-Host "Request Body: $minimalBody" -ForegroundColor Cyan
    
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/process" -Method POST -Body $minimalBody -ContentType "application/json" -Verbose
    
    Write-Host "Success: Response received" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Cyan
    
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    
    # Try to get response content
    try {
        $responseStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($responseStream)
        $responseContent = $reader.ReadToEnd()
        Write-Host "Response Content: $responseContent" -ForegroundColor Red
    } catch {
        Write-Host "Could not read response content: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test debug endpoint
Write-Host "`n2. Testing debug endpoint..." -ForegroundColor Yellow
try {
    $debugBody = @{
        ocrText = $testMedicalText
        options = @{
            includeDebug = $true
        }
    } | ConvertTo-Json -Depth 2

    $debugResponse = Invoke-RestMethod -Uri "http://localhost:3030/api/postprocess/debug" -Method POST -Body $debugBody -ContentType "application/json"
    
    Write-Host "Debug Success: Response received" -ForegroundColor Green
    Write-Host "Debug Response Keys: $($debugResponse.PSObject.Properties.Name -join ', ')" -ForegroundColor Cyan
    
} catch {
    Write-Host "Debug Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Post-processing API Debug Test Complete ===" -ForegroundColor Green