# curl을 사용한 파일 업로드 테스트
$filePath = "c:\VNEXSUS_Bin\test-medical-document.pdf"
$url = "http://localhost:3030/api/enhanced/upload"

Write-Host "curl을 사용한 파일 업로드 테스트..."
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
    # curl 명령 실행 (PowerShell에서 curl.exe 직접 호출)
    $curlPath = "C:\Windows\System32\curl.exe"
    if (Test-Path $curlPath) {
        Write-Host "curl.exe를 사용하여 업로드 중..."
        $result = & $curlPath -X POST -F "files=@$filePath" $url -v 2>&1
        Write-Host "curl 결과:"
        Write-Host $result
    } else {
        Write-Host "curl.exe를 찾을 수 없습니다." -ForegroundColor Red
    }
} catch {
    Write-Host "에러 발생: $($_.Exception.Message)" -ForegroundColor Red
}