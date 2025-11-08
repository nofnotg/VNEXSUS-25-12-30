# 간단한 하이브리드 API 테스트

$uri = "http://localhost:3030/api/hybrid/process"
$body = @{
    text = "환자명: 김철수`n진료일: 2024-01-15`n진단: 고혈압"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

try {
    Write-Host "API 테스트 시작..."
    $response = Invoke-RestMethod -Uri $uri -Method Post -Body $body -Headers $headers
    Write-Host "성공!"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "오류: $($_.Exception.Message)"
}