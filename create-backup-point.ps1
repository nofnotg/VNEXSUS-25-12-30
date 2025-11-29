# 통합 백업 포인트 생성 스크립트
# 사용법:
#   .\create-backup-point.ps1 -BackupMessage "기능 완료"
#   .\create-backup-point.ps1 -BackupMessage "버그 수정" -PushToGitHub
#   .\create-backup-point.ps1 -BackupMessage "마일스톤" -PushToGitHub -BackupToGDrive

param(
    [string]$BackupMessage = "자동 백업 포인트",
    [switch]$PushToGitHub,
    [switch]$BackupToGDrive,
    [switch]$SkipCommit
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$tagName = "backup-$timestamp"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🎯 VNEXSUS 백업 포인트 생성" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "📝 백업 메시지: $BackupMessage" -ForegroundColor White
Write-Host "🏷️  태그 이름: $tagName" -ForegroundColor White
Write-Host "📅 백업 시간: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host ""

# 현재 Git 상태 확인
Write-Host "🔍 Git 상태 확인 중..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
$changedFiles = ($gitStatus | Measure-Object).Count

if ($changedFiles -eq 0 -and -not $SkipCommit) {
    Write-Host "ℹ️  변경된 파일이 없습니다." -ForegroundColor Cyan
    Write-Host "   태그만 생성합니다." -ForegroundColor Cyan
    $SkipCommit = $true
}
else {
    Write-Host "✅ 변경된 파일: $changedFiles 개" -ForegroundColor Green
}

Write-Host ""

# 1. Git 로컬 백업
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "📦 1단계: Git 로컬 백업" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

if (-not $SkipCommit) {
    Write-Host "📁 파일 스테이징 중..." -ForegroundColor Cyan
    git add .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 스테이징 완료" -ForegroundColor Green
    }
    else {
        Write-Host "❌ 스테이징 실패" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "💾 커밋 생성 중..." -ForegroundColor Cyan
    git commit -m "백업: $BackupMessage ($timestamp)"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 커밋 완료" -ForegroundColor Green
    }
    else {
        Write-Host "❌ 커밋 실패" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "🏷️  태그 생성 중..." -ForegroundColor Cyan
git tag -a $tagName -m "백업 포인트: $BackupMessage"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 태그 생성 완료: $tagName" -ForegroundColor Green
}
else {
    Write-Host "❌ 태그 생성 실패" -ForegroundColor Red
    exit 1
}

# 현재 커밋 해시 가져오기
$commitHash = git rev-parse --short HEAD
Write-Host "   커밋 해시: $commitHash" -ForegroundColor White

Write-Host ""

# 2. GitHub 푸시 (옵션)
if ($PushToGitHub) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "☁️  2단계: GitHub 원격 백업" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host ""
    
    Write-Host "📤 main 브랜치 푸시 중..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 브랜치 푸시 완료" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  브랜치 푸시 실패 (계속 진행)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "🏷️  태그 푸시 중..." -ForegroundColor Cyan
    git push origin --tags
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 태그 푸시 완료" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  태그 푸시 실패 (계속 진행)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "🌐 GitHub 저장소: https://github.com/charmorzr-pro/VNEXSUS_Bin.git" -ForegroundColor Cyan
    Write-Host ""
}
else {
    Write-Host "ℹ️  GitHub 푸시 건너뛰기 (-PushToGitHub 플래그 미사용)" -ForegroundColor DarkGray
    Write-Host ""
}

# 3. Google Drive 백업 (옵션)
if ($BackupToGDrive) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host "💾 3단계: Google Drive 백업" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
    Write-Host ""
    
    $scriptPath = Join-Path $PSScriptRoot "backup-to-gdrive.ps1"
    
    if (Test-Path $scriptPath) {
        & $scriptPath
    }
    else {
        Write-Host "❌ backup-to-gdrive.ps1 스크립트를 찾을 수 없습니다." -ForegroundColor Red
        Write-Host "   경로: $scriptPath" -ForegroundColor Red
    }
    
    Write-Host ""
}
else {
    Write-Host "ℹ️  Google Drive 백업 건너뛰기 (-BackupToGDrive 플래그 미사용)" -ForegroundColor DarkGray
    Write-Host ""
}

# 백업 요약
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🎉 백업 완료!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "📋 백업 정보:" -ForegroundColor Cyan
Write-Host "   • 태그: $tagName" -ForegroundColor White
Write-Host "   • 커밋: $commitHash" -ForegroundColor White
Write-Host "   • 메시지: $BackupMessage" -ForegroundColor White
Write-Host "   - GitHub Push: $(if ($PushToGitHub) { 'YES' } else { 'NO' })" -ForegroundColor White
Write-Host "   - Google Drive: $(if ($BackupToGDrive) { 'YES' } else { 'NO' })" -ForegroundColor White
Write-Host ""
Write-Host "🔙 롤백 명령어:" -ForegroundColor Cyan
Write-Host "   git checkout $tagName" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 태그 목록 확인:" -ForegroundColor Cyan
Write-Host "   git tag -l" -ForegroundColor Yellow
Write-Host ""
