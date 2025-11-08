# Hybrid API Test Script

$uri = "http://localhost:3030/api/hybrid/process"

$testData = @{
    text = "Patient: Kim Chulsoo`nDate: 2024-01-15`nDiagnosis: Hypertension"
}

$jsonBody = $testData | ConvertTo-Json -Depth 5

$headers = @{
    'Content-Type' = 'application/json'
}

try {
    Write-Host "Testing Hybrid API..."
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $jsonBody -Headers $headers
    Write-Host "Success!"
    Write-Host "Response:"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Error occurred:"
    Write-Host $_.Exception.Message
    Write-Host "Status Code:" $_.Exception.Response.StatusCode
}