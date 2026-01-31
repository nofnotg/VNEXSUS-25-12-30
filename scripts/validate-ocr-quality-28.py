#!/usr/bin/env python3
"""
28개 케이스 OCR 품질 검증
- OCR 원본 데이터에서 날짜 추출
- GT baseline과 비교
"""
import re
import json
import csv
from pathlib import Path
from typing import Set, Dict, List
from dataclasses import dataclass, asdict

@dataclass
class OcrValidationResult:
    case_name: str
    case_type: str
    ocr_dates: Set[str]
    gt_dates: Set[str]
    matched: Set[str]
    missing: Set[str]
    extra: Set[str]
    coverage: float  # GT 대비 OCR 포함률
    precision: float  # OCR 대비 GT 정확도

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
            try:
                normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                # 기본 유효성 검증
                y, m, d = int(year), int(month), int(day)
                if 1950 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31:
                    dates.add(normalized)
            except:
                pass

    return dates

def extract_dates_from_json_ocr(json_path: Path) -> Set[str]:
    """JSON OCR 파일에서 날짜 추출"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # JSON 구조 탐색 - text 필드 우선
        full_text = ""
        if isinstance(data, dict):
            # text 필드가 있으면 우선 사용
            if 'text' in data and isinstance(data['text'], str):
                full_text = data['text']
            # text가 없으면 pages/blocks에서 추출
            elif 'pages' in data:
                for page in data['pages']:
                    if isinstance(page, dict):
                        if 'text' in page:
                            full_text += page['text'] + "\n"
                        if 'blocks' in page:
                            for block in page['blocks']:
                                if isinstance(block, dict) and 'text' in block:
                                    full_text += block['text'] + "\n"
            elif 'blocks' in data:
                for block in data['blocks']:
                    if isinstance(block, dict) and 'text' in block:
                        full_text += block['text'] + "\n"

        return extract_dates_from_text(full_text)
    except Exception as e:
        print(f"  ⚠️  Error reading JSON: {e}")
        return set()

def extract_dates_from_csv_blocks(csv_path: Path) -> Set[str]:
    """CSV blocks 파일에서 날짜 추출"""
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            full_text = ""
            for row in reader:
                if 'text' in row:
                    full_text += row['text'] + "\n"

        return extract_dates_from_text(full_text)
    except Exception as e:
        print(f"  ⚠️  Error reading CSV: {e}")
        return set()

def validate_case(case: dict) -> OcrValidationResult:
    """단일 케이스 검증"""
    case_name = case['name']
    case_type = case['type']
    ocr_file = Path(case['ocr_file'])
    gt_file = Path(case['baseline_file'])

    # OCR 날짜 추출
    if ocr_file.suffix == '.json':
        ocr_dates = extract_dates_from_json_ocr(ocr_file)
    elif ocr_file.suffix == '.csv':
        ocr_dates = extract_dates_from_csv_blocks(ocr_file)
    else:
        ocr_dates = set()

    # GT 날짜 추출
    if gt_file.exists():
        gt_text = gt_file.read_text(encoding='utf-8')
        gt_dates = extract_dates_from_text(gt_text)
    else:
        gt_dates = set()

    # 매칭 계산
    matched = ocr_dates & gt_dates
    missing = gt_dates - ocr_dates
    extra = ocr_dates - gt_dates

    coverage = (len(matched) / len(gt_dates) * 100) if len(gt_dates) > 0 else 100.0
    precision = (len(matched) / len(ocr_dates) * 100) if len(ocr_dates) > 0 else 0.0

    return OcrValidationResult(
        case_name=case_name,
        case_type=case_type,
        ocr_dates=ocr_dates,
        gt_dates=gt_dates,
        matched=matched,
        missing=missing,
        extra=extra,
        coverage=coverage,
        precision=precision
    )

def main():
    # Load cases
    cases_json = Path("/home/user/VNEXSUS-25-12-30/validation_cases_28.json")

    if not cases_json.exists():
        print(f"❌ Cases file not found: {cases_json}")
        return 1

    with open(cases_json) as f:
        cases = json.load(f)

    print("=" * 100)
    print("28개 케이스 OCR 품질 검증 (날짜 기반)")
    print("=" * 100)
    print()

    results = []

    for idx, case in enumerate(cases, 1):
        print(f"[{idx}/28] {case['name']}")
        result = validate_case(case)
        results.append(result)

        print(f"  OCR 날짜: {len(result.ocr_dates)}개")
        print(f"  GT 날짜: {len(result.gt_dates)}개")
        print(f"  매칭: {len(result.matched)}개")
        print(f"  누락: {len(result.missing)}개 (GT에는 있지만 OCR에 없음)")
        print(f"  추가: {len(result.extra)}개 (OCR에는 있지만 GT에 없음)")
        print(f"  Coverage: {result.coverage:.1f}% (GT 대비 OCR 포함률)")
        print(f"  Precision: {result.precision:.1f}% (OCR 대비 GT 정확도)")

        if len(result.matched) > 0:
            sample = sorted(result.matched)[:3]
            print(f"  매칭 샘플: {', '.join(sample)}")

        if len(result.missing) > 0:
            missing_sample = sorted(result.missing)[:3]
            print(f"  ⚠️  누락 샘플: {', '.join(missing_sample)}")

        print()

    # Summary
    print("=" * 100)
    print("통계 요약")
    print("=" * 100)
    print()

    total = len(results)
    avg_coverage = sum(r.coverage for r in results) / total if total > 0 else 0
    avg_precision = sum(r.precision for r in results) / total if total > 0 else 0

    high_coverage = [r for r in results if r.coverage >= 80]
    medium_coverage = [r for r in results if 60 <= r.coverage < 80]
    low_coverage = [r for r in results if r.coverage < 60]

    print(f"총 케이스: {total}개")
    print(f"평균 Coverage: {avg_coverage:.1f}%")
    print(f"평균 Precision: {avg_precision:.1f}%")
    print()
    print("Coverage 등급 분포:")
    print(f"  상 (80-100%): {len(high_coverage)}개 ({len(high_coverage)/total*100:.1f}%)")
    print(f"  중 (60-79%):  {len(medium_coverage)}개 ({len(medium_coverage)/total*100:.1f}%)")
    print(f"  하 (<60%):    {len(low_coverage)}개 ({len(low_coverage)/total*100:.1f}%)")
    print()

    # 케이스 타입별 통계
    case_types = {}
    for r in results:
        if r.case_type not in case_types:
            case_types[r.case_type] = []
        case_types[r.case_type].append(r)

    print("케이스 타입별 통계:")
    for case_type, type_results in case_types.items():
        avg_cov = sum(r.coverage for r in type_results) / len(type_results)
        avg_prec = sum(r.precision for r in type_results) / len(type_results)
        print(f"  {case_type:10s}: {len(type_results):2}개, Coverage {avg_cov:.1f}%, Precision {avg_prec:.1f}%")

    # JSON 출력
    output_file = Path("/home/user/VNEXSUS-25-12-30/ocr_validation_results_28.json")
    output_data = {
        "total_cases": total,
        "avg_coverage": avg_coverage,
        "avg_precision": avg_precision,
        "grade_distribution": {
            "high": len(high_coverage),
            "medium": len(medium_coverage),
            "low": len(low_coverage)
        },
        "cases": [
            {
                "name": r.case_name,
                "type": r.case_type,
                "ocr_dates_count": len(r.ocr_dates),
                "gt_dates_count": len(r.gt_dates),
                "matched_count": len(r.matched),
                "missing_count": len(r.missing),
                "extra_count": len(r.extra),
                "coverage": round(r.coverage, 2),
                "precision": round(r.precision, 2),
                "ocr_dates": sorted(list(r.ocr_dates))[:20],  # 최대 20개
                "gt_dates": sorted(list(r.gt_dates))[:20],
                "matched": sorted(list(r.matched))[:10],
                "missing": sorted(list(r.missing))[:10],
                "extra": sorted(list(r.extra))[:10]
            }
            for r in results
        ]
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅ 상세 결과 저장: {output_file}")
    print()

    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())
