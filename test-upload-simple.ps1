# 간단한 파일 업로드 테스트
$filePath = "C:\VNEXSUS_Bin\test-sample.pdf"
$uri = "http://localhost:3030/api/enhanced/upload"

if (-not (Test-Path $filePath)) {
    Write-Host "파일을 찾을 수 없습니다: $filePath" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "파일 업로드 시작..." -ForegroundColor Yellow
    
    # Add-Type을 사용하여 multipart 요청 생성
    Add-Type -AssemblyName System.Net.Http
    
    $httpClientHandler = New-Object System.Net.Http.HttpClientHandler
    $httpClient = New-Object System.Net.Http.HttpClient($httpClientHandler)
    
    $multipartFormContent = New-Object System.Net.Http.MultipartFormDataContent
    
    $fileStream = [System.IO.File]::OpenRead($filePath)
    $fileName = [System.IO.Path]::GetFileName($filePath)
    $streamContent = New-Object System.Net.Http.StreamContent($fileStream)
    $streamContent.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue("application/pdf")
    
    $multipartFormContent.Add($streamContent, "files", $fileName)
    
    $response = $httpClient.PostAsync($uri, $multipartFormContent).Result
    $responseContent = $response.Content.ReadAsStringAsync().Result
    
    Write-Host "응답 상태: $($response.StatusCode)" -ForegroundColor Cyan
    Write-Host "응답 내용: $responseContent" -ForegroundColor Green
    
    $fileStream.Close()
    $httpClient.Dispose()
    
} catch {
    Write-Host "업로드 실패: $($_.Exception.Message)" -ForegroundColor Red
}