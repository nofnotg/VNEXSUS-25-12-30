#!/usr/bin/env python3
"""
28개 케이스 날짜 검증 스크립트
- 생성된 보고서와 Baseline 비교
- 절대적 기준 분류 (상/중/하)
- 상세 분석 및 JSON 출력
"""
import re
import json
import sys
from pathlib import Path
from typing import Set, Dict, List, Tuple
from dataclasses import dataclass, asdict

@dataclass
class DateValidationResult:
    """케이스별 검증 결과"""
    case_name: str
    case_type: str
    baseline_date_count: int
    generated_date_count: int
    matched_count: int
    missing_count: int
    extra_count: int
    accuracy: float
    grade: str  # 상/중/하
    missing_dates: List[str]
    extra_dates: List[str]
    matched_sample: List[str]
    impossible_dates: List[str]
    future_dates: List[str]

def extract_dates(text: str) -> Set[str]:
    """텍스트에서 날짜 추출"""
    patterns = [
        r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})',  # YYYY-MM-DD
        r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일',  # 한글
    ]

    dates = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            dates.add(normalized)

    return dates

def is_impossible_date(date_str: str) -> bool:
    """불가능한 날짜 판별 (예: 2025-03-45)"""
    try:
        year, month, day = map(int, date_str.split('-'))

        # 월 범위 체크
        if month < 1 or month > 12:
            return True

        # 일 범위 체크 (간단한 버전)
        days_in_month = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        if day < 1 or day > days_in_month[month - 1]:
            return True

        # 2월 29일 윤년 체크
        if month == 2 and day == 29:
            if not (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)):
                return True

        return False
    except:
        return True

def is_future_date(date_str: str, tolerance_days: int = 30) -> bool:
    """미래 날짜 판별 (오늘 + tolerance_days 이후)"""
    try:
        from datetime import datetime, timedelta
        date = datetime.strptime(date_str, "%Y-%m-%d")
        threshold = datetime.now() + timedelta(days=tolerance_days)
        return date > threshold
    except:
        return False

def classify_grade(accuracy: float) -> str:
    """절대적 기준으로 등급 분류"""
    if accuracy >= 80:
        return "상"
    elif accuracy >= 60:
        return "중"
    else:
        return "하"

def validate_case(case_name: str, baseline_path: Path, generated_path: Path, case_type: str) -> DateValidationResult:
    """단일 케이스 검증"""

    # Read files
    baseline_text = baseline_path.read_text(encoding='utf-8') if baseline_path.exists() else ""
    generated_text = generated_path.read_text(encoding='utf-8') if generated_path.exists() else ""

    # Extract dates
    baseline_dates = extract_dates(baseline_text)
    generated_dates = extract_dates(generated_text)

    # Calculate metrics
    matched = baseline_dates & generated_dates
    missing = baseline_dates - generated_dates
    extra = generated_dates - baseline_dates

    matched_count = len(matched)
    missing_count = len(missing)
    extra_count = len(extra)
    baseline_count = len(baseline_dates)

    accuracy = (matched_count / baseline_count * 100) if baseline_count > 0 else 100.0
    grade = classify_grade(accuracy)

    # Analyze missing dates
    impossible = [d for d in missing if is_impossible_date(d)]
    future = [d for d in missing if is_future_date(d) and not is_impossible_date(d)]

    return DateValidationResult(
        case_name=case_name,
        case_type=case_type,
        baseline_date_count=baseline_count,
        generated_date_count=len(generated_dates),
        matched_count=matched_count,
        missing_count=missing_count,
        extra_count=extra_count,
        accuracy=accuracy,
        grade=grade,
        missing_dates=sorted(missing)[:10],  # 최대 10개만
        extra_dates=sorted(extra)[:10],
        matched_sample=sorted(matched)[:5],  # 샘플 5개
        impossible_dates=impossible,
        future_dates=future,
    )

def main():
    # Paths
    output_dir = Path("/home/user/VNEXSUS-25-12-30/outputs/validation-28")
    cases_json = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")

    if not cases_json.exists():
        print(f"❌ Cases file not found: {cases_json}")
        return 1

    # Load cases
    with open(cases_json) as f:
        cases = json.load(f)

    print("=" * 100)
    print("28개 케이스 날짜 검증")
    print("=" * 100)
    print()

    results = []

    for i, case_info in enumerate(cases, 1):
        case_name = case_info['name']
        case_type = case_info['type']

        print(f"[{i}/{len(cases)}] {case_name}")

        # Find generated report
        case_output_dir = output_dir / case_name
        generated_files = list(case_output_dir.glob("report.md"))
        if not generated_files:
            generated_files = list(case_output_dir.glob("app_report.md"))

        if not generated_files:
            print(f"  ⚠️  Generated report not found")
            continue

        generated_path = generated_files[0]
        baseline_path = case_output_dir / f"{case_name}_baseline.txt"

        if not baseline_path.exists():
            print(f"  ⚠️  Baseline not found")
            continue

        # Validate
        result = validate_case(case_name, baseline_path, generated_path, case_type)
        results.append(result)

        # Print result
        grade_emoji = "✅" if result.grade == "상" else "⚠️" if result.grade == "중" else "❌"
        print(f"  {grade_emoji} 등급: {result.grade} | 정확도: {result.accuracy:.1f}%")
        print(f"     Baseline: {result.baseline_date_count}개 | 생성: {result.generated_date_count}개 | 매칭: {result.matched_count}개 | 누락: {result.missing_count}개")

        if result.impossible_dates:
            print(f"     불가능한 날짜: {len(result.impossible_dates)}개 - {result.impossible_dates[:3]}")
        if result.future_dates:
            print(f"     미래 날짜: {len(result.future_dates)}개 - {result.future_dates[:3]}")

    # Statistics
    print("\n" + "=" * 100)
    print("통계 요약")
    print("=" * 100)
    print()

    grade_counts = {"상": 0, "중": 0, "하": 0}
    for result in results:
        grade_counts[result.grade] += 1

    total = len(results)
    print(f"총 검증 케이스: {total}개")
    print()
    print(f"📊 등급 분포:")
    print(f"  상 (80-100%): {grade_counts['상']:2}개 ({grade_counts['상']/total*100:5.1f}%)")
    print(f"  중 (60-79%):  {grade_counts['중']:2}개 ({grade_counts['중']/total*100:5.1f}%)")
    print(f"  하 (<60%):    {grade_counts['하']:2}개 ({grade_counts['하']/total*100:5.1f}%)")
    print()

    avg_accuracy = sum(r.accuracy for r in results) / total if total > 0 else 0
    print(f"평균 정확도: {avg_accuracy:.1f}%")
    print()

    # Impossible dates analysis
    total_impossible = sum(len(r.impossible_dates) for r in results)
    total_future = sum(len(r.future_dates) for r in results)
    print(f"OCR 오류 분석:")
    print(f"  불가능한 날짜: {total_impossible}개")
    print(f"  미래 날짜: {total_future}개")
    print()

    # Save results
    output_json = output_dir / "validation_results.json"
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump([asdict(r) for r in results], f, indent=2, ensure_ascii=False)

    print(f"✅ 결과 저장: {output_json}")

    # Grade breakdown
    print("\n" + "=" * 100)
    print("등급별 케이스 목록")
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
    sys.exit(main())
