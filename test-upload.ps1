# PowerShell 파일 업로드 테스트 스크립트

# 파일 경로 설정
$filePath = "test-medical-document.txt"
$uploadUrl = "http://localhost:3030/api/ocr/upload"

# 파일 존재 확인
if (-not (Test-Path $filePath)) {
    Write-Host "파일을 찾을 수 없습니다: $filePath" -ForegroundColor Red
    exit 1
}

# 파일 내용 읽기
$fileBytes = [System.IO.File]::ReadAllBytes($filePath)
$fileName = [System.IO.Path]::GetFileName($filePath)

# HTTP 클라이언트 생성
Add-Type -AssemblyName System.Net.Http
$httpClient = New-Object System.Net.Http.HttpClient

try {
    # MultipartFormDataContent 생성
    $multipartContent = New-Object System.Net.Http.MultipartFormDataContent
    
    # ByteArrayContent 생성
    $byteArrayContent = New-Object System.Net.Http.ByteArrayContent -ArgumentList @(,$fileBytes)
    
    # 헤더 설정
    $byteArrayContent.Headers.Add("Content-Type", "text/plain")
    
    # 폼 데이터에 추가
    $multipartContent.Add($byteArrayContent, "files", $fileName)
    
    # POST 요청 전송
    Write-Host "파일 업로드 중: $fileName" -ForegroundColor Yellow
    $response = $httpClient.PostAsync($uploadUrl, $multipartContent).Result
    
    # 응답 읽기
    $responseContent = $response.Content.ReadAsStringAsync().Result
    
    # 결과 출력
    Write-Host "상태 코드: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "응답 내용: $responseContent" -ForegroundColor Cyan
    
    # jobId 추출
    if ($response.StatusCode -eq "Accepted") {
        $responseObj = $responseContent | ConvertFrom-Json
        if ($responseObj.jobId) {
            Write-Host "작업 ID: $($responseObj.jobId)" -ForegroundColor Magenta
            return $responseObj.jobId
        }
    }
    
} catch {
    Write-Host "오류 발생: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    # 리소스 정리
    if ($multipartContent) { $multipartContent.Dispose() }
    if ($byteArrayContent) { $byteArrayContent.Dispose() }
    if ($httpClient) { $httpClient.Dispose() }
}