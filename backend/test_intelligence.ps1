# Intelligence API 테스트 스크립트

# Case1.txt 내용 읽기
$caseText = Get-Content 'C:\MVP_v7_2AI\src\rag\case_sample\Case1.txt' -Raw

# API 요청 데이터 준비
$requestBody = @{
    text = $caseText
    mode = 'intelligence'
    outputFormat = 'timeline'
    costLimit = 1000
    accuracyThreshold = 0.8
} | ConvertTo-Json -Depth 10

Write-Host "=== Intelligence API 테스트 시작 ==="
Write-Host "요청 데이터 크기: $($requestBody.Length) 문자"
Write-Host ""

try {
    # API 호출
    $response = Invoke-RestMethod -Uri 'http://localhost:3030/api/intelligence/process' -Method POST -Body $requestBody -ContentType 'application/json'
    
    Write-Host "=== API 응답 성공 ==="
    Write-Host "Job ID: $($response.jobId)"
    Write-Host "Status: $($response.status)"
    Write-Host ""
    
    # 결과 요약 출력
    if ($response.result) {
        Write-Host "=== 분석 결과 요약 ==="
        Write-Host "총 이벤트 수: $($response.result.totalEvents)"
        Write-Host "시간 범위: $($response.result.timeRange)"
        Write-Host "주요 진단: $($response.result.primaryDiagnosis)"
        Write-Host ""
        
        # 스레드 데이터 요약
        if ($response.result.threadData) {
            Write-Host "=== 타임라인 분석 ==="
            Write-Host "총 기간: $($response.result.threadData.summary.totalPeriods)"
            Write-Host "총 이벤트: $($response.result.threadData.summary.totalEvents)"
            Write-Host "클레임 관련성 점수: $($response.result.threadData.claimRelevance.score)"
            Write-Host ""
        }
        
        # 최종 데이터 요약
        if ($response.result.finalData) {
            Write-Host "=== 최종 분석 결과 ==="
            Write-Host "상태: $($response.result.finalData.summary.condition)"
            Write-Host "발병일: $($response.result.finalData.summary.onset)"
            Write-Host "진단일: $($response.result.finalData.summary.diagnosis)"
            Write-Host "보험 청구 자격: $($response.result.finalData.insuranceClaim.eligibility)"
            Write-Host ""
        }
    }
    
    # 전체 응답을 JSON 파일로 저장
    $response | ConvertTo-Json -Depth 20 | Out-File -FilePath 'intelligence_test_result.json' -Encoding UTF8
    Write-Host "전체 결과가 'intelligence_test_result.json' 파일에 저장되었습니다."
    
} catch {
    Write-Host "=== API 호출 실패 ==="
    Write-Host "오류: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "HTTP 상태: $($_.Exception.Response.StatusCode)"
    }
}

Write-Host ""
Write-Host "=== 테스트 완료 ==="