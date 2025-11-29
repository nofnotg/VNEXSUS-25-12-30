# 빠른 백업 스크립트 (로컬 Git만)
# 사용법: .\quick-backup.ps1 "작업 내용 설명"

param(
    [Parameter(Mandatory=$false)]
    [string]$Message = "빠른 백업"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$tagName = "quick-backup-$timestamp"

Write-Host "⚡ 빠른 백업 시작..." -ForegroundColor Cyan

# Git 커밋
git add .
git commit -m "빠른 백업: $Message ($timestamp)"
git tag -a $tagName -m "빠른 백업: $Message"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 백업 완료: $tagName" -ForegroundColor Green
    Write-Host "🔙 롤백: git checkout $tagName" -ForegroundColor Yellow
} else {
    Write-Host "❌ 백업 실패" -ForegroundColor Red
}
