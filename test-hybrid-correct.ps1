# Hybrid API Test Script with correct format

$uri = "http://localhost:3030/api/hybrid/process"

# Read Case1_report.txt
$caseFilePath = "C:\VNEXSUS_Bin\documents\fixtures\Case1_report.txt"
$fileContent = Get-Content -Path $caseFilePath -Raw -Encoding UTF8

# Correct request format based on controller
$testData = @{
    document = @{
        text = $fileContent
    }
    options = @{
        enableDetailedAnalysis = $true
        enablePerformanceMetrics = $true
        qualityThreshold = 0.8
    }
}

$jsonBody = $testData | ConvertTo-Json -Depth 10

$headers = @{
    'Content-Type' = 'application/json; charset=utf-8'
}

try {
    Write-Host "Testing Hybrid API with Case1_report.txt..."
    Write-Host "Document length: $($fileContent.Length) characters"
    
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $jsonBody -Headers $headers
    
    Write-Host "Success!"
    Write-Host "Processing Time: $($response.processingTime)ms"
    Write-Host "Quality Score: $($response.hybrid.qualityScore)"
    Write-Host "Confidence: $($response.hybrid.confidence)"
    Write-Host "Dates found: $($response.dates.Count)"
    Write-Host "Medical entities: $($response.medical.conditions.Count) conditions"
    
    # Save result to file
    $outputPath = "C:\VNEXSUS_Bin\temp\case1_hybrid_result.json"
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
    Write-Host "Result saved to: $outputPath"
    
} catch {
    Write-Host "Error occurred:"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        Write-Host "Status Code:" $_.Exception.Response.StatusCode
        Write-Host "Response:" $_.Exception.Response
    }
}