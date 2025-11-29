# 🔄 VNEXSUS 백업 및 롤백 빠른 가이드

## ✅ 백업 완료!

**현재 백업 포인트**: `backup-20251129-1502`  
**커밋 해시**: `25a90cb`  
**백업 시간**: 2025-11-29 15:02

---

## 🚀 빠른 사용법

### 1️⃣ 백업 생성 (가장 많이 사용)

```powershell
# 간단한 백업
.\simple-backup.ps1 "작업 내용 설명"

# 예시
.\simple-backup.ps1 "ICD 코드 형식 개선 완료"
.\simple-backup.ps1 "성능 최적화 작업 완료"
.\simple-backup.ps1 "버그 수정 - 파일 업로드 이슈"
```

### 2️⃣ 백업 목록 확인

```powershell
# 모든 백업 태그 보기
git tag -l

# 최근 10개 백업만 보기
git tag -l | Select-Object -Last 10

# 백업 상세 정보 보기
git show backup-20251129-1502
```

### 3️⃣ 롤백 (이전 상태로 복원)

```powershell
# 특정 백업 포인트로 롤백
git checkout backup-20251129-1502

# 최신 상태로 돌아가기
git checkout main

# 롤백 후 새 브랜치 생성 (안전)
git checkout -b restore-branch backup-20251129-1502
```

---

## 📋 백업 시나리오별 가이드

### 시나리오 1: 매일 작업 종료 시

```powershell
# 오늘 작업 내용 백업
.\simple-backup.ps1 "2025-11-29 일일 작업 완료"
```

### 시나리오 2: 중요 기능 완료 후

```powershell
# 로컬 백업
.\simple-backup.ps1 "새로운 보고서 생성 기능 완료"

# GitHub에도 푸시
git push origin main
git push origin --tags
```

### 시나리오 3: 실험적 변경 전

```powershell
# 안전 백업 생성
.\simple-backup.ps1 "실험 시작 전 안전 백업"

# 실험용 브랜치 생성
git checkout -b experiment

# 실험 실패 시 원래대로
git checkout main
```

### 시나리오 4: 주간 전체 백업

```powershell
# Google Drive 백업 실행
.\backup-to-gdrive.ps1

# 또는 OneDrive 경로 지정
.\backup-to-gdrive.ps1 -GDrivePath "D:\OneDrive\Backups"
```

---

## 🔙 롤백 시나리오

### 롤백 1: 최근 변경사항만 취소

```powershell
# 마지막 커밋 취소 (파일은 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (파일도 삭제)
git reset --hard HEAD~1
```

### 롤백 2: 특정 백업으로 완전 복원

```powershell
# 1. 백업 포인트 확인
git tag -l

# 2. 해당 백업으로 이동
git checkout backup-20251129-1502

# 3. 확인 후 main에 적용
git checkout main
git reset --hard backup-20251129-1502
```

### 롤백 3: 파일 일부만 복원

```powershell
# 특정 파일만 이전 버전으로
git checkout backup-20251129-1502 -- frontend/script.js

# 특정 폴더만 이전 버전으로
git checkout backup-20251129-1502 -- backend/routes/
```

---

## 📊 현재 백업 상태

### Git 저장소 정보

- **원격 저장소**: https://github.com/charmorzr-pro/VNEXSUS_Bin.git
- **현재 브랜치**: main
- **최신 백업**: backup-20251129-1502

### 백업 태그 목록

```
checkpoint-20251117-2241
v-stable-before-enhancement
backup-before-core-integration
backup-20251129-1502  ← 최신
```

---

## 🛡️ 백업 모범 사례

### ✅ 권장 사항

1. **매일 작업 종료 시**: 로컬 Git 백업
2. **주 2-3회**: GitHub 푸시
3. **주 1회 (금요일)**: Google Drive 전체 백업
4. **중요 마일스톤**: 3단계 전체 백업

### ⚠️ 주의 사항

1. `.env` 파일은 Git에 포함되지 않음 (별도 백업 필요)
2. `node_modules`는 백업 제외 (필요시 `npm install`로 복원)
3. 대용량 로그 파일은 정기적으로 정리
4. API 키는 절대 Git에 커밋하지 않기

---

## 🔧 문제 해결

### Q: "파일이 너무 많아 백업이 느려요"

```powershell
# 불필요한 파일 정리
Remove-Item -Path "logs\*" -Force
Remove-Item -Path "temp\*" -Recurse -Force
Remove-Item -Path "uploads\*" -Recurse -Force
```

### Q: "GitHub 푸시가 거부됩니다"

```powershell
# 원격 변경사항 가져오기
git pull origin main --rebase

# 다시 푸시
git push origin main
```

### Q: "백업 태그를 삭제하고 싶어요"

```powershell
# 로컬 태그 삭제
git tag -d backup-20251129-1502

# 원격 태그 삭제
git push origin :refs/tags/backup-20251129-1502
```

---

## 📞 추가 도움말

### 상세 가이드

- **전체 가이드**: `BACKUP_STRATEGY.md` 참조
- **Git 기본**: https://git-scm.com/docs
- **GitHub 가이드**: https://docs.github.com

### 백업 스크립트

- `simple-backup.ps1` - 빠른 로컬 백업 (권장)
- `backup-to-gdrive.ps1` - Google Drive 백업
- `create-backup-point.ps1` - 통합 백업 (고급)

---

## 🎉 요약

### 일상적인 백업

```powershell
.\simple-backup.ps1 "작업 내용"
```

### 롤백

```powershell
git checkout backup-20251129-1502
```

### 백업 확인

```powershell
git tag -l
```

**그게 전부입니다!** 🚀

---

**작성일**: 2025-11-29  
**최종 업데이트**: 2025-11-29 15:02  
**현재 백업**: backup-20251129-1502
