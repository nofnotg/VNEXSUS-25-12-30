#!/usr/bin/env python3
"""
날짜 데이터 검증 스크립트

부분집합 (caseN_report.txt)의 날짜가 전체집합 (생성된 보고서)에 100% 포함되는지 검증
"""
import re
import sys
from pathlib import Path
from typing import Set, Dict, List

def extract_dates(text: str) -> Set[str]:
    """텍스트에서 날짜 추출 (YYYY-MM-DD 또는 YYYY.MM.DD 형식)"""
    # 다양한 날짜 형식 패턴
    patterns = [
        r'(\d{4})[-./](\d{1,2})[-./](\d{1,2})',  # YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
        r'(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일',  # YYYY년 MM월 DD일
    ]

    dates = set()
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            year, month, day = match.groups()
            # 정규화: YYYY-MM-DD 형식으로 통일
            normalized = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
            dates.add(normalized)

    return dates

def analyze_case(case_name: str, baseline_path: Path, generated_path: Path) -> Dict:
    """케이스 분석"""

    # 부분집합 (baseline) 읽기
    if not baseline_path.exists():
        return {
            "case": case_name,
            "error": f"Baseline not found: {baseline_path}"
        }

    # 전체집합 (generated) 읽기
    if not generated_path.exists():
        return {
            "case": case_name,
            "error": f"Generated report not found: {generated_path}"
        }

    baseline_text = baseline_path.read_text(encoding='utf-8')
    generated_text = generated_path.read_text(encoding='utf-8')

    # 날짜 추출
    baseline_dates = extract_dates(baseline_text)
    generated_dates = extract_dates(generated_text)

    # 포함 여부 확인
    missing_dates = baseline_dates - generated_dates
    extra_dates = generated_dates - baseline_dates
    matched_dates = baseline_dates & generated_dates

    # 포함률 계산
    if len(baseline_dates) == 0:
        coverage = 100.0 if len(generated_dates) == 0 else 0.0
    else:
        coverage = (len(matched_dates) / len(baseline_dates)) * 100.0

    return {
        "case": case_name,
        "baseline_dates_count": len(baseline_dates),
        "generated_dates_count": len(generated_dates),
        "matched_count": len(matched_dates),
        "missing_count": len(missing_dates),
        "extra_count": len(extra_dates),
        "coverage_percent": coverage,
        "baseline_dates": sorted(baseline_dates),
        "generated_dates": sorted(generated_dates),
        "missing_dates": sorted(missing_dates),
        "extra_dates": sorted(extra_dates),
        "matched_dates": sorted(matched_dates),
    }

def main():
    # 데이터 레포 경로
    data_repo = Path("/home/user/VNEXSUS_reports_pdf/offline_ocr_samples/offline_ocr_samples/2025-12-26T02-18-51-219Z")

    # 생성된 보고서 경로
    output_dir = Path("/home/user/VNEXSUS-25-12-30/outputs/validation-full")

    # 케이스 목록
    cases = [
        "KB손해보험_김태형_안정형_협심증_",
        "농협손해보험_김인화_후유장해_",
        "농협손해보험_이광욱_고지의무_위반_심질환_",
        "이정희",
        "장유찬",
        "현대해상_김민아_뇌_양성종양_",
        "현대해상_조윤아_태아보험__엄마_이주희_",
    ]

    results = []

    for case in cases:
        # Baseline (부분집합)
        baseline_path = data_repo / case / f"{case}_report.txt"

        # Generated (전체집합) - blocks 버전 우선
        generated_blocks_path = output_dir / f"{case}_blocks" / "app_report.md"
        generated_ocr_path = output_dir / f"{case}_offline_ocr" / "app_report.md"

        # blocks 버전이 있으면 우선 사용
        if generated_blocks_path.exists():
            result = analyze_case(case, baseline_path, generated_blocks_path)
            result["source"] = "blocks"
        elif generated_ocr_path.exists():
            result = analyze_case(case, baseline_path, generated_ocr_path)
            result["source"] = "offline_ocr"
        else:
            result = {
                "case": case,
                "error": "No generated report found"
            }

        results.append(result)

    # 결과 출력
    print("=" * 100)
    print("날짜 데이터 검증 결과")
    print("=" * 100)
    print()

    total_cases = len(results)
    passed_cases = 0

    for result in results:
        if "error" in result:
            print(f"\n❌ {result['case']}")
            print(f"   오류: {result['error']}")
            continue

        print(f"\n📋 {result['case']} ({result.get('source', 'unknown')})")
        print(f"   부분집합 날짜 수: {result['baseline_dates_count']}")
        print(f"   전체집합 날짜 수: {result['generated_dates_count']}")
        print(f"   매칭된 날짜 수: {result['matched_count']}")
        print(f"   누락된 날짜 수: {result['missing_count']}")
        print(f"   추가된 날짜 수: {result['extra_count']}")
        print(f"   포함률: {result['coverage_percent']:.1f}%")

        if result['coverage_percent'] == 100.0:
            print(f"   ✅ 통과 (100% 포함)")
            passed_cases += 1
        else:
            print(f"   ❌ 실패 ({result['coverage_percent']:.1f}% 포함)")
            if result['missing_dates']:
                print(f"   누락된 날짜: {', '.join(result['missing_dates'])}")

        # 샘플 날짜 표시
        if result['matched_dates']:
            print(f"   매칭 예시: {', '.join(result['matched_dates'][:3])}")

    print("\n" + "=" * 100)
    print(f"전체 통과율: {passed_cases}/{total_cases} ({(passed_cases/total_cases*100):.1f}%)")
    print("=" * 100)

    return 0 if passed_cases == total_cases else 1

if __name__ == "__main__":
    sys.exit(main())
