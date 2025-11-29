# T03. SourceSpan(근거 스팬) 강제 저장 + 출력 포함

## 목적
- 모든 핵심 이벤트가 “원문 근거”를 가진다(감사/분쟁 대응).
- UI에서 원문 하이라이트/클릭 점프까지 확장 가능하게 만든다.

## 범위
- 이벤트 생성 시 `sourceSpan`를 최우선 필드로 강제
- 최소: start/end/textPreview
- 가능한 경우: anchorTerms(매칭에 사용된 키워드 목록) 저장

## 대상 파일/모듈
- MOD/NEW: `backend/postprocess/medicalEventModel.js` (attachSourceSpan)
- MOD: `backend/postprocess/enhancedMassiveDateBlockProcessor.js` (블록 단위 오프셋 제공 가능하면 제공)
- MOD: `backend/postprocess/reportBuilder.js` (txt/json에 sourceSpan 출력 옵션)

## 구현 아이디어
- 1차: 단순 substring 검색(날짜 + 병원/진단 키워드)로 anchor를 잡고 주변 N자 슬라이스를 preview로 채움.
- 2차: enhanced processor의 블록 분할 결과에 “원문 오프셋”을 함께 들고 다니도록 확장.

## 완료 기준(DoD)
- Core 이벤트의 sourceSpan 첨부율 95%+
- 누락 이벤트는 별도 로그로 남겨 추적 가능
