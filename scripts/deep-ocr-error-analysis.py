#!/usr/bin/env python3
"""
OCR 날짜 오류 정밀 분석
- 좌표 기반 컨텍스트 분석
- 인식 오류 vs 잘못 인식 구분
- 의료 이벤트 내용 분석
"""
import json
import re
from pathlib import Path
from typing import List, Dict, Set, Tuple
from dataclasses import dataclass

@dataclass
class Block:
    page: int
    text: str
    x: float
    y: float
    width: float
    height: float
    confidence: float = 0.0

@dataclass
class ErrorAnalysis:
    error_date: str
    error_type: str  # "인식오류" | "잘못인식" | "숫자배열오인"
    found_in_blocks: bool
    block_index: int = -1
    surrounding_text: List[str] = None
    coordinates: Dict = None
    spatial_context: str = ""
    medical_keywords: List[str] = None
    reasoning: str = ""

def extract_dates_from_text(text: str) -> Set[str]:
    """텍스트에서 날짜 추출"""
    patterns = [
        r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})',
        r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일',
    ]
    dates = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            dates.add(normalized)
    return dates

def load_offline_ocr(json_path: Path) -> List[Block]:
    """offline_ocr.json에서 블록 로드"""
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)

    blocks = []
    if 'blocks' in data and isinstance(data['blocks'], list):
        for b in data['blocks']:
            bbox = b.get('bbox', {})
            blocks.append(Block(
                page=bbox.get('page', 0),
                text=b.get('text', ''),
                x=bbox.get('x', 0),
                y=bbox.get('y', 0),
                width=bbox.get('width', 0),
                height=bbox.get('height', 0),
                confidence=b.get('confidence', 0)
            ))

    return blocks

def find_block_with_date(blocks: List[Block], date_str: str) -> Tuple[int, Block]:
    """날짜를 포함한 블록 찾기"""
    # 정확한 날짜 문자열 검색
    for i, block in enumerate(blocks):
        if date_str in block.text:
            return i, block

    # 날짜 패턴으로 검색
    year, month, day = date_str.split('-')
    patterns = [
        f"{year}-{month}-{day}",
        f"{year}.{month}.{day}",
        f"{year}/{month}/{day}",
        f"{year}년{month}월{day}일",
        f"{year}년 {month}월 {day}일",
        f"{int(year)}.{int(month)}.{int(day)}",
    ]

    for i, block in enumerate(blocks):
        for pattern in patterns:
            if pattern in block.text:
                return i, block

    return -1, None

def get_surrounding_blocks(blocks: List[Block], index: int, window: int = 5) -> List[Tuple[int, Block]]:
    """주변 블록 추출 (±window)"""
    start = max(0, index - window)
    end = min(len(blocks), index + window + 1)
    return [(i, blocks[i]) for i in range(start, end)]

def calculate_spatial_distance(b1: Block, b2: Block) -> float:
    """두 블록 간 공간 거리"""
    if b1.page != b2.page:
        return float('inf')

    # Center points
    x1 = b1.x + b1.width / 2
    y1 = b1.y + b1.height / 2
    x2 = b2.x + b2.width / 2
    y2 = b2.y + b2.height / 2

    return ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5

def find_spatially_close_blocks(blocks: List[Block], target: Block, max_distance: float = 100) -> List[Tuple[int, Block, float]]:
    """좌표 기반으로 가까운 블록 찾기"""
    close_blocks = []
    for i, block in enumerate(blocks):
        if block.page == target.page:
            distance = calculate_spatial_distance(target, block)
            if distance < max_distance:
                close_blocks.append((i, block, distance))

    return sorted(close_blocks, key=lambda x: x[2])

def extract_medical_keywords(text: str) -> List[str]:
    """의료 관련 키워드 추출"""
    keywords = [
        # 진단/처치
        '진단', '검사', '수술', '처방', '투약', '치료', '입원', '퇴원',
        '외래', '응급', '수혈', '주사', '촬영', '판독',
        # 진료과
        '내과', '외과', '정형외과', '신경외과', '산부인과', '소아과', '이비인후과',
        # 검사명
        'CT', 'MRI', 'X-ray', '초음파', '혈액검사', '소변검사',
        # 의료행위
        '처방전', '진료기록', '소견서', '의견서', '진단서',
        # 날짜 관련
        '초진', '재진', '내원', '방문', '경과', '추적',
    ]

    found = []
    for keyword in keywords:
        if keyword in text:
            found.append(keyword)

    return found

def analyze_date_sequence(blocks: List[Block], target_date: str, window: int = 10) -> Dict:
    """날짜 시퀀스 분석 - 정배열 체크"""
    all_dates = []

    for i, block in enumerate(blocks):
        dates = extract_dates_from_text(block.text)
        for date in dates:
            try:
                year = int(date.split('-')[0])
                if 1900 <= year <= 2100:  # Valid year range
                    all_dates.append((i, date, block.page, block.y))
            except:
                pass

    # Sort by page and Y position
    all_dates.sort(key=lambda x: (x[2], x[3]))

    # Find target date position
    target_index = -1
    for i, (_, date, _, _) in enumerate(all_dates):
        if date == target_date:
            target_index = i
            break

    if target_index == -1:
        return {
            'found_in_sequence': False,
            'total_dates': len(all_dates),
            'before': [],
            'after': []
        }

    # Extract surrounding dates
    start = max(0, target_index - window)
    end = min(len(all_dates), target_index + window + 1)

    before = all_dates[start:target_index]
    after = all_dates[target_index+1:end]

    return {
        'found_in_sequence': True,
        'total_dates': len(all_dates),
        'position': target_index,
        'before': [(date, page) for _, date, page, _ in before[-5:]],
        'after': [(date, page) for _, date, page, _ in after[:5]],
        'target': (target_date, all_dates[target_index][2])
    }

def classify_error_type(error_date: str, blocks: List[Block], baseline_dates: Set[str]) -> ErrorAnalysis:
    """오류 유형 분류"""

    # 1. 블록에서 날짜 찾기
    block_idx, found_block = find_block_with_date(blocks, error_date)

    if block_idx == -1:
        # 날짜가 블록에 없음 - baseline 오류 가능성
        return ErrorAnalysis(
            error_date=error_date,
            error_type="baseline_error",
            found_in_blocks=False,
            reasoning="이 날짜는 OCR 블록에서 발견되지 않음. Baseline 파일의 오류이거나 OCR이 누락한 것일 수 있음."
        )

    # 2. 주변 블록 추출
    surrounding = get_surrounding_blocks(blocks, block_idx, window=5)
    surrounding_text = [f"[{i}] {b.text[:100]}" for i, b in surrounding]

    # 3. 좌표 기반 가까운 블록 찾기
    spatially_close = find_spatially_close_blocks(blocks, found_block, max_distance=50)

    # 4. 날짜 시퀀스 분석
    sequence = analyze_date_sequence(blocks, error_date)

    # 5. 의료 키워드 추출
    context_text = ' '.join([b.text for _, b in surrounding])
    medical_keywords = extract_medical_keywords(context_text)

    # 6. 오류 유형 판단
    year = int(error_date.split('-')[0])
    month = int(error_date.split('-')[1])
    day = int(error_date.split('-')[2])

    # 불가능한 날짜 체크
    if month < 1 or month > 12:
        error_type = "인식오류"
        reasoning = f"월이 {month}로 인식됨 - OCR이 숫자를 잘못 읽었을 가능성. "
    elif day < 1 or day > 31:
        error_type = "인식오류"
        reasoning = f"일이 {day}로 인식됨 - OCR이 숫자를 잘못 읽었을 가능성. "
    elif year > 2026 or year < 1950:
        error_type = "인식오류"
        reasoning = f"연도가 {year}로 인식됨 - OCR이 숫자를 잘못 읽었을 가능성. "

        # 시퀀스 체크
        if sequence['found_in_sequence']:
            reasoning += f"날짜 시퀀스 상 전후: {sequence['before'][-2:]} → {error_date} → {sequence['after'][:2]}. "
    else:
        # 미래 날짜인 경우
        from datetime import datetime
        try:
            date_obj = datetime.strptime(error_date, "%Y-%m-%d")
            if date_obj > datetime.now():
                error_type = "잘못인식"
                reasoning = f"미래 날짜로 인식됨. "

                # 의료 키워드 체크
                if medical_keywords:
                    reasoning += f"주변에서 발견된 의료 키워드: {', '.join(medical_keywords[:5])}. "
                    reasoning += "의료 이벤트의 예정/계획 날짜일 가능성도 있음. "
                else:
                    reasoning += "의료 키워드가 거의 없어 날짜가 아닌 숫자 배열을 날짜로 오인했을 가능성. "
            else:
                error_type = "잘못인식"
                reasoning = "과거 날짜이지만 Baseline에 누락됨. "
        except:
            error_type = "숫자배열오인"
            reasoning = "날짜 형식이지만 유효하지 않은 날짜. "

    return ErrorAnalysis(
        error_date=error_date,
        error_type=error_type,
        found_in_blocks=True,
        block_index=block_idx,
        surrounding_text=surrounding_text,
        coordinates={
            'page': found_block.page,
            'x': found_block.x,
            'y': found_block.y,
            'width': found_block.width,
            'height': found_block.height,
        },
        spatial_context=f"Page {found_block.page}, 좌표 ({found_block.x:.1f}, {found_block.y:.1f})",
        medical_keywords=medical_keywords,
        reasoning=reasoning
    )

def main():
    # Load validation results
    results_path = Path("/home/user/VNEXSUS-25-12-30/outputs/quick_validation_28.json")
    with open(results_path) as f:
        results = json.load(f)

    # Find error cases (하 등급 or 오류 날짜 있는 케이스)
    error_cases = [
        r for r in results
        if r['grade'] == '하' or len(r['impossible_dates']) > 0 or len(r['future_dates']) > 0
    ]

    print("=" * 100)
    print("OCR 날짜 오류 정밀 분석")
    print("=" * 100)
    print()
    print(f"분석 대상: {len(error_cases)}개 케이스")
    print()

    all_analyses = []

    for case in error_cases:
        case_name = case['case_name']
        print(f"\n{'='*80}")
        print(f"케이스: {case_name}")
        print(f"{'='*80}")
        print(f"등급: {case['grade']} | 정확도: {case['accuracy']:.1f}%")
        print(f"Baseline: {case['baseline_dates']}개 | OCR: {case['ocr_dates']}개 | 누락: {case['missing']}개")

        # Load OCR file
        cases_json = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")
        with open(cases_json) as f:
            cases = json.load(f)

        case_info = next((c for c in cases if c['name'] == case_name), None)
        if not case_info:
            print("  ⚠️  케이스 정보를 찾을 수 없음")
            continue

        ocr_file = Path(case_info['ocr_file'])
        if not ocr_file.exists():
            print("  ⚠️  OCR 파일 없음")
            continue

        # Load blocks
        blocks = load_offline_ocr(ocr_file)
        print(f"\n📦 총 블록 수: {len(blocks)}")

        # Load baseline
        baseline_file = Path(case_info['baseline_file'])
        baseline_text = baseline_file.read_text(encoding='utf-8')
        baseline_dates = extract_dates_from_text(baseline_text)

        # Analyze error dates
        error_dates = case['impossible_dates'] + case['future_dates']
        if not error_dates:
            # 누락된 날짜 중 일부 분석
            error_dates = case['missing_sample'][:3]

        print(f"\n🔍 오류 날짜 분석: {len(error_dates)}개")

        for error_date in error_dates:
            analysis = classify_error_type(error_date, blocks, baseline_dates)
            all_analyses.append({
                'case': case_name,
                'analysis': analysis
            })

            print(f"\n  📅 {error_date}")
            print(f"     유형: {analysis.error_type}")
            print(f"     OCR 블록 발견: {'✅ 예' if analysis.found_in_blocks else '❌ 아니오'}")

            if analysis.found_in_blocks:
                print(f"     위치: {analysis.spatial_context}")
                print(f"     블록 인덱스: {analysis.block_index}")

                if analysis.medical_keywords:
                    print(f"     의료 키워드: {', '.join(analysis.medical_keywords[:5])}")

                if analysis.surrounding_text:
                    print(f"     주변 텍스트 (샘플):")
                    for text in analysis.surrounding_text[:3]:
                        print(f"       {text}")

            print(f"     추론: {analysis.reasoning}")

    # Summary
    print("\n" + "=" * 100)
    print("분석 요약")
    print("=" * 100)

    type_counts = {}
    for item in all_analyses:
        error_type = item['analysis'].error_type
        type_counts[error_type] = type_counts.get(error_type, 0) + 1

    print(f"\n총 분석 오류: {len(all_analyses)}개")
    print(f"\n유형별 분포:")
    for error_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"  {error_type}: {count}개 ({count/len(all_analyses)*100:.1f}%)")

    # Save results
    output_path = Path("/home/user/VNEXSUS-25-12-30/outputs/deep_ocr_analysis.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump([
            {
                'case': item['case'],
                'error_date': item['analysis'].error_date,
                'error_type': item['analysis'].error_type,
                'found_in_blocks': item['analysis'].found_in_blocks,
                'spatial_context': item['analysis'].spatial_context,
                'medical_keywords': item['analysis'].medical_keywords,
                'reasoning': item['analysis'].reasoning,
            }
            for item in all_analyses
        ], f, indent=2, ensure_ascii=False)

    print(f"\n✅ 상세 분석 결과 저장: {output_path}")

    # Insights
    print("\n" + "=" * 100)
    print("100% 정확도 달성을 위한 개선 인사이트")
    print("=" * 100)

    baseline_errors = sum(1 for item in all_analyses if not item['analysis'].found_in_blocks)
    ocr_errors = len(all_analyses) - baseline_errors

    print(f"\n1. Baseline 오류 ({baseline_errors}개):")
    print("   - 오류 날짜가 OCR 블록에 없음")
    print("   - 개선: Baseline 파일 재검증 필요")
    print()

    print(f"2. OCR 인식 오류 ({ocr_errors}개):")
    recognition_errors = sum(1 for item in all_analyses if item['analysis'].error_type == '인식오류')
    misidentified = sum(1 for item in all_analyses if item['analysis'].error_type == '잘못인식')
    number_array = sum(1 for item in all_analyses if item['analysis'].error_type == '숫자배열오인')

    if recognition_errors > 0:
        print(f"   a) 인식 오류 ({recognition_errors}개):")
        print("      - OCR이 실제 날짜를 잘못 읽음")
        print("      - 개선: 날짜 유효성 검증 + 주변 날짜 시퀀스 기반 보정")

    if misidentified > 0:
        print(f"   b) 잘못 인식 ({misidentified}개):")
        print("      - 날짜가 아닌 것을 날짜로 인식")
        print("      - 개선: 의료 이벤트 컨텍스트 기반 필터링")

    if number_array > 0:
        print(f"   c) 숫자 배열 오인 ({number_array}개):")
        print("      - 숫자 배열을 날짜로 오인")
        print("      - 개선: 날짜 패턴 강화 + 주변 텍스트 분석")

    print()

if __name__ == "__main__":
    main()
