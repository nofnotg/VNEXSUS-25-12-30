# Case1_report.txt를 하이브리드 시스템으로 처리하는 PowerShell 스크립트

# 파일 경로 설정
$caseFilePath = "C:\VNEXSUS_Bin\documents\fixtures\Case1_report.txt"
$outputPath = "C:\VNEXSUS_Bin\temp\case1_hybrid_result.json"

# temp 디렉토리 생성 (존재하지 않는 경우)
$tempDir = "C:\VNEXSUS_Bin\temp"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir -Force
}

# Case1_report.txt 파일 읽기
$fileContent = Get-Content -Path $caseFilePath -Raw -Encoding UTF8

# JSON 데이터 구성
$dataObject = @{
    text = $fileContent
}
$jsonData = $dataObject | ConvertTo-Json -Depth 10

# API 호출
try {
    Write-Host "하이브리드 시스템으로 Case1_report.txt 처리 중..."
    
    $response = Invoke-RestMethod -Uri "http://localhost:3030/api/hybrid/process" -Method Post -Body $jsonData -ContentType "application/json; charset=utf-8"
    
    # 결과를 JSON 파일로 저장
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
    
    Write-Host "처리 완료! 결과가 저장되었습니다: $outputPath"
    Write-Host "처리 시간: $($response.processingTime)ms"
    Write-Host "품질 점수: $($response.qualityScore)"
    
} catch {
    Write-Host "오류 발생: $($_.Exception.Message)"
    Write-Host "상세 오류: $($_.Exception)"
}