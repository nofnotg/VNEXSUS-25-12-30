# 좌표 정보 없는 50개 케이스 활용 방안

## 📋 현황 분석

### 케이스 구분
- **좌표 있는 케이스 (28개):** JSON 형식, bbox 좌표 정보 포함
- **좌표 없는 케이스 (50개):** 텍스트만 있거나 구조화되지 않은 형태

### 좌표 정보의 역할
현재 검증 시스템에서 좌표 정보는:
- OCR 블록의 공간적 위치 파악
- 페이지 및 Y축 기준 정렬
- 텍스트 병합 순서 결정
- **그러나 날짜 추출 자체에는 필수가 아님**

---

## 💡 활용 방안

### Option 1: Vision LLM 직접 처리 ⭐ (최우선 권장)

**개념:**
좌표 정보 없이 **원본 PDF/이미지를 Vision LLM에 직접 입력**

**장점:**
- ✅ 좌표 정보 완전히 불필요
- ✅ OCR 단계 우회로 인식 오류 제거
- ✅ 표 구조 직접 인식
- ✅ 50개 케이스 모두 활용 가능

**구현 방법:**
```python
# GPT-4o Vision 예시
import base64
from openai import OpenAI

client = OpenAI()

def extract_dates_from_pdf_vision(pdf_path: str) -> List[str]:
    """Vision LLM으로 PDF에서 직접 날짜 추출"""

    # PDF를 이미지로 변환
    images = convert_pdf_to_images(pdf_path)

    dates = []
    for image in images:
        # Base64 인코딩
        base64_image = encode_image(image)

        # Vision LLM 호출
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """의료보험 손해사정 보고서입니다.
                            다음 날짜를 모두 찾아주세요:
                            1. 보험 계약일/가입일
                            2. 보험 기간 (시작일, 종료일)
                            3. 사고 발생일
                            4. 병원 내원일/입원일/퇴원일
                            5. 진단일/검사일/수술일

                            JSON 형식으로 출력:
                            {"dates": ["2024-05-01", ...]}"""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000
        )

        # 날짜 파싱
        content = json.loads(response.choices[0].message.content)
        dates.extend(content['dates'])

    return dates
```

**비용:**
- GPT-4o: ~$0.05/case (이미지 입력)
- Claude 3.5 Sonnet: ~$0.03/case
- Gemini 2.0 Flash: ~$0.02/case

**활용 계획:**
1. 50개 케이스로 Vision LLM 성능 테스트
2. 28개 좌표 케이스와 비교 (ground truth)
3. Vision LLM의 정확도 검증
4. 비용 대비 효과 분석

---

### Option 2: 텍스트 기반 날짜 추출 (좌표 불필요)

**개념:**
OCR 텍스트가 있다면 좌표 없이도 날짜 추출 가능

**필요 조건:**
- OCR 텍스트 결과만 있으면 됨
- 순서는 무작위여도 상관없음 (LLM이 문맥으로 이해)

**구현:**
```python
def extract_dates_from_text_only(ocr_text: str) -> List[str]:
    """좌표 정보 없이 텍스트만으로 날짜 추출"""

    # 1. Regex 기본 추출
    regex_dates = extract_with_regex(ocr_text)

    # 2. LLM 보완 추출
    llm_dates = extract_with_llm(ocr_text, existing_dates=regex_dates)

    # 3. 병합
    all_dates = merge_dates(regex_dates, llm_dates)

    return all_dates

def extract_with_llm(text: str, existing_dates: List[str]) -> List[str]:
    """LLM으로 날짜 추출 (좌표 불필요)"""

    prompt = f"""다음은 의료보험 문서의 OCR 텍스트입니다.

    텍스트:
    {text}

    이미 추출된 날짜: {', '.join(existing_dates)}

    추가로 누락된 날짜를 찾아주세요.
    특히 표 구조에서 누락된 날짜를 찾아야 합니다.
    """

    # GPT-4o-mini 호출
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )

    return parse_dates(response)
```

**장점:**
- ✅ 좌표 정보 불필요
- ✅ 비용 저렴 ($0.001-0.002/case)
- ✅ 빠른 처리

**단점:**
- ❌ OCR 텍스트가 없으면 사용 불가
- ❌ 표 구조 인식 제한적

**활용 계획:**
1. 50개 케이스 중 OCR 텍스트가 있는 케이스 확인
2. 텍스트 기반 날짜 추출 실행
3. 결과를 정성적으로 평가

---

### Option 3: 학습 데이터로 활용

**개념:**
좌표 없는 케이스를 **LLM Fine-tuning 또는 Few-shot Learning**에 활용

**Fine-tuning 데이터셋 구축:**
```json
[
  {
    "messages": [
      {
        "role": "system",
        "content": "당신은 의료보험 문서에서 날짜를 추출하는 전문가입니다."
      },
      {
        "role": "user",
        "content": "OCR 텍스트: {50개 케이스의 텍스트}"
      },
      {
        "role": "assistant",
        "content": "{\"dates\": [\"2024-05-01\", ...]}"
      }
    ]
  }
]
```

**장점:**
- ✅ 모델 성능 향상
- ✅ 도메인 특화 학습
- ✅ 50개 케이스 모두 활용

**단점:**
- ❌ 정답 레이블링 필요 (수작업)
- ❌ Fine-tuning 비용

**활용 계획:**
1. 50개 케이스 중 10-20개 선정
2. 수작업으로 정답 날짜 레이블링
3. Few-shot Learning 프롬프트에 활용
4. 성능 개선 효과 측정

---

### Option 4: 정성적 평가 데이터로 활용

**개념:**
좌표 없는 케이스를 **edge case 테스트**에 활용

**활용 방법:**
1. **복잡도 분류**
   - 간단한 케이스: 표 없음, 날짜 명확
   - 중간 케이스: 표 1-2개
   - 복잡한 케이스: 다중 표, 복잡한 레이아웃

2. **모델별 성능 비교**
   - GPT-4o-mini vs Claude 3.5 Haiku
   - Vision LLM vs OCR + LLM
   - 복잡도별 정확도 분석

3. **에러 패턴 발견**
   - 어떤 유형의 문서에서 실패하는가?
   - 특정 날짜 유형(보험 기간, 입원일 등)에서 문제가 있는가?

**장점:**
- ✅ 정량적 지표 없이도 활용 가능
- ✅ 모델 한계 파악
- ✅ 개선 방향 도출

---

## 🎯 권장 활용 전략

### 단계별 접근

#### Phase 1: Vision LLM 파일럿 테스트 (즉시 실행 가능)
```
1. 50개 케이스 중 5-10개 선정
2. GPT-4o Vision으로 날짜 추출
3. 수작업으로 정답 확인
4. 정확도 측정 및 비용 분석
```

**예상 비용:** 10개 × $0.05 = **$0.50**

**성공 기준:**
- 정확도 85%+ 달성
- 좌표 있는 28개 케이스와 유사한 성능

#### Phase 2: 텍스트 기반 추출 (병행)
```
1. 50개 케이스 중 OCR 텍스트 있는 케이스 확인
2. 현재 LLM 프롬프트로 날짜 추출
3. 결과를 정성적으로 평가
```

**예상 비용:** 50개 × $0.002 = **$0.10**

#### Phase 3: 학습 데이터 구축 (중기)
```
1. 20개 케이스 선정
2. 수작업 레이블링
3. Few-shot Learning 프롬프트 구성
4. 성능 개선 측정
```

---

## 📊 예상 효과

### Vision LLM 활용 시
| 지표 | 예상 값 |
|------|---------|
| 활용 가능 케이스 | 50/50 (100%) |
| 정확도 | 90%+ |
| 케이스당 비용 | $0.02-0.05 |
| 처리 시간 | 5-10초/case |

### 텍스트 기반 추출 시
| 지표 | 예상 값 |
|------|---------|
| 활용 가능 케이스 | 30-40/50 (OCR 텍스트 있는 경우) |
| 정확도 | 80-85% |
| 케이스당 비용 | $0.001-0.002 |
| 처리 시간 | 2-3초/case |

---

## 🔄 실행 계획

### Week 1-2: Vision LLM 파일럿
1. **환경 설정**
   - PDF → 이미지 변환 라이브러리 (pdf2image)
   - GPT-4o Vision API 통합
   - 비용 추적 시스템

2. **10개 케이스 테스트**
   - 다양한 복잡도 선정
   - Vision LLM 실행
   - 수작업 검증

3. **결과 분석**
   - 정확도 측정
   - 비용 집계
   - OCR + LLM과 비교

### Week 3: 텍스트 기반 추출
1. **케이스 확인**
   - OCR 텍스트 유무 확인
   - 텍스트 품질 평가

2. **추출 실행**
   - 현재 LLM 프롬프트 사용
   - 50개 케이스 처리

3. **정성적 평가**
   - 누락된 날짜 패턴 분석
   - 개선 방향 도출

### Week 4: 통합 및 보고
1. **결과 통합**
   - Vision LLM vs 텍스트 기반 비교
   - 비용 대비 효과 분석

2. **권장 전략 수립**
   - 케이스 유형별 최적 방법
   - 하이브리드 전략 제안

3. **문서화**
   - 실행 가이드
   - 베스트 프랙티스

---

## 💡 핵심 인사이트

### 좌표 정보가 없어도 활용 가능한 이유
1. **Vision LLM은 이미지를 직접 처리**
   - OCR 단계 자체가 불필요
   - 좌표 정보 필요 없음

2. **LLM은 문맥으로 이해**
   - 텍스트 순서가 뒤섞여도 이해 가능
   - "보 험 기 간" 같은 패턴도 인식

3. **Regex는 좌표 불필요**
   - 텍스트만 있으면 패턴 매칭 가능

### 좌표 정보의 실제 가치
- **정밀한 검증 시:** 유용 (정확한 위치 추적)
- **날짜 추출 자체:** 필수 아님
- **50개 케이스 활용:** 충분히 가능

---

**작성일:** 2025-01-18
**작성자:** Claude (Sonnet 4.5)
**상태:** 활용 방안 제안
**다음 단계:** Vision LLM 파일럿 테스트
