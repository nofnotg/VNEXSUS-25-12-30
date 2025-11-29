# Simple Backup Point Creation Script
# Usage: .\simple-backup.ps1 "Your backup message"

param(
    [string]$Message = "Auto backup point"
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$tagName = "backup-$timestamp"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "VNEXSUS Backup Point Creation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Message: $Message" -ForegroundColor White
Write-Host "Tag: $tagName" -ForegroundColor White
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
Write-Host ""

# Check Git status
Write-Host "Checking Git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
$changedFiles = ($gitStatus | Measure-Object).Count

if ($changedFiles -eq 0) {
    Write-Host "No changes detected. Creating tag only." -ForegroundColor Cyan
    git tag -a $tagName -m "Backup: $Message"
}
else {
    Write-Host "Changed files: $changedFiles" -ForegroundColor Green
    Write-Host ""
    
    # Stage files
    Write-Host "Staging files..." -ForegroundColor Cyan
    git add .
    Write-Host "OK" -ForegroundColor Green
    
    # Commit
    Write-Host "Creating commit..." -ForegroundColor Cyan
    git commit -m "Backup: $Message ($timestamp)"
    Write-Host "OK" -ForegroundColor Green
    
    # Create tag
    Write-Host "Creating tag..." -ForegroundColor Cyan
    git tag -a $tagName -m "Backup: $Message"
    Write-Host "OK" -ForegroundColor Green
}

# Get commit hash
$commitHash = git rev-parse --short HEAD

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Backup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup Info:" -ForegroundColor Cyan
Write-Host "  Tag: $tagName" -ForegroundColor White
Write-Host "  Commit: $commitHash" -ForegroundColor White
Write-Host "  Message: $Message" -ForegroundColor White
Write-Host ""
Write-Host "Rollback command:" -ForegroundColor Cyan
Write-Host "  git checkout $tagName" -ForegroundColor Yellow
Write-Host ""
Write-Host "View all tags:" -ForegroundColor Cyan
Write-Host "  git tag -l" -ForegroundColor Yellow
Write-Host ""
