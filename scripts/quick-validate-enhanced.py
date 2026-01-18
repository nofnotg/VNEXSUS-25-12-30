#!/usr/bin/env python3
"""
향상된 날짜 정규화로 재검증 (LLM 없이)
- 점/슬래시 포맷 지원 강화
- 유효성 검증 개선
"""
import json
import re
from pathlib import Path
from typing import Set

def extract_dates_comprehensive(text: str) -> Set[str]:
    """모든 날짜 패턴 추출 (강화된 버전)"""
    patterns = [
        (r'(\d{4})[-](\d{1,2})[-](\d{1,2})', '-'),        # 2024-05-01
        (r'(\d{4})[.](\d{1,2})[.](\d{1,2})', '.'),        # 2024.05.01 ← 강화
        (r'(\d{4})[/](\d{1,2})[/](\d{1,2})', '/'),        # 2024/05/01 ← 강화
        (r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일', '년'),  # 2024년 5월 1일
    ]

    dates = set()
    for pattern, sep in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"

            # 유효성 검증 (강화)
            if is_valid_date_enhanced(normalized):
                dates.add(normalized)

    return dates

def is_valid_date_enhanced(date_str: str) -> bool:
    """향상된 날짜 유효성 검증"""
    try:
        year, month, day = map(int, date_str.split('-'))

        # 범위 체크
        if year < 1950 or year > 2100:  # 범위 확대
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

        # 미래 날짜 체크 (50년 후까지 허용 - 보험 만기일 고려)
        from datetime import datetime, timedelta
        date = datetime(year, month, day)
        max_future = datetime.now() + timedelta(days=365 * 50)

        if date > max_future:
            return False

        return True
    except:
        return False

def classify_grade(accuracy: float) -> str:
    """등급 분류"""
    if accuracy >= 80:
        return "상"
    elif accuracy >= 60:
        return "중"
    else:
        return "하"

def main():
    # 케이스 로드
    cases_file = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")
    with open(cases_file) as f:
        cases = json.load(f)

    print("=" * 100)
    print("28케이스 재검증 (향상된 정규화)")
    print("=" * 100)
    print(f"총 케이스: {len(cases)}개")
    print()

    results = []
    for i, case in enumerate(cases, 1):
        case_name = case['name']

        # Baseline 날짜
        baseline_file = Path(case['baseline_file'])
        if not baseline_file.exists():
            continue

        baseline_text = baseline_file.read_text(encoding='utf-8')
        baseline_dates = extract_dates_comprehensive(baseline_text)

        # OCR 날짜
        ocr_file = Path(case['ocr_file'])
        if not ocr_file.exists():
            continue

        # JSON 또는 CSV 처리
        if ocr_file.suffix.lower() == '.csv':
            # CSV 파일
            ocr_text = ocr_file.read_text(encoding='utf-8')
            ocr_dates = extract_dates_comprehensive(ocr_text)
        else:
            # JSON 파일
            try:
                with open(ocr_file, encoding='utf-8') as f:
                    ocr_data = json.load(f)
                ocr_text = '\n'.join([block.get('text', '') for block in ocr_data.get('blocks', [])])
                ocr_dates = extract_dates_comprehensive(ocr_text)
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                print(f"     ⚠️  JSON 파싱 오류, 건너뜀")
                continue

        # 비교
        matched = baseline_dates & ocr_dates
        missing = baseline_dates - ocr_dates

        accuracy = (len(matched) / len(baseline_dates) * 100) if baseline_dates else 100.0
        grade = classify_grade(accuracy)

        result = {
            'case_name': case_name,
            'case_type': case['type'],
            'baseline_dates': len(baseline_dates),
            'ocr_dates': len(ocr_dates),
            'matched': len(matched),
            'missing': len(missing),
            'accuracy': accuracy,
            'grade': grade,
            'missing_sample': list(missing)[:5]
        }

        results.append(result)

        status = "✅" if grade == "상" else "⚠️" if grade == "중" else "❌"
        print(f"[{i:2d}/{len(cases)}] {case_name:40s} {status} {grade} ({accuracy:5.1f}%)")

    # 통계
    print()
    print("=" * 100)
    print("검증 결과")
    print("=" * 100)

    avg_accuracy = sum(r['accuracy'] for r in results) / len(results)
    grade_counts = {'상': 0, '중': 0, '하': 0}
    for r in results:
        grade_counts[r['grade']] += 1

    print(f"\n평균 정확도: {avg_accuracy:.1f}%")
    print(f"\n등급 분포:")
    print(f"  상 (80-100%): {grade_counts['상']:2d}개 ({grade_counts['상']/len(results)*100:5.1f}%)")
    print(f"  중 (60-79%):  {grade_counts['중']:2d}개 ({grade_counts['중']/len(results)*100:5.1f}%)")
    print(f"  하 (<60%):    {grade_counts['하']:2d}개 ({grade_counts['하']/len(results)*100:5.1f}%)")

    # 기존 결과와 비교
    old_results_path = Path("/home/user/VNEXSUS-25-12-30/outputs/quick_validation_28.json")
    if old_results_path.exists():
        with open(old_results_path) as f:
            old_results = json.load(f)

        old_avg = sum(r['accuracy'] for r in old_results) / len(old_results)
        old_grade_counts = {'상': 0, '중': 0, '하': 0}
        for r in old_results:
            old_grade_counts[r['grade']] += 1

        print()
        print("=" * 100)
        print("Before/After 비교")
        print("=" * 100)
        print(f"\n평균 정확도:  {old_avg:.1f}% → {avg_accuracy:.1f}% ({avg_accuracy - old_avg:+.1f}%p)")
        print(f"\n등급 변화:")
        print(f"  상: {old_grade_counts['상']:2d} → {grade_counts['상']:2d} ({grade_counts['상'] - old_grade_counts['상']:+d})")
        print(f"  중: {old_grade_counts['중']:2d} → {grade_counts['중']:2d} ({grade_counts['중'] - old_grade_counts['중']:+d})")
        print(f"  하: {old_grade_counts['하']:2d} → {grade_counts['하']:2d} ({grade_counts['하'] - old_grade_counts['하']:+d})")

    # 저장
    output_path = Path("/home/user/VNEXSUS-25-12-30/outputs/validation_28_enhanced.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n✅ 결과 저장: {output_path}")

if __name__ == "__main__":
    main()
