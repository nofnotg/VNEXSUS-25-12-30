# VNEXSUS 레포지토리 연동 분석 및 정리 제안서

**작성일**: 2026-01-17
**분석 대상**: VNEXSUS-25-12-30 (운영 레포) ↔ VNEXSUS_reports_pdf (데이터 레포)

---

## 📋 Executive Summary

### 현재 상태
- ✅ **연동 메커니즘 발견**: 환경 변수 `REPORTS_PDF_ROOT` 사용
- ❌ **연동 설정 미완성**: `.env` 파일에 경로 설정 누락
- ❌ **Windows 경로 하드코딩**: `C:\VNEXSUS_reports_pdf` (Linux 환경에서 작동 불가)
- ⚠️ **HTML 문서 분산**: 운영 레포에 24개 HTML 파일 (925KB)

### 권장사항
1. **환경 변수 설정 완료** (즉시 실행 가능)
2. **HTML 문서 데이터 레포 이동** (레포 정리)
3. **서브모듈 또는 심볼릭 링크 설정** (장기적 관리)

---

## 🔍 연동 메커니즘 상세 분석

### 1. 코드 레벨 연동 구조

#### `backend/utils/fileHandler.js:14-20`

```javascript
const REPORTS_PDF_ROOT = (() => {
  const raw = process.env.REPORTS_PDF_ROOT;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
  }
  return 'C:\\VNEXSUS_reports_pdf';  // ❌ Windows 경로 하드코딩
})();
```

**분석:**
- 환경 변수 `REPORTS_PDF_ROOT`를 우선적으로 사용
- 환경 변수 없을 시 Windows 경로로 fallback
- **문제**: Linux 환경에서 작동 불가

#### 보호 디렉토리 설정

```javascript
const protectedDirs = [
  path.join(REPORTS_PDF_ROOT, 'sample_pdf'),
  path.join(REPORTS_PDF_ROOT, 'prepared_coordinate_cases')
].map(d => path.resolve(d));
```

**의미:**
- 데이터 레포의 특정 디렉토리를 삭제 방지로 보호
- 연동이 전제되어 있음을 명확히 보여줌

---

### 2. 데이터 레포 참조 파일 목록

총 **21개 파일**에서 `VNEXSUS_reports_pdf` 또는 `reports_pdf` 참조:

#### 백엔드 도구 (Tools)
- `backend/tools/batchReprocessCases.js`
- `backend/tools/buildOfflineOcrArtifacts.js`
- `backend/tools/generateOfflineArtifacts.js`
- `backend/tools/offlineCoordAnalyzer.js`
- `backend/tools/prepareCoordinateCases.js`
- `backend/tools/validateOfflineCases.js`

#### 백엔드 유틸리티
- `backend/utils/fileHandler.js` ⭐ (핵심 연동 로직)
- `backend/utils/fileHelper.js`
- `backend/validation/batchValidator.js`

#### 스크립트
- `scripts/batch-run-ten-report.ts`
- `scripts/param-sweep.ts`
- `scripts/realtime-ocr-llm-and-compare.ts`

#### 기타
- `src/rag/testRunner.js`
- `package.json`
- `.trae/documents/오프라인 OCR 자료 기반 검증·파이프라인 실행 v1.3 계획.md`
- `docs/analysis-archive/2026-01-03_VNEXSUS_Implementation_Analysis_Report.html`
- 검증 결과 파일 5개 (`validation-results/*.json`)

---

### 3. 환경 변수 파일 현황

#### `.env.example`
- ❌ `REPORTS_PDF_ROOT` 설정 **없음**
- ✅ 다른 환경 변수들은 정상적으로 문서화됨

#### `.env.secure`
- ❌ `REPORTS_PDF_ROOT` 설정 **없음**
- ✅ GCP, OpenAI 등 다른 설정은 존재

#### 실제 `.env` 파일
- 확인 불가 (gitignore로 제외됨)
- **추정**: 설정되지 않았을 가능성 높음

---

## 📂 HTML 문서 현황 분석

### 운영 레포 `reports/` 디렉토리

**총 파일 수**: 24개 HTML + 6개 기타 파일 (TXT, JSON, MD)
**총 용량**: 925KB

### HTML 문서 분류

#### 📊 대형 보고서 (20KB 이상)

| 파일명 | 크기 | 설명 |
|-------|------|------|
| `app_development_status_report.html` | 218KB | **가장 큰 파일** - 앱 개발 상태 보고서 |
| `outpatient-episodes-case-comparison.html` | 63KB | 외래 에피소드 케이스 비교 |
| `pipeline_verification_report.html` | 38KB | 파이프라인 검증 보고서 |
| `VNEXSUS_종합감사보고서_2025-12-06.html` | 32KB | 종합 감사 보고서 |
| `pipeline_comparison_analysis.html` | 29KB | 파이프라인 비교 분석 |
| `vnexsus_data_flow_visualization.html` | 28KB | 데이터 플로우 시각화 |
| `보고서생성_완성도_심층분석_2025-12-06.html` | 26KB | 보고서 생성 완성도 분석 |
| `scenario4-vs-original-comparison.html` | 26KB | 시나리오4 vs 원본 비교 |
| `offline_coord_analysis.html` | 25KB | 오프라인 좌표 분석 |
| `comprehensive-ai-analysis-report.html` | 25KB | 종합 AI 분석 보고서 |
| `ai-combination-analysis-report.html` | 25KB | AI 조합 분석 보고서 |
| `quality-comparison-report.html` | 23KB | 품질 비교 보고서 |
| `vnexsus_system_architecture.html` | 20KB | 시스템 아키텍처 문서 |

#### 📄 중형 보고서 (10-20KB)

| 파일명 | 크기 |
|-------|------|
| `ai-disable-analysis.html` | 18KB |
| `accuracy_improvement_strategy.html` | 15KB |
| `프롬프트_통합_심층분석_리포트.html` | 13KB |
| `core_engine_spec.html` | 11KB |

#### 📝 소형 보고서 (10KB 미만)

| 파일명 | 크기 |
|-------|------|
| `Comprehensive_Case_Progress_Report.html` | 8.5KB |
| `파이프라인_심층피드백_리포트.html` | 8.3KB |
| `enhanced_report_case5_coords.html` | 4.1KB |
| `enhanced_report_preview.html` | 3.4KB |
| `enhanced_report_case5_test.html` | 3.2KB |
| `index.html` | 1.5KB |
| `app-status.html` | 0 bytes (빈 파일) |

#### 🗂️ 기타 파일

| 파일명 | 크기 | 타입 |
|-------|------|------|
| `production-deployment-recommendations.md` | 9.3KB | Markdown |
| `scenario4-performance-analysis.md` | 6.3KB | Markdown |
| `outpatient-episodes-summary.json` | 2.8KB | JSON |
| `report_1764422763416_홍길동.txt` | 2.0KB | TXT |
| `report_1764423420964_홍길동.txt` | 2.0KB | TXT |

---

## ⚠️ 문제점 분석

### 1. 연동 설정 미완성

**현상:**
- 코드에는 `REPORTS_PDF_ROOT` 환경 변수 사용 로직 존재
- 하지만 `.env` 파일에 해당 변수 설정 없음
- Windows 경로로 하드코딩된 fallback 사용 중

**영향:**
- Linux 환경에서 데이터 레포 참조 불가
- 개발 환경과 배포 환경 간 불일치
- 파일 경로 오류 발생 가능성

### 2. 운영 레포 비대화

**현상:**
- 운영 레포에 24개 HTML 보고서 (925KB)
- 데이터 성격의 파일들이 코드 레포에 혼재

**영향:**
- 레포지토리 크기 증가
- 코드와 데이터의 분리 개념 흐림
- Git 이력 관리 복잡도 증가

### 3. 서브모듈 설정 오류

**현상:**
```
fatal: no submodule mapping found in .gitmodules for path 'VNEXSUS_bin'
```

**분석:**
- 과거에 서브모듈 사용 시도가 있었음
- 하지만 `.gitmodules` 설정이 불완전
- VNEXSUS_bin 경로 참조가 남아있음

---

## 💡 해결 방안 및 제안

### 방안 1: 환경 변수 설정 완료 (즉시 실행 가능) ⭐ 추천

#### 1-1. `.env.example` 파일 업데이트

**추가할 내용:**
```bash
# ================================================================
# 📂 데이터 레포지토리 연동 설정
# ================================================================
# Linux/Mac 환경
REPORTS_PDF_ROOT=/home/user/VNEXSUS_reports_pdf

# Windows 환경
# REPORTS_PDF_ROOT=C:/VNEXSUS_reports_pdf

# 상대 경로 (운영 레포 상위 디렉토리에 데이터 레포가 있는 경우)
# REPORTS_PDF_ROOT=../VNEXSUS_reports_pdf
```

#### 1-2. `.env` 파일 생성 또는 업데이트

실제 사용 환경에 맞게 설정:
```bash
REPORTS_PDF_ROOT=/home/user/VNEXSUS_reports_pdf
```

#### 1-3. 검증

```bash
# Node.js 환경에서 테스트
node -e "console.log(require('path').resolve(process.env.REPORTS_PDF_ROOT || 'C:\\\\VNEXSUS_reports_pdf'))"
```

**장점:**
- ✅ 즉시 적용 가능
- ✅ 코드 수정 불필요
- ✅ 환경별 유연한 설정

**단점:**
- ⚠️ 환경 변수 누락 시 여전히 Windows 경로로 fallback

---

### 방안 2: HTML 문서 데이터 레포 이동 (레포 정리)

#### 2-1. 이동 대상 파일 분류

**A. 데이터 레포로 이동 (22개)**

분석/검증 보고서 (과거 데이터):
- `VNEXSUS_종합감사보고서_2025-12-06.html`
- `보고서생성_완성도_심층분석_2025-12-06.html`
- `app_development_status_report.html` (218KB)
- `pipeline_verification_report.html`
- `pipeline_comparison_analysis.html`
- `quality-comparison-report.html`
- `comprehensive-ai-analysis-report.html`
- `ai-combination-analysis-report.html`
- `ai-disable-analysis.html`
- `offline_coord_analysis.html`
- `outpatient-episodes-case-comparison.html`
- `scenario4-vs-original-comparison.html`
- `accuracy_improvement_strategy.html`
- `파이프라인_심층피드백_리포트.html`
- `프롬프트_통합_심층분석_리포트.html`
- `Comprehensive_Case_Progress_Report.html`
- `enhanced_report_case5_coords.html`
- `enhanced_report_case5_test.html`
- `enhanced_report_preview.html`
- `report_1764422763416_홍길동.txt`
- `report_1764423420964_홍길동.txt`
- `outpatient-episodes-summary.json`

**B. 운영 레포에 유지 (5개)**

운영/배포 문서 (현재 사용 중):
- `index.html` (메인 인덱스)
- `vnexsus_system_architecture.html` (시스템 문서)
- `vnexsus_data_flow_visualization.html` (시스템 문서)
- `core_engine_spec.html` (코어 엔진 스펙)
- `production-deployment-recommendations.md` (배포 가이드)
- `scenario4-performance-analysis.md` (성능 분석)
- `app-status.html` (앱 상태)

#### 2-2. 이동 계획

**Step 1: 데이터 레포에 디렉토리 생성**

```bash
cd /home/user/VNEXSUS_reports_pdf
mkdir -p historical_reports/analysis
mkdir -p historical_reports/verification
mkdir -p historical_reports/case_reports
```

**Step 2: 파일 이동 스크립트**

```bash
#!/bin/bash
SRC="/home/user/VNEXSUS-25-12-30/reports"
DST="/home/user/VNEXSUS_reports_pdf/historical_reports"

# 분석 보고서 이동
mv "$SRC/VNEXSUS_종합감사보고서_2025-12-06.html" "$DST/analysis/"
mv "$SRC/보고서생성_완성도_심층분석_2025-12-06.html" "$DST/analysis/"
mv "$SRC/app_development_status_report.html" "$DST/analysis/"
mv "$SRC/comprehensive-ai-analysis-report.html" "$DST/analysis/"
mv "$SRC/ai-combination-analysis-report.html" "$DST/analysis/"
mv "$SRC/ai-disable-analysis.html" "$DST/analysis/"
mv "$SRC/파이프라인_심층피드백_리포트.html" "$DST/analysis/"
mv "$SRC/프롬프트_통합_심층분석_리포트.html" "$DST/analysis/"

# 검증 보고서 이동
mv "$SRC/pipeline_verification_report.html" "$DST/verification/"
mv "$SRC/pipeline_comparison_analysis.html" "$DST/verification/"
mv "$SRC/quality-comparison-report.html" "$DST/verification/"
mv "$SRC/offline_coord_analysis.html" "$DST/verification/"
mv "$SRC/outpatient-episodes-case-comparison.html" "$DST/verification/"
mv "$SRC/scenario4-vs-original-comparison.html" "$DST/verification/"
mv "$SRC/accuracy_improvement_strategy.html" "$DST/verification/"
mv "$SRC/outpatient-episodes-summary.json" "$DST/verification/"

# 케이스 보고서 이동
mv "$SRC/enhanced_report_case5_coords.html" "$DST/case_reports/"
mv "$SRC/enhanced_report_case5_test.html" "$DST/case_reports/"
mv "$SRC/enhanced_report_preview.html" "$DST/case_reports/"
mv "$SRC/Comprehensive_Case_Progress_Report.html" "$DST/case_reports/"
mv "$SRC/report_1764422763416_홍길동.txt" "$DST/case_reports/"
mv "$SRC/report_1764423420964_홍길동.txt" "$DST/case_reports/"
```

**Step 3: README 작성**

데이터 레포에 `historical_reports/README.md` 작성:
```markdown
# Historical Reports Archive

이 디렉토리는 VNEXSUS-25-12-30 운영 레포에서 이동된 과거 분석/검증 보고서를 보관합니다.

## 구조

- `analysis/` - 종합 분석 보고서 (AI, 파이프라인, 시스템 등)
- `verification/` - 검증 및 비교 보고서
- `case_reports/` - 개별 케이스 보고서

## 이동 이력

- 이동일: 2026-01-17
- 원본 위치: VNEXSUS-25-12-30/reports/
- 이동 사유: 운영 레포와 데이터 레포 분리 정책
```

**장점:**
- ✅ 운영 레포 크기 감소 (925KB → 약 100KB)
- ✅ 코드와 데이터의 명확한 분리
- ✅ 이력 보존 (과거 보고서 접근 가능)

**단점:**
- ⚠️ 기존 링크 또는 참조가 깨질 수 있음 (검증 필요)

---

### 방안 3: 서브모듈 또는 심볼릭 링크 설정 (장기적 관리)

#### 옵션 A: Git 서브모듈

**설정:**
```bash
cd /home/user/VNEXSUS-25-12-30
git submodule add https://github.com/nofnotg/VNEXSUS_reports_pdf.git data
```

**장점:**
- ✅ Git 네이티브 기능
- ✅ 버전 관리 가능
- ✅ 팀 협업에 유리

**단점:**
- ⚠️ 서브모듈 관리 복잡도
- ⚠️ clone 시 `--recursive` 옵션 필요

#### 옵션 B: 심볼릭 링크

**설정:**
```bash
cd /home/user/VNEXSUS-25-12-30
ln -s /home/user/VNEXSUS_reports_pdf data
```

**장점:**
- ✅ 간단한 설정
- ✅ 로컬 환경에서 즉시 사용 가능

**단점:**
- ❌ Git으로 관리되지 않음
- ❌ 절대 경로 의존성
- ❌ Windows 환경 호환성 문제

#### 권장: **옵션 A (서브모듈)** 사용

---

## 🎯 최종 권장 실행 계획

### Phase 1: 즉시 실행 (환경 변수 설정)

**목표**: 연동 메커니즘 작동 시작

1. `.env.example` 업데이트 (REPORTS_PDF_ROOT 추가)
2. `.env` 파일 생성 또는 업데이트
3. 테스트 실행으로 연동 확인

**예상 소요 시간**: 10분
**위험도**: 낮음

---

### Phase 2: 레포 정리 (HTML 문서 이동)

**목표**: 운영 레포와 데이터 레포 명확히 분리

1. 데이터 레포에 `historical_reports/` 디렉토리 구조 생성
2. 22개 과거 보고서 이동
3. README.md 작성
4. 데이터 레포에 커밋 및 푸시
5. 운영 레포에서 삭제 후 커밋 및 푸시

**예상 소요 시간**: 30분
**위험도**: 중간 (참조 깨짐 가능성)

---

### Phase 3: 장기적 관리 (서브모듈 설정) - 선택사항

**목표**: Git 레벨에서 연동 관리

1. 서브모듈 추가 (`git submodule add`)
2. `.gitmodules` 파일 생성 확인
3. 코드에서 서브모듈 경로 참조 업데이트
4. 팀원들에게 `git submodule update --init --recursive` 안내

**예상 소요 시간**: 1시간
**위험도**: 중간 (서브모듈 학습 필요)

---

## 📊 비용-편익 분석

| 방안 | 구현 난이도 | 효과 | 유지보수 | 추천도 |
|-----|----------|------|---------|-------|
| Phase 1 (환경 변수) | ⭐ 쉬움 | ⭐⭐⭐ 높음 | ⭐⭐⭐ 쉬움 | ⭐⭐⭐⭐⭐ |
| Phase 2 (HTML 이동) | ⭐⭐ 보통 | ⭐⭐⭐⭐ 매우 높음 | ⭐⭐⭐ 쉬움 | ⭐⭐⭐⭐ |
| Phase 3 (서브모듈) | ⭐⭐⭐ 어려움 | ⭐⭐⭐ 높음 | ⭐⭐ 보통 | ⭐⭐⭐ |

---

## ✅ 체크리스트

### 환경 변수 설정 완료 후 확인사항

- [ ] `.env.example`에 REPORTS_PDF_ROOT 추가됨
- [ ] `.env` 파일에 실제 경로 설정됨
- [ ] Node.js에서 환경 변수 읽기 테스트 성공
- [ ] `backend/utils/fileHandler.js`가 올바른 경로 사용 확인
- [ ] 보호 디렉토리 접근 테스트 성공

### HTML 문서 이동 완료 후 확인사항

- [ ] 데이터 레포에 `historical_reports/` 디렉토리 생성됨
- [ ] 22개 파일 이동 완료
- [ ] README.md 작성 완료
- [ ] 데이터 레포에 커밋 및 푸시 완료
- [ ] 운영 레포에서 삭제 후 커밋 및 푸시 완료
- [ ] 기존 참조/링크 확인 (깨진 링크 없음)

### 서브모듈 설정 완료 후 확인사항

- [ ] `.gitmodules` 파일 생성 확인
- [ ] `git submodule status` 정상 출력
- [ ] 코드에서 서브모듈 경로 참조 업데이트
- [ ] 신규 clone 시 서브모듈 정상 동작 확인
- [ ] 팀원들에게 안내 메시지 전달

---

## 📚 참고 자료

### 관련 파일 위치

- 연동 핵심 로직: `backend/utils/fileHandler.js:14-24`
- 환경 변수 예제: `.env.example`
- 데이터 레포: `/home/user/VNEXSUS_reports_pdf`
- 운영 레포: `/home/user/VNEXSUS-25-12-30`

### Git 명령어 참고

```bash
# 서브모듈 추가
git submodule add <repo-url> <path>

# 서브모듈 초기화
git submodule update --init --recursive

# 서브모듈 상태 확인
git submodule status

# 서브모듈 제거
git submodule deinit <path>
git rm <path>
```

---

**작성자**: Claude (Sonnet 4.5)
**다음 단계**: Phase 1 (환경 변수 설정) 즉시 실행 권장
