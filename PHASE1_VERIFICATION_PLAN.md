# Master Plan Phase 1 검증 계획

**작성일**: 2025-11-30  
**대상**: Phase 1 (Dispute Layer) 완료 후 검증  
**목표**: 기존 기능 영향 없음 확인 및 새 기능 정상 작동 검증

---

## 📋 검증 개요

### 검증 범위
1. **Feature Flag OFF 상태** - 기존 동작 100% 유지 확인
2. **Feature Flag ON 상태** - DisputeTag 정상 생성 확인
3. **성능 영향** - 메모리, CPU, 응답 시간 측정
4. **회귀 테스트** - 기존 테스트 100% 통과 확인

### 성공 기준
- ✅ Feature Flag OFF: 기존 동작과 완전 동일
- ✅ Feature Flag ON: DisputeTag 정상 생성
- ✅ 성능 저하 < 5%
- ✅ 기존 테스트 100% 통과
- ✅ 대표 케이스 3건 검증 완료

---

## 1. Feature Flag 테스트

### 1.1 Feature Flag OFF 테스트

**목적**: 기존 기능이 완전히 동일하게 작동하는지 확인

**테스트 절차**:
```bash
# 1. .env 파일 확인
ENABLE_DISPUTE_TAGGING=false

# 2. 서버 재시작
node run-server.js

# 3. 테스트 케이스 실행
# - 파일 업로드
# - OCR 처리
# - 후처리 파이프라인
# - 보고서 생성
```

**검증 항목**:
- [ ] OCR 파이프라인 정상 작동
- [ ] 후처리 결과 동일
- [ ] API 응답 스키마 동일
- [ ] timeline.events에 disputeTag 필드 없음 (또는 null)
- [ ] 로그에 DisputeTag 관련 메시지 없음

### 1.2 Feature Flag ON 테스트

**목적**: DisputeTag가 정상적으로 생성되는지 확인

**테스트 절차**:
```bash
# 1. .env 파일 수정
ENABLE_DISPUTE_TAGGING=true

# 2. 서버 재시작
node run-server.js

# 3. 테스트 케이스 실행 (contractInfo, claimSpec 포함)
```

**검증 항목**:
- [ ] DisputeTag 생성 로그 확인
- [ ] timeline.events[].disputeTag 존재 확인
- [ ] disputeTag 필드 구조 검증
  - [ ] phase (PRE_CONTRACT/WAITING_PERIOD/COVERED_PERIOD)
  - [ ] role (CLAIM_CORE/ETIOLOGY/RISK_FACTOR/BACKGROUND/IRRELEVANT)
  - [ ] dutyToDisclose (NONE/POTENTIAL/VIOLATION_CANDIDATE)
  - [ ] importanceScore (0.0 ~ 1.0)
  - [ ] reasons (배열)
- [ ] 기존 기능 정상 작동 (DisputeTag 추가에도 불구하고)

---

## 2. 회귀 테스트

### 2.1 단위 테스트

**실행**:
```bash
cd backend
npm test
```

**검증**:
- [ ] 모든 기존 테스트 100% 통과
- [ ] DisputeScoringUtil 테스트 27개 통과
- [ ] 새로운 테스트 실패 없음

### 2.2 통합 테스트

**테스트 시나리오**:
1. **파일 업로드 → OCR → 후처리 → 보고서**
   - [ ] 전체 파이프라인 정상 작동
   - [ ] 각 단계별 응답 시간 측정
   - [ ] 에러 없음 확인

2. **다양한 입력 케이스**
   - [ ] 단일 파일
   - [ ] 다중 파일
   - [ ] 대용량 파일
   - [ ] 특수 문자 포함 파일

---

## 3. 성능 측정

### 3.1 응답 시간 측정

**측정 항목**:
- OCR 처리 시간
- 후처리 시간
- DisputeTag 생성 시간 (Feature Flag ON 시)
- 전체 파이프라인 시간

**측정 방법**:
```javascript
// 로그에서 processingTimeMs 확인
// Feature Flag OFF vs ON 비교
```

**목표**:
- DisputeTag 생성으로 인한 추가 시간 < 100ms

### 3.2 메모리 사용량

**측정 방법**:
```bash
# 서버 실행 중 메모리 모니터링
# Windows Task Manager 또는
node --inspect run-server.js
```

**목표**:
- 메모리 증가 < 5%

### 3.3 CPU 사용률

**측정 방법**:
- Task Manager에서 CPU 사용률 확인
- Feature Flag OFF vs ON 비교

**목표**:
- CPU 사용률 증가 < 5%

---

## 4. 대표 케이스 검증

### 4.1 케이스 선정 기준

**케이스 1: 가입 전 치료력**
- 계약일: 2024-01-01
- 대기기간: 90일
- 청구 사건: 2024-06-01 (유방암)
- 가입 전 사건: 2023-12-01 (유방 종양 검사)

**예상 결과**:
- phase: PRE_CONTRACT
- role: ETIOLOGY 또는 CLAIM_CORE
- dutyToDisclose: POTENTIAL 또는 VIOLATION_CANDIDATE
- importanceScore: > 0.7

**케이스 2: 대기기간 내 사건**
- 계약일: 2024-01-01
- 대기기간: 90일
- 청구 사건: 2024-06-01 (협심증)
- 대기기간 사건: 2024-02-15 (흉통으로 응급실 방문)

**예상 결과**:
- phase: WAITING_PERIOD
- role: ETIOLOGY
- dutyToDisclose: POTENTIAL
- importanceScore: > 0.8

**케이스 3: 보장기간 정상 사건**
- 계약일: 2024-01-01
- 대기기간: 90일
- 청구 사건: 2024-06-01 (급성 맹장염)
- 보장기간 사건: 2024-05-30 (복통으로 병원 방문)

**예상 결과**:
- phase: COVERED_PERIOD
- role: CLAIM_CORE
- dutyToDisclose: NONE
- importanceScore: > 0.9

### 4.2 검증 절차

1. **테스트 데이터 준비**
   - 각 케이스별 의료 문서 준비
   - contractInfo, claimSpec 데이터 준비

2. **실행**
   ```bash
   # Feature Flag ON
   ENABLE_DISPUTE_TAGGING=true
   
   # 각 케이스 실행
   # API 호출 또는 프론트엔드 테스트
   ```

3. **결과 검증**
   - [ ] DisputeTag 생성 확인
   - [ ] phase 정확도
   - [ ] importanceScore 합리성
   - [ ] reasons 적절성

---

## 5. 문서화

### 5.1 API 문서 업데이트

**추가 내용**:
- DisclosureAnalyzer.analyzeDisclosure 파라미터 업데이트
  - contractInfo (optional)
  - claimSpec (optional)
- 응답 스키마에 disputeTag 필드 추가
- Feature Flag 설명

### 5.2 사용 가이드

**작성 내용**:
- Feature Flag 활성화 방법
- contractInfo, claimSpec 구조 설명
- DisputeTag 해석 방법
- 예제 코드

### 5.3 예제 코드

```javascript
// contractInfo 예제
const contractInfo = {
    issueDate: '2024-01-01',
    waitingPeriodDays: 90
};

// claimSpec 예제
const claimSpec = {
    claimDate: '2024-06-01',
    claimDiagnosisCodes: ['C50.9'],
    claimBodySystems: ['breast']
};

// API 호출 예제
const result = await disclosureAnalyzer.analyzeDisclosure(
    ruleResults,
    entities,
    timeline,
    contractInfo,  // optional
    claimSpec      // optional
);

// DisputeTag 확인
timeline.events.forEach(event => {
    if (event.disputeTag) {
        console.log(`Event: ${event.description}`);
        console.log(`Phase: ${event.disputeTag.phase}`);
        console.log(`Importance: ${event.disputeTag.importanceScore}`);
    }
});
```

---

## 6. 검증 체크리스트

### Phase 1.1 검증
- [x] DisputeTag 클래스 정의 완료
- [x] DiseaseBodySystemMapper 구현 완료
- [x] DisputeScoringUtil 구현 완료
- [x] 단위 테스트 27개 100% 통과

### Phase 1.2 검증
- [x] Feature Flag 추가 완료
- [x] DisclosureAnalyzer 확장 완료
- [x] ReportSynthesizer 확장 완료
- [x] 서버 재시작 성공

### Phase 1.3 검증 (진행 중)
- [ ] Feature Flag OFF 테스트 완료
- [ ] Feature Flag ON 테스트 완료
- [ ] 회귀 테스트 100% 통과
- [ ] 성능 측정 완료
- [ ] 대표 케이스 3건 검증 완료
- [ ] API 문서 업데이트
- [ ] 사용 가이드 작성
- [ ] 예제 코드 작성

---

## 7. 다음 단계

### 검증 완료 후
1. **Phase 1 최종 완료 보고서 작성**
2. **Phase 2 준비** (Investigator View & UI)
3. **또는 안정화 기간** (1-2주)

### Phase 2 Preview
- 조사자 화면 UI 구현
- 사건 후보 리스트 표시
- 경과보고서 편집 기능
- 저장/버전관리

---

## 📝 참고 사항

### 중요 제약사항
- OCR 파이프라인 절대 손상 금지
- 기존 API 호환성 100% 유지
- Feature Flag 기본값 false 유지

### 롤백 계획
- Feature Flag를 false로 설정하면 즉시 비활성화
- Git 커밋 단위로 롤백 가능
- 문제 발생 시 이전 버전으로 복구

### 연락처
- 개발자: [담당자 이름]
- 검증 담당: [담당자 이름]
- 승인자: [담당자 이름]
