# Test hybrid API with correct PowerShell syntax
$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    document = @{
        text = "환자명: 김철수, 생년월일: 1980-05-15, 진료일: 2024-01-15, 진단: 고혈압"
    }
    options = @{
        detailed = $true
        performance = $true
        qualityThreshold = 0.8
    }
} | ConvertTo-Json -Depth 3

try {
    Write-Host "Sending request to hybrid API..."
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/hybrid/process" -Method POST -Headers $headers -Body $body
    
    Write-Host "Response received:"
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath "temp\hybrid_test_result.json" -Encoding UTF8
    Write-Host "Result saved to temp\hybrid_test_result.json"
    
    # Display key information
    Write-Host "Status: Success"
    if ($response.processedData) {
        Write-Host "Processed data blocks: $($response.processedData.Count)"
    }
    if ($response.performance) {
        Write-Host "Processing time: $($response.performance.totalTime)ms"
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
}