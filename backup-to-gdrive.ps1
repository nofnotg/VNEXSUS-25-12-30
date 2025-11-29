# Google Drive 백업 스크립트
# 사용법: .\backup-to-gdrive.ps1
# 또는: .\backup-to-gdrive.ps1 -GDrivePath "D:\GoogleDrive\Backups"

param(
    [string]$SourcePath = "C:\VNEXSUS_11-23",
    [string]$GDrivePath = "C:\Users\Chung\OneDrive\VNEXSUS_Backups"
)

# 백업 디렉토리 생성
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$backupName = "VNEXSUS_Backup_$timestamp"
$backupPath = Join-Path $GDrivePath $backupName

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🔄 VNEXSUS Google Drive 백업 시작" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "📁 원본 경로: $SourcePath" -ForegroundColor White
Write-Host "💾 백업 경로: $backupPath" -ForegroundColor White
Write-Host "📅 백업 시간: $timestamp" -ForegroundColor White
Write-Host ""

# Google Drive 경로 확인 및 생성
if (-not (Test-Path $GDrivePath)) {
    Write-Host "📁 백업 디렉토리 생성 중..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $GDrivePath -Force | Out-Null
    Write-Host "✅ 디렉토리 생성 완료" -ForegroundColor Green
}

# 제외할 폴더 목록
$excludeDirs = @(
    "node_modules",
    ".git",
    "dist",
    "build",
    "logs",
    "temp",
    "uploads",
    "outputs",
    "backend\uploads",
    "backend\temp",
    "backend\logs",
    "frontend\node_modules"
)

Write-Host "🚫 제외 폴더: $($excludeDirs.Count)개" -ForegroundColor Yellow
Write-Host ""

# robocopy를 사용한 백업 (빠르고 안정적)
Write-Host "📦 파일 복사 중..." -ForegroundColor Cyan

$excludeParams = $excludeDirs | ForEach-Object { "/XD", "`"$_`"" }
$robocopyArgs = @(
    "`"$SourcePath`"",
    "`"$backupPath`"",
    "/E",           # 하위 디렉토리 포함 (빈 폴더도)
    "/Z",           # 재시작 가능 모드
    "/R:3",         # 재시도 3회
    "/W:5",         # 재시도 대기 5초
    "/NFL",         # 파일 목록 표시 안함
    "/NDL",         # 디렉토리 목록 표시 안함
    "/NP",          # 진행률 표시 안함
    "/MT:8"         # 멀티스레드 (8개)
) + $excludeParams

$robocopyCmd = "robocopy " + ($robocopyArgs -join " ")
Invoke-Expression $robocopyCmd | Out-Null

if ($LASTEXITCODE -le 7) {
    Write-Host "✅ 파일 복사 완료" -ForegroundColor Green
} else {
    Write-Host "⚠️  일부 파일 복사 실패 (Exit Code: $LASTEXITCODE)" -ForegroundColor Yellow
}

# 백업 크기 계산
Write-Host ""
Write-Host "📊 백업 크기 계산 중..." -ForegroundColor Cyan
$backupSize = (Get-ChildItem -Path $backupPath -Recurse -File | Measure-Object -Property Length -Sum).Sum
$backupSizeMB = [math]::Round($backupSize / 1MB, 2)
Write-Host "✅ 백업 크기: $backupSizeMB MB" -ForegroundColor Green

# 압축 (선택사항)
Write-Host ""
Write-Host "📦 압축 중... (시간이 걸릴 수 있습니다)" -ForegroundColor Yellow

try {
    Compress-Archive -Path $backupPath -DestinationPath "$backupPath.zip" -Force -CompressionLevel Optimal
    
    # 압축 파일 크기
    $zipSize = (Get-Item "$backupPath.zip").Length
    $zipSizeMB = [math]::Round($zipSize / 1MB, 2)
    $compressionRatio = [math]::Round((1 - ($zipSize / $backupSize)) * 100, 1)
    
    Write-Host "✅ 압축 완료" -ForegroundColor Green
    Write-Host "   압축 파일 크기: $zipSizeMB MB" -ForegroundColor White
    Write-Host "   압축률: $compressionRatio%" -ForegroundColor White
    
    # 원본 폴더 삭제 (압축본만 유지)
    Write-Host ""
    Write-Host "🗑️  원본 폴더 삭제 중..." -ForegroundColor Yellow
    Remove-Item -Path $backupPath -Recurse -Force
    Write-Host "✅ 정리 완료" -ForegroundColor Green
    
} catch {
    Write-Host "❌ 압축 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "⚠️  압축되지 않은 백업 폴더가 유지됩니다." -ForegroundColor Yellow
}

# 백업 로그 기록
$logFile = Join-Path $GDrivePath "backup-log.txt"
$logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - 백업: $backupName (크기: $backupSizeMB MB)"
Add-Content -Path $logFile -Value $logEntry

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🎉 백업 완료!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
Write-Host "📁 백업 파일: $backupPath.zip" -ForegroundColor Cyan
Write-Host "📊 파일 크기: $zipSizeMB MB" -ForegroundColor Cyan
Write-Host "📝 로그 파일: $logFile" -ForegroundColor Cyan
Write-Host ""
