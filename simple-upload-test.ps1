# 간단한 파일 업로드 테스트
$filePath = "C:\VNEXSUS_Bin\test-medical-document.txt"
$uploadUrl = "http://localhost:3030/api/ocr/upload"

# 파일 존재 확인
if (-not (Test-Path $filePath)) {
    Write-Host "파일을 찾을 수 없습니다: $filePath" -ForegroundColor Red
    exit 1
}

Write-Host "파일 업로드 시작: $filePath" -ForegroundColor Yellow

# 간단한 방법으로 업로드 시도
try {
    # PowerShell 5.1에서 작동하는 방법
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    # 파일 읽기
    $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
    $fileName = [System.IO.Path]::GetFileName($filePath)
    
    # 멀티파트 폼 데이터 생성 - 필드명을 'files'로 변경
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"files`"; filename=`"$fileName`"",
        "Content-Type: text/plain",
        "",
        ""
    ) -join $LF
    
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyLines)
    $bodyBytes += $fileBytes
    $bodyBytes += [System.Text.Encoding]::UTF8.GetBytes("$LF--$boundary--$LF")
    
    # 요청 전송
    $response = Invoke-RestMethod -Uri $uploadUrl -Method Post -Body $bodyBytes -ContentType "multipart/form-data; boundary=$boundary"
    
    Write-Host "업로드 성공!" -ForegroundColor Green
    Write-Host "응답: $($response | ConvertTo-Json)" -ForegroundColor Cyan
    
    if ($response.jobId) {
        Write-Host "작업 ID: $($response.jobId)" -ForegroundColor Magenta
    }
    
} catch {
    Write-Host "업로드 실패: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "응답 내용: $responseBody" -ForegroundColor Yellow
    }
}