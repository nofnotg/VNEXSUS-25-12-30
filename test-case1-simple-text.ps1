$headers = @{
    'Content-Type' = 'application/json'
}

$simpleText = @"
환자명: 김철수
생년월일: 1980-05-15
진료일: 2024-01-15
진단: 고혈압
치료내용: 혈압약 처방
"@

$body = @{
    document = @{
        text = $simpleText
    }
    options = @{
        detailed = $true
        performance = $true
        qualityThreshold = 0.8
    }
} | ConvertTo-Json -Depth 3

try {
    Write-Host "Testing hybrid system with simple Korean text..."
    $response = Invoke-RestMethod -Uri 'http://localhost:3030/api/hybrid/process' -Method POST -Headers $headers -Body $body
    
    $outputPath = 'temp\case1_simple_test_result.json'
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
    
    Write-Host "Success: Simple test completed"
    Write-Host "Result saved to: $outputPath"
    
    # Display summary
    if ($response.dates) {
        Write-Host "Dates found: $($response.dates.Count)"
        foreach ($date in $response.dates) {
            Write-Host "  - $($date.date) (confidence: $($date.confidence))"
        }
    }
    if ($response.medical) {
        Write-Host "Medical conditions: $($response.medical.conditions.Count)"
        Write-Host "Medical procedures: $($response.medical.procedures.Count)"
    }
    if ($response.performance) {
        Write-Host "Processing time: $($response.performance.totalPipelineTime)ms"
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    }
}