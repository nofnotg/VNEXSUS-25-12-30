$headers = @{
    'Content-Type' = 'application/json'
}

$body = @{
    document = @{
        text = 'Patient: Kim Chulsoo, DOB: 1980-05-15, Visit: 2024-01-15, Diagnosis: Hypertension'
    }
    options = @{
        detailed = $true
        performance = $true
        qualityThreshold = 0.8
    }
} | ConvertTo-Json -Depth 3

try {
    $response = Invoke-RestMethod -Uri 'http://localhost:3030/api/hybrid/process' -Method POST -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath 'temp\hybrid_test_result.json' -Encoding UTF8
    Write-Host 'Success: Result saved to temp\hybrid_test_result.json'
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}