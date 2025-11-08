# 간단한 파일 업로드 테스트 스크립트
$filePath = "c:\VNEXSUS_Bin\test-medical-document.pdf"
$url = "http://localhost:3030/api/enhanced/upload"

Write-Host "파일 업로드 테스트 시작..."
Write-Host "파일: $filePath"
Write-Host "URL: $url"

# 파일 존재 확인
if (-not (Test-Path $filePath)) {
    Write-Host "파일이 존재하지 않습니다: $filePath" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $filePath
Write-Host "파일 크기: $($fileInfo.Length) bytes"

try {
    # 간단한 POST 요청으로 테스트
    $response = Invoke-WebRequest -Uri $url -Method POST -Body @{} -ContentType "application/json"
    Write-Host "응답 상태: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "응답 내용: $($response.Content)"
} catch {
    Write-Host "에러 발생: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "상세 에러: $($_.Exception.Response.StatusCode)"
}