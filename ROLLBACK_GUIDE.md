# VNEXSUS 롤백 가이드

## 🛡️ 안전한 롤백 포인트 설정 완료

### 생성된 롤백 포인트
- **브랜치**: `backup-before-core-integration`
- **태그**: `v-stable-before-enhancement`
- **커밋 해시**: `a7680bf`
- **생성일시**: 2025-10-18

### 현재 상태 (롤백 포인트)
✅ **완전히 작동하는 기능들**:
- 서버 정상 작동 (포트 3030)
- OCR 파이프라인 (Google Vision API)
- 후처리 로직 (날짜 엔진, 엔티티 추출)
- 프론트엔드 인터페이스
- 모든 기존 라우트/컨트롤러

✅ **추가된 코어 엔진** (아직 통합되지 않음):
- `src/services/core/disclosureEngine.js`
- `src/services/core/diseaseRuleMapper.js`
- `src/services/core/primaryMetastasisClassifier.js`
- `src/services/core/promptOrchestrator.js`
- `src/services/core/structuredOutput.js`

✅ **개발 계획 문서**:
- `tasks/app_advancement_development_plan.md`
- `tasks/core_engine_formation_plan.md`

## 🔄 롤백 방법

### 방법 1: 태그로 롤백 (권장)
```bash
# 현재 작업 저장 (필요시)
git stash

# 안전한 상태로 롤백
git checkout v-stable-before-enhancement

# 새 브랜치로 작업 재시작 (선택)
git checkout -b new-integration-attempt
```

### 방법 2: 브랜치로 롤백
```bash
# 백업 브랜치로 이동
git checkout backup-before-core-integration

# 현재 브랜치에서 작업 계속
```

### 방법 3: 커밋 해시로 롤백
```bash
# 특정 커밋으로 롤백
git checkout a7680bf

# 새 브랜치 생성하여 작업
git checkout -b recovery-branch
```

## ⚠️ 롤백 시 주의사항

### 롤백 전 확인사항
1. 현재 작업 중인 변경사항 저장 여부
2. 데이터베이스 백업 상태 (해당시)
3. 환경변수 파일 (.env) 백업

### 롤백 후 확인사항
1. 서버 정상 시작 확인
   ```bash
   cd backend
   npm start
   ```
2. 프론트엔드 접속 확인: http://localhost:3030
3. 파일 업로드 → OCR → 보고서 생성 전체 흐름 테스트

## 🚨 긴급 복구 절차

문제 발생 시 즉시 실행할 명령어:

```bash
# 1. 모든 변경사항 되돌리기
git reset --hard v-stable-before-enhancement

# 2. 서버 재시작
cd backend
npm start

# 3. 브라우저에서 확인
# http://localhost:3030
```

## 📋 통합 재시도 체크리스트

롤백 후 다시 통합을 시도할 때:

### Phase 1: 준비
- [ ] 현재 상태가 안정적인지 확인
- [ ] 새로운 백업 브랜치 생성
- [ ] 단위 테스트 작성 및 실행

### Phase 2: 점진적 통합
- [ ] 환경변수로 기능 토글 설정
- [ ] 한 번에 하나의 코어 엔진만 통합
- [ ] 각 단계마다 기능 테스트

### Phase 3: 검증
- [ ] 기존 기능 100% 유지 확인
- [ ] 새 기능 정상 동작 확인
- [ ] 성능 저하 없음 확인

## 📞 문제 해결

### 일반적인 문제들

**Q: 롤백 후 서버가 시작되지 않음**
A: 
1. `.env` 파일 확인
2. `npm install` 재실행
3. 포트 3030 사용 중인지 확인

**Q: 롤백 후 일부 파일이 없음**
A:
1. `git status`로 누락 파일 확인
2. `git checkout v-stable-before-enhancement -- <파일명>`으로 복구

**Q: 데이터베이스 관련 오류**
A:
1. 데이터베이스 백업에서 복구
2. 마이그레이션 재실행

## 📝 롤백 로그

### 2025-10-18 롤백 포인트 생성
- 커밋: a7680bf "STABLE: Core engines and development plans before integration"
- 태그: v-stable-before-enhancement
- 브랜치: backup-before-core-integration
- 상태: 서버 정상, 모든 기능 작동

---

**중요**: 이 가이드를 통합 작업 전에 팀 전체가 숙지하고, 문제 발생 시 즉시 참조하세요.