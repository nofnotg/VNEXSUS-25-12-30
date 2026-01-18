#!/usr/bin/env python3
"""
28개 케이스 빠른 날짜 검증
- offline_ocr.json과 blocks.csv에서 직접 날짜 추출
- Baseline과 비교하여 정확도 측정
- 절대적 기준 분류 (상/중/하)
"""
import re
import json
import csv
from pathlib import Path
from typing import Set, Dict, List
from dataclasses import dataclass, asdict

@dataclass
class QuickValidationResult:
    case_name: str
    case_type: str
    baseline_dates: int
    ocr_dates: int
    matched: int
    missing: int
    accuracy: float
    grade: str
    impossible_dates: List[str]
    future_dates: List[str]
    missing_sample: List[str]

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

def extract_dates_from_ocr_json(json_path: Path) -> Set[str]:
    """offline_ocr.json에서 날짜 추출"""
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)

    # blocks에서 텍스트 추출
    texts = []
    if 'blocks' in data:
        texts = [block.get('text', '') for block in data['blocks']]
    elif 'text' in data:
        texts = [data['text']]

    full_text = '\n'.join(texts)
    return extract_dates_from_text(full_text)

def extract_dates_from_blocks_csv(csv_path: Path) -> Set[str]:
    """blocks.csv에서 날짜 추출"""
    texts = []
    with open(csv_path, encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            texts.append(row.get('text', ''))

    full_text = '\n'.join(texts)
    return extract_dates_from_text(full_text)

def is_impossible_date(date_str: str) -> bool:
    """불가능한 날짜 판별"""
    try:
        year, month, day = map(int, date_str.split('-'))
        if month < 1 or month > 12:
            return True
        days_in_month = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if day < 1 or day > days_in_month[month - 1]:
            return True
        if month == 2 and day == 29:
            if not (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)):
                return True
        return False
    except:
        return True

def is_future_date(date_str: str, tolerance_days: int = 30) -> bool:
    """미래 날짜 판별"""
    try:
        from datetime import datetime, timedelta
        date = datetime.strptime(date_str, "%Y-%m-%d")
        threshold = datetime.now() + timedelta(days=tolerance_days)
        return date > threshold
    except:
        return False

def classify_grade(accuracy: float) -> str:
    """절대적 기준 등급 분류"""
    if accuracy >= 80:
        return "상"
    elif accuracy >= 60:
        return "중"
    else:
        return "하"

def main():
    cases_json = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")

    if not cases_json.exists():
        print(f"❌ {cases_json} not found")
        return 1

    with open(cases_json) as f:
        cases = json.load(f)

    print("=" * 100)
    print("28개 케이스 빠른 날짜 검증")
    print("=" * 100)
    print()

    results = []

    for i, case_info in enumerate(cases, 1):
        case_name = case_info['name']
        case_type = case_info['type']
        ocr_file = Path(case_info['ocr_file'])
        baseline_file = Path(case_info['baseline_file'])

        print(f"[{i}/{len(cases)}] {case_name}")

        if not ocr_file.exists():
            print(f"  ❌ OCR file not found")
            continue

        if not baseline_file.exists():
            print(f"  ❌ Baseline not found")
            continue

        # Extract dates from baseline
        baseline_text = baseline_file.read_text(encoding='utf-8')
        baseline_dates = extract_dates_from_text(baseline_text)

        # Extract dates from OCR
        if ocr_file.suffix == '.json':
            ocr_dates = extract_dates_from_ocr_json(ocr_file)
        elif ocr_file.suffix == '.csv':
            ocr_dates = extract_dates_from_blocks_csv(ocr_file)
        else:
            print(f"  ⚠️  Unknown format: {ocr_file.suffix}")
            continue

        # Calculate metrics
        matched = baseline_dates & ocr_dates
        missing = baseline_dates - ocr_dates

        matched_count = len(matched)
        missing_count = len(missing)
        baseline_count = len(baseline_dates)
        ocr_count = len(ocr_dates)

        accuracy = (matched_count / baseline_count * 100) if baseline_count > 0 else 100.0
        grade = classify_grade(accuracy)

        # Analyze missing dates
        impossible = [d for d in missing if is_impossible_date(d)]
        future = [d for d in missing if is_future_date(d) and not is_impossible_date(d)]

        result = QuickValidationResult(
            case_name=case_name,
            case_type=case_type,
            baseline_dates=baseline_count,
            ocr_dates=ocr_count,
            matched=matched_count,
            missing=missing_count,
            accuracy=accuracy,
            grade=grade,
            impossible_dates=impossible,
            future_dates=future,
            missing_sample=sorted(missing)[:5],
        )

        results.append(result)

        # Print
        grade_emoji = "✅" if grade == "상" else "⚠️" if grade == "중" else "❌"
        print(f"  {grade_emoji} {grade} | {accuracy:5.1f}% | Baseline: {baseline_count} | OCR: {ocr_count} | 매칭: {matched_count} | 누락: {missing_count}")

        if impossible:
            print(f"     불가능: {len(impossible)}개 - {impossible[:3]}")
        if future:
            print(f"     미래: {len(future)}개 - {future[:3]}")

    # Statistics
    print("\n" + "=" * 100)
    print("통계 요약")
    print("=" * 100)
    print()

    grade_counts = {"상": 0, "중": 0, "하": 0}
    for result in results:
        grade_counts[result.grade] += 1

    total = len(results)
    print(f"총 케이스: {total}개\n")
    print(f"등급 분포:")
    print(f"  상 (80-100%): {grade_counts['상']:2}개 ({grade_counts['상']/total*100:5.1f}%)")
    print(f"  중 (60-79%):  {grade_counts['중']:2}개 ({grade_counts['중']/total*100:5.1f}%)")
    print(f"  하 (<60%):    {grade_counts['하']:2}개 ({grade_counts['하']/total*100:5.1f}%)")
    print()

    avg_accuracy = sum(r.accuracy for r in results) / total if total > 0 else 0
    print(f"평균 정확도: {avg_accuracy:.1f}%")
    print()

    # OCR Error Analysis
    total_impossible = sum(len(r.impossible_dates) for r in results)
    total_future = sum(len(r.future_dates) for r in results)
    print(f"OCR 오류 분석:")
    print(f"  불가능한 날짜: {total_impossible}개")
    print(f"  미래 날짜: {total_future}개")
    print()

    # Save results
    output_file = Path("/home/user/VNEXSUS-25-12-30/outputs/quick_validation_28.json")
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump([asdict(r) for r in results], f, indent=2, ensure_ascii=False)

    print(f"✅ 결과 저장: {output_file}")

    # Grade breakdown
    print("\n" + "=" * 100)
    print("등급별 케이스")
    print("=" * 100)

    for grade in ["상", "중", "하"]:
        grade_cases = [r for r in results if r.grade == grade]
        if grade_cases:
            print(f"\n{grade} 등급 ({len(grade_cases)}개):")
            for r in sorted(grade_cases, key=lambda x: x.accuracy, reverse=True):
                print(f"  - {r.case_name:50} {r.accuracy:5.1f}%")

    print("\n" + "=" * 100)

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
