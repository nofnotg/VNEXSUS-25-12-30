#!/usr/bin/env python3
"""
28케이스 재검증 (LLM 날짜 보완 적용)
"""
import json
import re
import sys
import os
from pathlib import Path
from typing import Set, Dict, List
import asyncio

# OpenAI 클라이언트
try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    print("⚠️  OpenAI 패키지가 설치되지 않음. LLM 보완 없이 진행합니다.")
    print("   설치: pip install openai")
    HAS_OPENAI = False

def extract_dates_from_text(text: str) -> Set[str]:
    """텍스트에서 날짜 추출"""
    patterns = [
        r'(\d{4})[-](\d{1,2})[-](\d{1,2})',
        r'(\d{4})[.](\d{1,2})[.](\d{1,2})',
        r'(\d{4})[/](\d{1,2})[/](\d{1,2})',
        r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일',
    ]

    dates = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            dates.add(normalized)

    return dates

def is_valid_date(date_str: str) -> bool:
    """날짜 유효성 검증"""
    try:
        year, month, day = map(int, date_str.split('-'))

        # 범위 체크
        if year < 1950 or year > 2100:
            return False
        if month < 1 or month > 12:
            return False
        if day < 1 or day > 31:
            return False

        # 월별 일수 체크
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

        # 윤년
        is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
        if month == 2 and is_leap:
            return day <= 29

        if day > days_in_month[month - 1]:
            return False

        # 미래 날짜 체크 (50년 후까지 허용)
        from datetime import datetime, timedelta
        date = datetime(year, month, day)
        max_future = datetime.now() + timedelta(days=365 * 50)

        if date > max_future:
            return False

        return True
    except:
        return False

def merge_ocr_blocks(blocks: List[Dict]) -> str:
    """OCR 블록을 병합하여 연속된 텍스트 생성"""
    # 페이지와 Y 좌표로 정렬
    sorted_blocks = sorted(blocks, key=lambda b: (b.get('bbox', {}).get('page', 0), b.get('bbox', {}).get('y', 0)))

    merged_text = ''
    last_page = -1

    for block in sorted_blocks:
        page = block.get('bbox', {}).get('page', 0)
        text = block.get('text', '')

        # 페이지 구분
        if page != last_page and last_page != -1:
            merged_text += '\n\n=== 페이지 구분 ===\n\n'
        last_page = page

        merged_text += text + ' '

    return merged_text.strip()

async def extract_dates_with_llm(blocks: List[Dict], existing_dates: List[str], api_key: str) -> Set[str]:
    """LLM으로 날짜 추출"""
    if not HAS_OPENAI:
        return set()

    try:
        client = AsyncOpenAI(api_key=api_key)

        # 블록 병합
        merged_text = merge_ocr_blocks(blocks)

        if len(merged_text) == 0:
            return set()

        # 기존 날짜 정보
        existing_info = f"\n\n이미 추출된 날짜: {', '.join(existing_dates)}\n위 날짜들도 포함하되, 추가로 누락된 날짜가 있는지 확인하세요." if existing_dates else ""

        # 프롬프트
        prompt = f"""다음은 의료보험 손해사정 보고서의 OCR 추출 텍스트입니다.
중요한 날짜를 모두 찾아주세요. **특히 표 구조 안의 날짜도 빠짐없이 추출**하세요.

추출 대상:
1. 보험 계약일/가입일
2. 보험 기간 (시작일, 종료일) - 표 안의 "보 험 기 간" 같이 글자 간 공백이 있어도 추출
3. 사고 발생일
4. 병원 내원일/입원일/퇴원일
5. 검사일/수술일
6. 진단일

주의사항:
- 날짜 형식: YYYY-MM-DD로 정규화 (예: 2024.05.01 → 2024-05-01)
- 불가능한 날짜는 제외 (예: 2024-00-24, 월이 0)
- 페이지 번호, 문서 번호는 제외
- 명백히 오류인 날짜는 제외

텍스트:
{merged_text[:8000]}{existing_info}

JSON 형식으로 출력하세요 (dates 배열만):
{{"dates": ["2024-05-01", "2024-11-10", ...]}}"""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "당신은 의료보험 문서에서 날짜를 정확하게 추출하는 전문가입니다. 표 구조와 복잡한 레이아웃에서도 날짜를 정확히 인식합니다."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )

        content = response.choices[0].message.content
        if not content:
            return set()

        parsed = json.loads(content)
        dates = set()

        for date_str in parsed.get('dates', []):
            # 정규화
            normalized = normalize_date_format(date_str)
            if is_valid_date(normalized):
                dates.add(normalized)

        return dates
    except Exception as e:
        print(f"  ⚠️  LLM 호출 오류: {e}")
        return set()

def normalize_date_format(date_str: str) -> str:
    """날짜 형식 정규화"""
    # YYYY-M-D -> YYYY-MM-DD
    match = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', date_str)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # YYYY.MM.DD
    match = re.match(r'^(\d{4})\.(\d{1,2})\.(\d{1,2})$', date_str)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    # YYYY/MM/DD
    match = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})$', date_str)
    if match:
        year, month, day = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"

    return date_str

def classify_grade(accuracy: float) -> str:
    """등급 분류"""
    if accuracy >= 80:
        return "상"
    elif accuracy >= 60:
        return "중"
    else:
        return "하"

async def validate_case(case: Dict, api_key: str, enable_llm: bool = True) -> Dict:
    """케이스 검증"""
    case_name = case['name']

    # Baseline 날짜 추출
    baseline_file = Path(case['baseline_file'])
    if not baseline_file.exists():
        return None

    baseline_text = baseline_file.read_text(encoding='utf-8')
    baseline_dates = extract_dates_from_text(baseline_text)

    # OCR 날짜 추출
    ocr_file = Path(case['ocr_file'])
    if not ocr_file.exists():
        return None

    with open(ocr_file, encoding='utf-8') as f:
        ocr_data = json.load(f)

    # 기본 OCR 날짜 (정규식)
    ocr_text = '\n'.join([block.get('text', '') for block in ocr_data.get('blocks', [])])
    ocr_dates_regex = extract_dates_from_text(ocr_text)

    # LLM 날짜 보완
    llm_dates = set()
    if enable_llm and HAS_OPENAI and api_key:
        llm_dates = await extract_dates_with_llm(
            ocr_data.get('blocks', []),
            list(ocr_dates_regex),
            api_key
        )

    # 날짜 병합
    ocr_dates = ocr_dates_regex | llm_dates

    # 비교
    matched = baseline_dates & ocr_dates
    missing = baseline_dates - ocr_dates

    accuracy = (len(matched) / len(baseline_dates) * 100) if baseline_dates else 100.0
    grade = classify_grade(accuracy)

    return {
        'case_name': case_name,
        'case_type': case['type'],
        'baseline_dates': len(baseline_dates),
        'ocr_dates_regex': len(ocr_dates_regex),
        'llm_dates': len(llm_dates),
        'ocr_dates_total': len(ocr_dates),
        'matched': len(matched),
        'missing': len(missing),
        'accuracy': accuracy,
        'grade': grade,
        'missing_sample': list(missing)[:5]
    }

async def main():
    # API 키
    api_key = os.environ.get('OPENAI_API_KEY', '')
    enable_llm = HAS_OPENAI and bool(api_key)

    if not enable_llm:
        print("⚠️  LLM 보완 비활성화 (OpenAI API 키 없음)")
        print()
    else:
        print("✅ LLM 보완 활성화 (GPT-4o-mini)")
        print()

    # 케이스 로드
    cases_file = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")
    with open(cases_file) as f:
        cases = json.load(f)

    print("=" * 100)
    print("28케이스 재검증 (LLM 날짜 보완)")
    print("=" * 100)
    print(f"총 케이스: {len(cases)}개")
    print()

    results = []
    for i, case in enumerate(cases, 1):
        print(f"[{i}/{len(cases)}] {case['name']} 검증 중...", end=' ', flush=True)

        result = await validate_case(case, api_key, enable_llm)
        if result:
            results.append(result)
            print(f"{result['grade']} ({result['accuracy']:.1f}%)")
        else:
            print("❌ 실패")

    # 통계
    print()
    print("=" * 100)
    print("검증 결과")
    print("=" * 100)

    if not results:
        print("검증 결과 없음")
        return

    avg_accuracy = sum(r['accuracy'] for r in results) / len(results)
    grade_counts = {'상': 0, '중': 0, '하': 0}
    for r in results:
        grade_counts[r['grade']] += 1

    print(f"\n평균 정확도: {avg_accuracy:.1f}%")
    print(f"\n등급 분포:")
    print(f"  상 (80-100%): {grade_counts['상']}개 ({grade_counts['상']/len(results)*100:.1f}%)")
    print(f"  중 (60-79%):  {grade_counts['중']}개 ({grade_counts['중']/len(results)*100:.1f}%)")
    print(f"  하 (<60%):    {grade_counts['하']}개 ({grade_counts['하']/len(results)*100:.1f}%)")

    # LLM 기여도
    if enable_llm:
        total_llm_dates = sum(r['llm_dates'] for r in results)
        total_ocr_regex = sum(r['ocr_dates_regex'] for r in results)
        print(f"\nLLM 기여:")
        print(f"  정규식 추출: {total_ocr_regex}개")
        print(f"  LLM 추가: {total_llm_dates}개")
        print(f"  총 날짜: {total_ocr_regex + total_llm_dates}개")

    # 저장
    output_path = Path("/home/user/VNEXSUS-25-12-30/outputs/validation_28_with_llm.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n✅ 결과 저장: {output_path}")

if __name__ == "__main__":
    asyncio.run(main())
