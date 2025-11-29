# 🔄 VNEXSUS 백업 및 롤백 전략 가이드

**작성일**: 2025-11-29  
**버전**: 1.0  
**현재 상태**: Git 연동 완료, GitHub 원격 저장소 연결됨

---

## 📊 현재 백업 상태

### ✅ **Git 버전 관리 활성화**
- **로컬 저장소**: 초기화 완료
- **원격 저장소**: `https://github.com/charmorzr-pro/VNEXSUS_Bin.git`
- **현재 브랜치**: `main`
- **최근 커밋**: `c8ea8d2` (2025-11-17)
- **태그**: 
  - `checkpoint-20251117-2241` (최신)
  - `v-stable-before-enhancement`
  - `backup-before-core-integration`

### 📝 **변경된 파일 현황**
현재 **411개 파일**이 수정되었으나 커밋되지 않은 상태입니다.

---

## 🎯 백업 전략 (3단계)

### **1단계: Git 로컬 백업** ⚡ (즉시 실행 가능)

#### 📌 **현재 시점 백업 생성**

```powershell
# 1. 현재 작업 내용 스테이징
git add .

# 2. 백업 포인트 커밋 생성
git commit -m "백업: 2025-11-29 개발 상태 스냅샷"

# 3. 태그 생성 (쉬운 롤백을 위해)
git tag -a backup-20251129-1451 -m "백업 포인트: 2025-11-29 14:51"

# 4. 태그 목록 확인
git tag -l
```

#### 🔙 **롤백 방법**

```powershell
# 특정 태그로 롤백
git checkout backup-20251129-1451

# 또는 특정 커밋으로 롤백
git checkout c8ea8d2

# 롤백 후 새 브랜치 생성 (안전)
git checkout -b rollback-branch backup-20251129-1451
```

---

### **2단계: GitHub 원격 백업** ☁️ (클라우드 백업)

#### 📤 **GitHub에 푸시**

```powershell
# 1. 현재 브랜치를 GitHub에 푸시
git push origin main

# 2. 태그도 함께 푸시
git push origin --tags

# 3. 모든 브랜치 푸시
git push origin --all
```

#### 🔐 **GitHub 인증 설정** (필요시)

```powershell
# Personal Access Token 사용
git remote set-url origin https://YOUR_TOKEN@github.com/charmorzr-pro/VNEXSUS_Bin.git

# 또는 SSH 키 사용
git remote set-url origin git@github.com:charmorzr-pro/VNEXSUS_Bin.git
```

#### 📥 **GitHub에서 복원**

```powershell
# 1. 새 위치에 클론
git clone https://github.com/charmorzr-pro/VNEXSUS_Bin.git

# 2. 특정 태그 체크아웃
cd VNEXSUS_Bin
git checkout backup-20251129-1451
```

---

### **3단계: Google Drive 백업** 💾 (물리적 백업)

#### 📁 **자동 백업 스크립트**

아래 PowerShell 스크립트를 생성하여 사용하세요:

**파일명**: `backup-to-gdrive.ps1`

```powershell
# Google Drive 백업 스크립트
param(
    [string]$SourcePath = "C:\VNEXSUS_11-23",
    [string]$GDrivePath = "C:\Users\Chung\OneDrive\VNEXSUS_Backups"
)

# 백업 디렉토리 생성
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$backupName = "VNEXSUS_Backup_$timestamp"
$backupPath = Join-Path $GDrivePath $backupName

Write-Host "🔄 백업 시작: $backupName" -ForegroundColor Cyan

# 제외할 폴더 목록
$excludeDirs = @(
    "node_modules",
    ".git",
    "dist",
    "build",
    "logs",
    "temp",
    "uploads",
    "outputs"
)

# robocopy를 사용한 백업 (빠르고 안정적)
$excludeParams = $excludeDirs | ForEach-Object { "/XD `"$_`"" }
$robocopyCmd = "robocopy `"$SourcePath`" `"$backupPath`" /E /Z /R:3 /W:5 $excludeParams"

Invoke-Expression $robocopyCmd

# 압축 (선택사항)
Write-Host "📦 압축 중..." -ForegroundColor Yellow
Compress-Archive -Path $backupPath -DestinationPath "$backupPath.zip" -Force

# 원본 폴더 삭제 (압축본만 유지)
Remove-Item -Path $backupPath -Recurse -Force

Write-Host "✅ 백업 완료: $backupPath.zip" -ForegroundColor Green
Write-Host "📊 백업 크기: $((Get-Item "$backupPath.zip").Length / 1MB) MB" -ForegroundColor Cyan
```

#### 🚀 **백업 실행**

```powershell
# 스크립트 실행
.\backup-to-gdrive.ps1

# 또는 커스텀 경로 지정
.\backup-to-gdrive.ps1 -GDrivePath "D:\GoogleDrive\Backups"
```

#### 📥 **Google Drive에서 복원**

```powershell
# 1. 백업 파일 압축 해제
Expand-Archive -Path "VNEXSUS_Backup_20251129-1451.zip" -DestinationPath "C:\VNEXSUS_Restored"

# 2. 의존성 재설치
cd C:\VNEXSUS_Restored
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일 수정 필요
```

---

## 🔧 통합 백업 스크립트 (권장)

**파일명**: `create-backup-point.ps1`

```powershell
# 통합 백업 스크립트
param(
    [string]$BackupMessage = "자동 백업 포인트",
    [switch]$PushToGitHub,
    [switch]$BackupToGDrive
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$tagName = "backup-$timestamp"

Write-Host "🎯 백업 포인트 생성 시작" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# 1. Git 로컬 백업
Write-Host "`n📦 1단계: Git 로컬 백업" -ForegroundColor Yellow
git add .
git commit -m "백업: $BackupMessage ($timestamp)"
git tag -a $tagName -m "백업 포인트: $BackupMessage"
Write-Host "✅ 로컬 커밋 및 태그 생성 완료: $tagName" -ForegroundColor Green

# 2. GitHub 푸시 (옵션)
if ($PushToGitHub) {
    Write-Host "`n☁️  2단계: GitHub 원격 백업" -ForegroundColor Yellow
    git push origin main
    git push origin --tags
    Write-Host "✅ GitHub 푸시 완료" -ForegroundColor Green
}

# 3. Google Drive 백업 (옵션)
if ($BackupToGDrive) {
    Write-Host "`n💾 3단계: Google Drive 백업" -ForegroundColor Yellow
    .\backup-to-gdrive.ps1
}

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🎉 백업 완료!" -ForegroundColor Green
Write-Host "📌 태그: $tagName" -ForegroundColor Cyan
Write-Host "🔙 롤백 명령: git checkout $tagName" -ForegroundColor Cyan
```

#### 🎯 **사용 예시**

```powershell
# 로컬 백업만
.\create-backup-point.ps1 -BackupMessage "ICD 코드 형식 개선 완료"

# GitHub 포함
.\create-backup-point.ps1 -BackupMessage "성능 최적화 완료" -PushToGitHub

# 전체 백업 (Git + GitHub + Google Drive)
.\create-backup-point.ps1 -BackupMessage "Phase 3 완료" -PushToGitHub -BackupToGDrive
```

---

## 📋 백업 체크리스트

### ✅ **백업 전 확인사항**

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] `node_modules` 폴더가 제외되는지 확인
- [ ] 민감한 API 키가 코드에 하드코딩되지 않았는지 확인
- [ ] 대용량 파일 (로그, 임시 파일)이 제외되는지 확인

### ✅ **백업 후 확인사항**

- [ ] Git 태그가 생성되었는지 확인: `git tag -l`
- [ ] GitHub에 푸시되었는지 확인: GitHub 웹사이트 확인
- [ ] Google Drive 백업 파일 크기 확인
- [ ] 백업 로그 기록

---

## 🔙 롤백 시나리오

### **시나리오 1: 최근 변경사항 취소**

```powershell
# 마지막 커밋 취소 (변경사항 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (변경사항 삭제)
git reset --hard HEAD~1
```

### **시나리오 2: 특정 백업 포인트로 복원**

```powershell
# 1. 백업 태그 확인
git tag -l

# 2. 백업 포인트로 이동
git checkout backup-20251129-1451

# 3. 새 브랜치 생성 (안전)
git checkout -b restore-from-backup

# 4. main 브랜치에 적용 (확인 후)
git checkout main
git merge restore-from-backup
```

### **시나리오 3: 완전 복원 (Google Drive)**

```powershell
# 1. 현재 프로젝트 백업 (안전)
Rename-Item -Path "C:\VNEXSUS_11-23" -NewName "VNEXSUS_11-23_OLD"

# 2. Google Drive 백업 압축 해제
Expand-Archive -Path "VNEXSUS_Backup_20251129-1451.zip" -DestinationPath "C:\VNEXSUS_11-23"

# 3. 의존성 재설치
cd C:\VNEXSUS_11-23
npm install

# 4. 환경 변수 복원
# .env 파일 수동 설정 필요
```

---

## 📅 권장 백업 주기

| 백업 유형 | 주기 | 방법 |
|-----------|------|------|
| **Git 로컬** | 매일 작업 종료 시 | `git commit` + `git tag` |
| **GitHub** | 주 2-3회 | `git push` |
| **Google Drive** | 주 1회 (금요일) | 압축 백업 스크립트 |
| **중요 마일스톤** | 즉시 | 3단계 전체 백업 |

---

## 🚨 긴급 복구 절차

### **프로젝트가 손상된 경우**

```powershell
# 1. GitHub에서 새로 클론
cd C:\
git clone https://github.com/charmorzr-pro/VNEXSUS_Bin.git VNEXSUS_RECOVERED

# 2. 최신 백업 태그로 체크아웃
cd VNEXSUS_RECOVERED
git checkout backup-20251129-1451

# 3. 의존성 설치
npm install

# 4. 환경 변수 복원
# Google Drive에서 .env 파일 복사
```

---

## 💡 추가 권장사항

### **1. .gitignore 최적화**

현재 `.gitignore`에 다음 항목 추가 권장:

```gitignore
# 환경 변수 (보안)
.env
.env.*
!.env.example

# 대용량 파일
*.zip
*.tar.gz
uploads/
outputs/
temp/

# 로그
logs/
*.log

# 캐시
.cache/
*.cache

# OS
.DS_Store
Thumbs.db
```

### **2. GitHub Actions 자동 백업** (선택사항)

`.github/workflows/backup.yml` 생성:

```yaml
name: 자동 백업
on:
  schedule:
    - cron: '0 0 * * 5'  # 매주 금요일 자정
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: 백업 태그 생성
        run: |
          git tag backup-$(date +%Y%m%d)
          git push origin --tags
```

### **3. 백업 로그 관리**

`backup-log.txt` 파일에 백업 이력 기록:

```powershell
# 백업 로그 추가
$logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - 백업: $tagName"
Add-Content -Path "backup-log.txt" -Value $logEntry
```

---

## 📞 문제 해결

### **Q: Git 푸시가 거부되는 경우**

```powershell
# 강제 푸시 (주의!)
git push origin main --force

# 또는 풀 후 푸시
git pull origin main --rebase
git push origin main
```

### **Q: 대용량 파일 문제**

```powershell
# Git LFS 설치
git lfs install

# 대용량 파일 추적
git lfs track "*.zip"
git lfs track "*.pdf"
```

### **Q: 백업 파일이 너무 큰 경우**

```powershell
# 선택적 백업 (소스 코드만)
robocopy "C:\VNEXSUS_11-23" "D:\Backup" /E /XD node_modules .git dist build
```

---

## 🎉 결론

VNEXSUS 프로젝트는 **3단계 백업 전략**으로 안전하게 보호됩니다:

1. ✅ **Git 로컬**: 즉시 롤백 가능
2. ✅ **GitHub**: 클라우드 백업 및 협업
3. ✅ **Google Drive**: 물리적 백업 및 장기 보관

**권장 사항**: 매일 작업 종료 시 로컬 커밋, 주 2-3회 GitHub 푸시, 주 1회 Google Drive 백업을 실행하세요.

---

**작성자**: VNEXSUS 개발팀  
**최종 업데이트**: 2025-11-29  
**다음 검토일**: 2025-12-06
