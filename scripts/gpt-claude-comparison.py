#!/usr/bin/env python3
"""
GPT vs Claude 모델 비교 검증 (Gemini SSL 이슈로 제외)
- GPT-4o-mini (OpenAI)
- Claude 3.5 Haiku (Anthropic)
"""
import json
import re
import os
import asyncio
import ssl
import httpx
from pathlib import Path
from typing import Set, Dict, List
from datetime import datetime

# SSL verification bypass for WSL environment (testing only)

# API 클라이언트
try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    print("⚠️  OpenAI 패키지 없음")

try:
    from anthropic import AsyncAnthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    print("⚠️  Anthropic 패키지 없음")

def extract_dates_from_text(text: str) -> Set[str]:
    """텍스트에서 날짜 추출 (정규식)"""
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
            if is_valid_date(normalized):
                dates.add(normalized)

    return dates

def is_valid_date(date_str: str) -> bool:
    """날짜 유효성 검증"""
    try:
        year, month, day = map(int, date_str.split('-'))
        if year < 1950 or year > 2100:
            return False
        if month < 1 or month > 12:
            return False
        if day < 1 or day > 31:
            return False

        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)

        if month == 2 and is_leap:
            return day <= 29

        return day <= days_in_month[month - 1]
    except:
        return False

def merge_ocr_blocks(blocks: List[Dict]) -> str:
    """OCR 블록 병합"""
    sorted_blocks = sorted(blocks, key=lambda b: (b.get('bbox', {}).get('page', 0), b.get('bbox', {}).get('y', 0)))

    merged_text = ''
    last_page = -1

    for block in sorted_blocks:
        page = block.get('bbox', {}).get('page', 0)
        text = block.get('text', '')

        if page != last_page and last_page != -1:
            merged_text += '\n\n=== 페이지 구분 ===\n\n'
        last_page = page

        merged_text += text + ' '

    return merged_text.strip()

def create_date_extraction_prompt(merged_text: str, existing_dates: List[str]) -> str:
    """날짜 추출 프롬프트 생성 (최적화 버전)"""
    existing_info = f"\n\n이미 추출된 날짜: {', '.join(existing_dates)}\n위 날짜들도 포함하되, 추가로 누락된 날짜가 있는지 확인하세요." if existing_dates else ""

    return f"""다음은 의료보험 손해사정 보고서의 OCR 추출 텍스트입니다.

⚠️ 중요: 아래 텍스트는 표에서 추출되어 글자 간 공백이 있을 수 있습니다.
예시:
- "보 험 기 간" = "보험기간"
- "계 약 일" = "계약일"
- "사 고 발 생 일" = "사고발생일"
- "입 원 일" = "입원일"

이런 패턴의 텍스트에서도 날짜를 빠짐없이 추출해야 합니다.

📅 반드시 추출해야 할 날짜 (우선순위순):
1. **보험 계약일/가입일** (계약서 상단, 표 안)
2. **보험 기간** (시작일, 종료일) - 표 안에서 "보 험 기 간", "계약기간" 등으로 표시
3. **사고 발생일** - "사 고 일", "발생일자" 등
4. **병원 내원일/입원일/퇴원일** - "내 원 일", "입 원", "퇴 원"
5. **진단일/검사일/수술일** - "진단일자", "검 사 일", "수 술 일"
6. **청구일/접수일** - 문서 하단

날짜 형식:
- YYYY-MM-DD (예: 2024-05-01)
- YYYY.MM.DD (예: 2024.05.01)
- YYYY/MM/DD (예: 2024/05/01)
- YYYY년 MM월 DD일
→ 모두 YYYY-MM-DD 형식으로 정규화하세요.

제외 대상:
- 불가능한 날짜 (월 > 12, 일 > 31, 월/일 = 0)
- 페이지 번호, 문서 번호
- 연도만 있는 경우 (예: 2024)

텍스트:
{merged_text[:6000]}{existing_info}

JSON 형식으로 출력하세요 (dates 배열만):
{{"dates": ["2024-05-01", "2024-11-10", "2054-11-10"]}}"""

async def extract_with_gpt(blocks: List[Dict], existing_dates: List[str], api_key: str) -> tuple[Set[str], Dict]:
    """GPT-4o-mini로 날짜 추출"""
    if not HAS_OPENAI or not api_key:
        return set(), {"error": "OpenAI API 키 없음"}

    try:
        # SSL verification bypass for WSL environment
        http_client = httpx.AsyncClient(verify=False, timeout=60.0)
        client = AsyncOpenAI(api_key=api_key, http_client=http_client)

        merged_text = merge_ocr_blocks(blocks)
        prompt = create_date_extraction_prompt(merged_text, existing_dates)

        start = datetime.now()
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "당신은 의료보험 문서에서 날짜를 정확하게 추출하는 전문가입니다."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        elapsed = (datetime.now() - start).total_seconds()

        content = response.choices[0].message.content
        parsed = json.loads(content)

        dates = set()
        for date_str in parsed.get('dates', []):
            normalized = normalize_date(date_str)
            if is_valid_date(normalized):
                dates.add(normalized)

        return dates, {
            "success": True,
            "count": len(dates),
            "elapsed": elapsed,
            "tokens": response.usage.total_tokens if response.usage else 0
        }
    except Exception as e:
        return set(), {"error": str(e)}

async def extract_with_claude(blocks: List[Dict], existing_dates: List[str], api_key: str) -> tuple[Set[str], Dict]:
    """Claude 3.5 Haiku로 날짜 추출"""
    if not HAS_ANTHROPIC or not api_key:
        return set(), {"error": "Anthropic API 키 없음"}

    try:
        # SSL verification bypass for WSL environment
        http_client = httpx.AsyncClient(verify=False, timeout=60.0)
        client = AsyncAnthropic(api_key=api_key, http_client=http_client)

        merged_text = merge_ocr_blocks(blocks)
        prompt = create_date_extraction_prompt(merged_text, existing_dates)

        start = datetime.now()
        response = await client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=2048,
            temperature=0.1,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        elapsed = (datetime.now() - start).total_seconds()

        content = response.content[0].text
        parsed = json.loads(content)

        dates = set()
        for date_str in parsed.get('dates', []):
            normalized = normalize_date(date_str)
            if is_valid_date(normalized):
                dates.add(normalized)

        return dates, {
            "success": True,
            "count": len(dates),
            "elapsed": elapsed,
            "tokens": response.usage.input_tokens + response.usage.output_tokens
        }
    except Exception as e:
        return set(), {"error": str(e)}

def normalize_date(date_str: str) -> str:
    """날짜 정규화"""
    match = re.match(r'^(\d{4})[-./ ](\d{1,2})[-./ ](\d{1,2})$', date_str)
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

async def validate_case_dual_model(case: Dict, apis: Dict) -> Dict:
    """케이스를 2개 모델로 검증"""
    case_name = case['name']

    # Baseline 날짜
    baseline_file = Path(case['baseline_file'])
    if not baseline_file.exists():
        return None

    baseline_text = baseline_file.read_text(encoding='utf-8')
    baseline_dates = extract_dates_from_text(baseline_text)

    # OCR 파일
    ocr_file = Path(case['ocr_file'])
    if not ocr_file.exists():
        return None

    # OCR 데이터 로드
    if ocr_file.suffix.lower() == '.csv':
        ocr_text = ocr_file.read_text(encoding='utf-8')
        blocks = []  # CSV는 블록 정보 없음
        ocr_dates_regex = extract_dates_from_text(ocr_text)
    else:
        try:
            with open(ocr_file, encoding='utf-8') as f:
                ocr_data = json.load(f)
            blocks = ocr_data.get('blocks', [])
            ocr_text = '\n'.join([b.get('text', '') for b in blocks])
            ocr_dates_regex = extract_dates_from_text(ocr_text)
        except:
            return None

    # 2개 모델로 병렬 처리
    if blocks:
        gpt_task = extract_with_gpt(blocks, list(ocr_dates_regex), apis.get('openai', ''))
        claude_task = extract_with_claude(blocks, list(ocr_dates_regex), apis.get('claude', ''))

        results = await asyncio.gather(gpt_task, claude_task, return_exceptions=True)

        gpt_dates, gpt_meta = results[0] if not isinstance(results[0], Exception) else (set(), {"error": str(results[0])})
        claude_dates, claude_meta = results[1] if not isinstance(results[1], Exception) else (set(), {"error": str(results[1])})
    else:
        gpt_dates, claude_dates = set(), set()
        gpt_meta = claude_meta = {"error": "CSV 파일 (블록 없음)"}

    # 각 모델 결과 계산
    def calc_result(llm_dates):
        total_dates = ocr_dates_regex | llm_dates
        matched = baseline_dates & total_dates
        accuracy = (len(matched) / len(baseline_dates) * 100) if baseline_dates else 100.0
        return {
            "accuracy": accuracy,
            "grade": classify_grade(accuracy),
            "matched": len(matched),
            "total": len(total_dates),
            "llm_added": len(llm_dates)
        }

    return {
        "case_name": case_name,
        "case_type": case['type'],
        "baseline_dates": len(baseline_dates),
        "ocr_regex": len(ocr_dates_regex),
        "regex_only": calc_result(set()),
        "gpt": {**calc_result(gpt_dates), "meta": gpt_meta},
        "claude": {**calc_result(claude_dates), "meta": claude_meta}
    }

async def main():
    # API 키
    apis = {
        'openai': os.environ.get('OPENAI_API_KEY', ''),
        'claude': os.environ.get('ANTHROPIC_API_KEY', '')
    }

    print("=" * 100)
    print("GPT vs Claude 모델 비교 검증")
    print("=" * 100)
    print(f"✅ GPT-4o-mini: {'사용 가능' if apis['openai'] else '❌ API 키 없음'}")
    print(f"✅ Claude 3.5 Haiku: {'사용 가능' if apis['claude'] else '❌ API 키 없음'}")
    print(f"⚠️  Gemini 2.0 Flash: WSL SSL 이슈로 제외")
    print()

    # 케이스 로드
    cases_file = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")
    with open(cases_file) as f:
        cases = json.load(f)

    print(f"총 케이스: {len(cases)}개")
    print()

    results = []
    for i, case in enumerate(cases, 1):
        print(f"[{i}/{len(cases)}] {case['name']} 검증 중...", flush=True)

        result = await validate_case_dual_model(case, apis)
        if result:
            results.append(result)

            # 간단한 결과 출력
            print(f"  정규식: {result['regex_only']['grade']} ({result['regex_only']['accuracy']:.1f}%)")
            if 'error' not in result['gpt']['meta']:
                print(f"  GPT:    {result['gpt']['grade']} ({result['gpt']['accuracy']:.1f}%) +{result['gpt']['llm_added']}개")
            if 'error' not in result['claude']['meta']:
                print(f"  Claude: {result['claude']['grade']} ({result['claude']['accuracy']:.1f}%) +{result['claude']['llm_added']}개")
        else:
            print("  ❌ 실패")
        print()

    # 저장
    output_path = Path("/home/user/VNEXSUS-25-12-30/outputs/gpt_claude_comparison.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"✅ 결과 저장: {output_path}")

    # 통계 출력
    if results:
        print()
        print("=" * 100)
        print("모델별 평균 정확도")
        print("=" * 100)

        regex_avg = sum(r['regex_only']['accuracy'] for r in results) / len(results)
        gpt_results = [r for r in results if 'error' not in r['gpt']['meta']]
        claude_results = [r for r in results if 'error' not in r['claude']['meta']]

        gpt_avg = sum(r['gpt']['accuracy'] for r in gpt_results) / len(gpt_results) if gpt_results else 0
        claude_avg = sum(r['claude']['accuracy'] for r in claude_results) / len(claude_results) if claude_results else 0

        print(f"Regex Only:     {regex_avg:.1f}%")
        print(f"GPT-4o-mini:    {gpt_avg:.1f}% ({len(gpt_results)}개 성공)")
        print(f"Claude 3.5 Haiku: {claude_avg:.1f}% ({len(claude_results)}개 성공)")

if __name__ == "__main__":
    asyncio.run(main())
