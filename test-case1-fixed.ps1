# Test with fixed Case1_report.txt
$jsonPath = "temp\case1_request.json"

if (-not (Test-Path $jsonPath)) {
    Write-Host "Error: case1_request.json not found at $jsonPath"
    exit 1
}

try {
    $jsonContent = Get-Content -Path $jsonPath -Raw -Encoding UTF8
    Write-Host "Loaded JSON request from: $jsonPath"
    Write-Host "JSON content length: $($jsonContent.Length) characters"
    
    $headers = @{
        'Content-Type' = 'application/json'
    }
    
    Write-Host "Sending request to hybrid API..."
    $response = Invoke-RestMethod -Uri 'http://localhost:3030/api/hybrid/process' -Method POST -Headers $headers -Body $jsonContent
    
    $outputPath = 'temp\case1_hybrid_final_result.json'
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
    
    Write-Host "Success: Case1 hybrid processing completed"
    Write-Host "Result saved to: $outputPath"
    
    # Display detailed summary
    Write-Host "`n=== PROCESSING RESULTS ==="
    
    if ($response.dates) {
        Write-Host "Dates found: $($response.dates.Count)"
        foreach ($date in $response.dates) {
            Write-Host "  - $($date.date) (confidence: $($date.confidence))"
        }
    }
    
    if ($response.medical) {
        Write-Host "Medical conditions: $($response.medical.conditions.Count)"
        if ($response.medical.conditions.Count -gt 0) {
            foreach ($condition in $response.medical.conditions) {
                Write-Host "  - $($condition.name) (confidence: $($condition.confidence))"
            }
        }
        
        Write-Host "Medical procedures: $($response.medical.procedures.Count)"
        if ($response.medical.procedures.Count -gt 0) {
            foreach ($procedure in $response.medical.procedures) {
                Write-Host "  - $($procedure.name) (confidence: $($procedure.confidence))"
            }
        }
        
        Write-Host "Medications: $($response.medical.medications.Count)"
        if ($response.medical.medications.Count -gt 0) {
            foreach ($medication in $response.medical.medications) {
                Write-Host "  - $($medication.name) (confidence: $($medication.confidence))"
            }
        }
    }
    
    if ($response.entities) {
        Write-Host "Entities found: $($response.entities.Count)"
        foreach ($entity in $response.entities) {
            Write-Host "  - $($entity.text) [$($entity.type)] (confidence: $($entity.confidence))"
        }
    }
    
    if ($response.performance) {
        Write-Host "Processing time: $($response.performance.totalPipelineTime)ms"
        Write-Host "Validation: $($response.performance.validation.status)"
    }
    
    Write-Host "`n=== ANALYSIS COMPLETE ==="
    
} catch {
    Write-Host "Error processing Case1: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
        try {
            $errorContent = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorContent)
            $errorText = $reader.ReadToEnd()
            Write-Host "Error details: $errorText"
        } catch {
            Write-Host "Could not read error details"
        }
    }
}