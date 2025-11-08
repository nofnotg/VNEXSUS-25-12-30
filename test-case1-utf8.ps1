# Test Case1_report.txt with proper UTF-8 encoding
$case1Path = "documents\fixtures\Case1_report.txt"

if (-not (Test-Path $case1Path)) {
    Write-Host "Error: Case1_report.txt not found at $case1Path"
    exit 1
}

# Read file with proper encoding handling
try {
    $case1Content = Get-Content -Path $case1Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($case1Content)) {
        # Try with different encoding
        $case1Content = Get-Content -Path $case1Path -Raw -Encoding Default
    }
    
    # Clean up any encoding issues
    $case1Content = $case1Content -replace '[^\x20-\x7E\uAC00-\uD7AF\u3131-\u318E\u1100-\u11FF]', ' '
    $case1Content = $case1Content -replace '\s+', ' '
    $case1Content = $case1Content.Trim()
    
    Write-Host "File content length: $($case1Content.Length) characters"
    Write-Host "First 200 characters: $($case1Content.Substring(0, [Math]::Min(200, $case1Content.Length)))"
    
} catch {
    Write-Host "Error reading file: $($_.Exception.Message)"
    exit 1
}

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
    Write-Host "Error processing Case1: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
    }
}