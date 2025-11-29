# T06. majorEvents.json 확장(코드/질환군/중대검사/수술 트리거)

## 목적
- 룰 엔진의 정확도를 “사전 강화”로 끌어올린다(파인튜닝 없이).
- 특히 고지의무 위반 핵심군(종양/심혈관/중대검사/입원/수술)을 우선 확대.

## 대상 파일
- MOD: `backend/postprocess/majorEvents.json`
- MOD: `backend/postprocess/dictionaryManager.js`

## 확장 항목(v1)
1) 주요 질환군별 ICD/KCD prefix
   - 종양: C*, D0*, D1*(일부), 영상/조직검사 트리거 강화
   - 심혈관: I20, I21, I22, I25 등
2) 중대 검사 키워드 세트
   - CT, MRI, CAG, PET, 조직검사, 생검, angiography 등(한/영 혼합)
3) 수술/시술 키워드 세트
   - “절제”, “봉합”, “스텐트”, “PCI”, “hemicolectomy” 등
4) 제외 키워드(노이즈)
   - 간호기록/바이탈/드레싱 등(이미 존재 → 보강)

## 완료 기준(DoD)
- dictionaryManager가 “질문 트리거”로 사용할 수 있는 normalize 결과 제공
- 향후 룰/질문을 추가할 때 코드 수정이 아니라 json 확장 중심으로 가능
