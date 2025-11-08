# Test Case1_report.txt with hybrid system
$case1Path = "documents\fixtures\Case1_report.txt"

if (-not (Test-Path $case1Path)) {
    Write-Host "Error: Case1_report.txt not found at $case1Path"
    exit 1
}

$case1Content = Get-Content -Path $case1Path -Raw -Encoding UTF8

$headers = @{
    'Content-Type' = 'application/json'
}

$body = @{
    document = @{
        text = $case1Content
    }
    options = @{
        detailed = $true
        performance = $true
        qualityThreshold = 0.8
    }
} | ConvertTo-Json -Depth 3

try {
    Write-Host "Processing Case1_report.txt with hybrid system..."
    $response = Invoke-RestMethod -Uri 'http://localhost:3030/api/hybrid/process' -Method POST -Headers $headers -Body $body
    
    $outputPath = 'temp\case1_hybrid_result.json'
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
    
    Write-Host "Success: Case1 hybrid processing completed"
    Write-Host "Result saved to: $outputPath"
    
    # Display summary
    if ($response.dates) {
        Write-Host "Dates found: $($response.dates.Count)"
    }
    if ($response.medical) {
        Write-Host "Medical conditions: $($response.medical.conditions.Count)"
        Write-Host "Medical procedures: $($response.medical.procedures.Count)"
    }
    if ($response.performance) {
        Write-Host "Processing time: $($response.performance.totalPipelineTime)ms"
    }
    
} catch {
    Write-Host "Error processing Case1: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    }
}